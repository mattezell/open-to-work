#!/usr/bin/env python3
"""Generate TOKEN's bark bank from tools/barks.yaml with the local model.

    python3 tools/genbarks.py                 # every category -> src/view/barks.json
    python3 tools/genbarks.py --only whiff    # one category, merged into the bank
    python3 tools/genbarks.py --dry-run       # print the prompts, call nothing
    python3 tools/genbarks.py --reselect      # re-filter the saved replies, no model call

Per category: ask the model (llama-swap, OpenAI-compatible) for a JSON array of
candidate lines, normalise them to plain ASCII, drop any that break the rules
(too long, non-ASCII, names a real company or person, profanity, a near
duplicate, or a line vetoed in review), and keep the hand-written seeds first.
Raw replies are kept under tools/_staging/barks/, so after reading the bank a
reviewer adds weak lines to `veto` and runs --reselect: the spare candidates
fill the gaps without asking the model again.

The bank is generated once and committed: the public game never calls a model.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("genbarks: PyYAML is required")

ROOT = Path(__file__).resolve().parent.parent
SPEC = ROOT / "tools" / "barks.yaml"
BANK = ROOT / "src" / "view" / "barks.json"
STAGING = ROOT / "tools" / "_staging" / "barks"

REQUEST_TIMEOUT = 300
MAX_REPLY_TOKENS = 8000

# Real companies, products and people are off limits: the enemy is the hiring
# process. Matched as whole words, case-insensitively.
BANNED_WORDS = (
    "google", "amazon", "microsoft", "apple", "meta", "facebook",
    "linkedin", "indeed", "glassdoor", "ziprecruiter", "openai", "anthropic",
    "claude", "chatgpt", "gpt", "copilot", "netflix", "twitter", "github",
    "slack", "workday", "greenhouse", "lever", "leetcode", "hackerrank",
    "fuck", "shit", "damn", "hell", "crap", "ass", "bitch", "bastard",
)
BANNED_PHRASES = ("as an ai", "language model")
BANNED = re.compile(r"\b(" + "|".join(BANNED_WORDS) + r")\b", re.IGNORECASE)

# Typographic characters models like to emit, mapped to their ASCII spelling.
ASCII_FOR = {
    "\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"',
    "\u2026": "...", "\u2013": "-", "\u2014": "-", "\u00a0": " ",
}


class IncompleteReply(Exception):
    """The model stopped before it finished answering."""


def normalize(line: str) -> str:
    """Plain-ASCII spelling of a candidate, without wrapping quotes or extra spaces."""
    for fancy, plain in ASCII_FOR.items():
        line = line.replace(fancy, plain)
    line = " ".join(line.split())
    if len(line) >= 2 and line[0] == line[-1] and line[0] in "\"'":
        line = line[1:-1].strip()
    return line


def rejection(line: str, max_chars: int) -> str | None:
    """Why a normalised line cannot go in the bank, or None if it can."""
    if not line:
        return "empty"
    if len(line) > max_chars:
        return f"longer than {max_chars}"
    if any(not (32 <= ord(c) < 127) for c in line):
        return "not plain ASCII"
    if "#" in line or "@" in line:
        return "hashtag or handle"
    match = BANNED.search(line)
    if match:
        return f"banned word: {match.group(0).lower()}"
    lowered = line.lower()
    for phrase in BANNED_PHRASES:
        if phrase in lowered:
            return f"banned phrase: {phrase}"
    return None


def dedupe_key(line: str) -> str:
    """Lines that differ only in case, spacing or punctuation are the same line."""
    return re.sub(r"[^a-z0-9]", "", line.lower())


def select(
    seeds: list[str],
    candidates: list[str],
    keep: int,
    max_chars: int,
    veto: frozenset[str] = frozenset(),
) -> tuple[list[str], list[tuple[str, str]]]:
    """Seeds first, then valid new candidates in the model's order, up to `keep`.

    Returns the kept lines and every dropped candidate with the reason.
    """
    vetoed = {dedupe_key(line) for line in veto}
    kept: list[str] = []
    seen: set[str] = set()
    for seed in seeds:
        reason = rejection(seed, max_chars)
        if reason:
            raise ValueError(f"seed {seed!r} breaks the rules: {reason}")
        kept.append(seed)
        seen.add(dedupe_key(seed))
    dropped: list[tuple[str, str]] = []
    for raw in candidates:
        line = normalize(raw)
        reason = rejection(line, max_chars)
        if reason is None and dedupe_key(line) in vetoed:
            reason = "vetoed"
        if reason is None and dedupe_key(line) in seen:
            reason = "duplicate"
        if reason is None and len(kept) >= keep:
            reason = "bank full"
        if reason:
            dropped.append((line, reason))
            continue
        kept.append(line)
        seen.add(dedupe_key(line))
    return kept, dropped


def parse_reply(content: str) -> list[str]:
    """The strings in the first JSON array of a reply; one line each if there is none."""
    match = re.search(r"\[.*\]", content, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group(0))
        except json.JSONDecodeError:
            parsed = None
        if isinstance(parsed, list):
            return [item for item in parsed if isinstance(item, str)]
    return [re.sub(r"^\s*(?:[-*]|\d+[.)])\s*", "", l) for l in content.splitlines() if l.strip()]


def build_messages(spec: dict, category: dict) -> list[dict[str, str]]:
    rules = "\n".join(f"- {rule}" for rule in spec["rules"])
    system = (
        f"{spec['persona']}\n\nRules:\n{rules}\n\n"
        "Reply with only a JSON array of strings, nothing else."
    )
    examples = "\n".join(f"- {seed}" for seed in category["seeds"])
    user = (
        f"Write {spec['candidates']} different lines TOKEN says when {category['when']}.\n"
        f"Each line at most {spec['ask_chars']} characters. Vary the jokes; do not reuse "
        f"these existing lines, but match their voice:\n{examples}"
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def ask(spec: dict, messages: list[dict[str, str]]) -> str:
    body = json.dumps({
        "model": spec["model"],
        "messages": messages,
        "temperature": spec["temperature"],
        "seed": spec["seed"],
        "reasoning_effort": "low",
        "max_tokens": MAX_REPLY_TOKENS,
    }).encode()
    request = urllib.request.Request(
        spec["endpoint"], data=body, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
        reply = json.load(response)
    choice = reply["choices"][0]
    content = choice["message"]["content"] or ""
    # A reasoning model can spend the whole budget thinking and answer nothing.
    if choice.get("finish_reason") == "length" or not content.strip():
        raise IncompleteReply(f"finish_reason={choice.get('finish_reason')}, {len(content)} chars")
    return content


def load_bank() -> dict[str, list[str]]:
    if not BANK.exists():
        return {}
    return json.loads(BANK.read_text())["lines"]


def write_bank(spec: dict, lines: dict[str, list[str]]) -> None:
    ordered = {name: lines[name] for name in spec["categories"] if name in lines}
    bank = {"model": spec["model"], "generated": time.strftime("%Y-%m-%d"), "lines": ordered}
    BANK.write_text(json.dumps(bank, indent=2) + "\n")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", action="append", help="category to generate (repeatable)")
    ap.add_argument("--dry-run", action="store_true", help="print the prompts and exit")
    ap.add_argument("--reselect", action="store_true",
                    help="re-filter the replies saved in tools/_staging/barks instead of asking")
    args = ap.parse_args()

    spec = yaml.safe_load(SPEC.read_text())
    names = args.only or list(spec["categories"])
    unknown = [name for name in names if name not in spec["categories"]]
    if unknown:
        sys.exit(f"genbarks: unknown categories: {', '.join(unknown)}")

    veto = frozenset(spec.get("veto") or [])
    lines = load_bank()
    STAGING.mkdir(parents=True, exist_ok=True)
    failed: list[str] = []
    for name in names:
        category = spec["categories"][name]
        messages = build_messages(spec, category)
        if args.dry_run:
            print(f"== {name}\n{messages[1]['content']}\n")
            continue
        saved = STAGING / f"{name}.txt"
        if args.reselect:
            if not saved.exists():
                print(f"{name}: no saved reply to reselect from", file=sys.stderr)
                failed.append(name)
                continue
            content = saved.read_text()
        else:
            try:
                content = ask(spec, messages)
            except (urllib.error.URLError, TimeoutError, KeyError, json.JSONDecodeError,
                    IncompleteReply) as err:
                print(f"{name}: request failed: {err}", file=sys.stderr)
                failed.append(name)
                continue
            saved.write_text(content)
        kept, dropped = select(category["seeds"], parse_reply(content),
                               spec["keep"], spec["max_chars"], veto)
        lines[name] = kept
        print(f"{name}: kept {len(kept)} ({len(kept) - len(category['seeds'])} new), "
              f"dropped {len(dropped)}")
        for line, reason in dropped:
            print(f"    - {reason}: {line!r}")

    if args.dry_run:
        return
    write_bank(spec, lines)
    print(f"wrote {BANK.relative_to(ROOT)}")
    if failed:
        sys.exit(f"genbarks: no reply for {', '.join(failed)}; rerun with --only")


if __name__ == "__main__":
    main()
