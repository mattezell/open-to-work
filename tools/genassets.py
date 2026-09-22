#!/usr/bin/env python3
"""Generate OPEN TO WORK's art from tools/assets.yaml via codex's image_gen tool.

    python3 tools/genassets.py --list
    python3 tools/genassets.py --group hero --jobs 3
    python3 tools/genassets.py --all --skip-existing --jobs 3
    python3 tools/genassets.py --only matt_design_a --dry-run

Pipeline per asset:

    manifest prompt
      -> codex exec (built-in image_gen, chroma-key background for sprites)
      -> remove_chroma_key.py            (alpha cutout)
      -> tools/pixelize.py               (downsample + snap to the Genesis 9-bit grid)
      -> assets/...

An asset may list `refs` (repo-relative image paths) that are attached to the
codex prompt with -i: approved character designs, likeness photos. Kind
`design` stops after the cutout and keeps full resolution; approved designs
become the refs for every later animation sheet.

Raw generations are kept under tools/_staging/ so a bad post-process can be
re-run without paying for the image again.
"""

from __future__ import annotations

import argparse
import concurrent.futures as futures
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("genassets: PyYAML is required")

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "tools" / "assets.yaml"
STAGING = ROOT / "tools" / "_staging"
PIXELIZE = ROOT / "tools" / "pixelize.py"
CODEX_HOME = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex"))
DECHROMA = CODEX_HOME / "skills" / ".system" / "imagegen" / "scripts" / "remove_chroma_key.py"

CODEX_TIMEOUT = 900


# --------------------------------------------------------------------------
# prompt assembly
# --------------------------------------------------------------------------

def collapse(text: str) -> str:
    return " ".join(str(text).split())


def build_prompt(style: dict, asset: dict) -> str:
    kind = asset["kind"]
    keys = {k: collapse(v) for k, v in style.items() if isinstance(v, str)}
    body = collapse(asset["prompt"]).format(**keys)
    parts = [collapse(style["world"]), body]
    if kind in ("strip", "icon", "design"):
        parts.append(collapse(style["sprite"]))
    else:
        parts.append(collapse(style["painted"]))
    return "\n\n".join(parts)


def build_instruction(asset: dict, prompt: str, raw_name: str) -> str:
    return (
        "Use the imagegen skill's built-in image_gen tool to generate exactly ONE image.\n"
        "Do not generate variants. Do not ask questions. Do not edit any project files.\n"
        f"Requested size: {asset.get('size', '1024x1024')}.\n"
        f"{_refs_note(asset)}\n"
        "IMAGE PROMPT:\n"
        f"{prompt}\n\n"
        "WAIT for the image_gen tool call to actually return a finished image. "
        "Do not end your turn while a render is still in flight. "
        "Once the file exists, copy it into the current working directory as "
        f"exactly `{raw_name}` (use `cp`), verify with `ls -l` that the copy is "
        "present and non-empty, and print its absolute path as your final "
        "message. Do nothing else."
    )


def _refs_note(asset: dict) -> str:
    if not asset.get("refs"):
        return ""
    return ("The attached image(s) are REFERENCES. Pass them to image_gen as "
            "reference images and follow them for the character's identity, "
            "proportions and colours.\n")


def ref_paths(asset: dict) -> list[str]:
    paths = [ROOT / r for r in asset.get("refs", [])]
    missing = [str(p) for p in paths if not p.exists()]
    if missing:
        raise FileNotFoundError("missing refs: " + ", ".join(missing))
    return [str(p) for p in paths]


# --------------------------------------------------------------------------
# generation
# --------------------------------------------------------------------------

def run_codex(work: Path, instruction: str, refs: list[str], log: Path) -> bool:
    cmd = [
        "codex", "exec",
        "--skip-git-repo-check",
        # NOT --ephemeral: that suppresses the persisted generated_images
        # directory the built-in image_gen tool writes into, and codex then
        # ends its turn announcing a render it can no longer find.
        "--dangerously-bypass-approvals-and-sandbox",
        "-C", str(work),
        instruction,
    ]
    if refs:
        # -i is variadic, so it goes after the positional prompt.
        cmd += ["-i", *refs]
    with log.open("w") as fh:
        try:
            proc = subprocess.run(
                cmd, stdout=fh, stderr=subprocess.STDOUT,
                stdin=subprocess.DEVNULL,
                timeout=CODEX_TIMEOUT, check=False,
            )
        except subprocess.TimeoutExpired:
            fh.write("\n[genassets] TIMEOUT\n")
            return False
    return proc.returncode == 0


def find_raw(work: Path, raw_name: str) -> Path | None:
    exact = work / raw_name
    if exact.exists() and exact.stat().st_size > 0:
        return exact
    pngs = sorted(
        (p for p in work.glob("*.png") if p.stat().st_size > 0),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    return pngs[0] if pngs else None


# --------------------------------------------------------------------------
# post-processing
# --------------------------------------------------------------------------

def dechroma(src: Path, dst: Path) -> bool:
    """Isolate the subject.

    Uses our own border-flood cutout rather than the imagegen helper's global
    colour key: image_gen returns a transparent PNG about as often as it
    honours the chroma-key instruction, and a global key applied to an
    already-transparent image deletes the sprite instead of the background.
    """
    r = subprocess.run(
        [sys.executable, str(PIXELIZE), "cutout",
         "--input", str(src), "--out", str(dst),
         "--tolerance", "46", "--feather", "1"],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        print(f"  ! cutout failed: {(r.stdout + r.stderr).strip()[:300]}")
        return False
    return dst.exists()


def pixelize(args: list[str]) -> bool:
    r = subprocess.run([sys.executable, str(PIXELIZE)] + args,
                       capture_output=True, text=True)
    if r.returncode != 0:
        print(f"  ! pixelize failed: {r.stderr.strip()[:300]}")
        return False
    return True


def post_process(asset: dict, raw: Path, work: Path) -> bool:
    out = ROOT / asset["out"]
    out.parent.mkdir(parents=True, exist_ok=True)
    kind = asset["kind"]

    if kind in ("still", "backdrop", "material"):
        # Stays painted. Only resized, and lightly graded by pixelize's
        # saturation/contrast pass with the palette snap disabled.
        return pixelize([
            "image",
            "--input", str(raw), "--out", str(out),
            "--height", str(_height_for(asset, raw)),
            "--no-palette", "--no-trim",
            "--alpha-threshold", "0",
            "--saturation", "1.06", "--contrast", "1.04",
        ])

    cut = work / (raw.stem + ".cut.png")
    if not dechroma(raw, cut):
        return False

    if kind == "design":
        shutil.copy2(cut, out)
        return True

    colors = str(asset.get("colors", 15))
    bright = str(asset.get("brightness", 1.08))

    if kind == "strip":
        return pixelize([
            "strip",
            "--input", str(cut), "--out", str(out),
            "--genesis-colors", colors,
            "--frames", str(asset["frames"]),
            "--frame-width", str(asset["frame_width"]),
            "--frame-height", str(asset["frame_height"]),
            "--anchor", asset.get("anchor", "bottom"),
            "--outline", asset.get("outline", ""),
            "--saturation", "1.18", "--contrast", "1.10",
            "--brightness", bright,
        ])

    return pixelize([
        "image",
        "--input", str(cut), "--out", str(out),
        "--genesis-colors", colors,
        "--height", str(asset.get("width", 64)),
        "--outline", asset.get("outline", ""),
        "--saturation", "1.15", "--contrast", "1.08",
        "--brightness", bright,
    ])


def _height_for(asset: dict, raw: Path) -> int:
    """Painted plates are specified by width; derive the height from the source."""
    from PIL import Image
    w = int(asset.get("width", 1920))
    with Image.open(raw) as im:
        sw, sh = im.size
    return max(1, round(sh * w / sw))


# --------------------------------------------------------------------------
# driver
# --------------------------------------------------------------------------

def generate(style: dict, asset: dict, args) -> tuple[str, bool, str]:
    aid = asset["id"]
    out = ROOT / asset["out"]
    if args.skip_existing and out.exists():
        return aid, True, "skipped (exists)"

    work = STAGING / aid
    work.mkdir(parents=True, exist_ok=True)
    raw_name = f"{aid}.raw.png"
    raw = work / raw_name
    log = work / "codex.log"

    prompt = build_prompt(style, asset)
    (work / "prompt.txt").write_text(prompt + "\n")

    if args.dry_run:
        return aid, True, f"dry-run ({len(prompt)} chars)"

    reuse = args.reuse_raw and raw.exists() and raw.stat().st_size > 0
    if not reuse:
        for attempt in range(1, args.retries + 1):
            t0 = time.time()
            ok = run_codex(work, build_instruction(asset, prompt, raw_name),
                           ref_paths(asset), log)
            found = find_raw(work, raw_name)
            if ok and found:
                if found != raw:
                    shutil.copy2(found, raw)
                took = time.time() - t0
                print(f"  . {aid}: generated in {took:.0f}s")
                break
            print(f"  ! {aid}: attempt {attempt}/{args.retries} failed (see {log})")
            if attempt == args.retries:
                return aid, False, "generation failed"
            time.sleep(4 * attempt)
    else:
        print(f"  . {aid}: reusing staged raw")

    if not post_process(asset, raw, work):
        return aid, False, "post-process failed"
    return aid, True, str(Path(asset["out"]))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--manifest", type=Path, default=MANIFEST)
    ap.add_argument("--group", action="append", default=[])
    ap.add_argument("--only", action="append", default=[])
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--skip-existing", action="store_true")
    ap.add_argument("--reuse-raw", action="store_true",
                    help="re-run only the post-process on already staged images")
    ap.add_argument("--jobs", type=int, default=3)
    ap.add_argument("--retries", type=int, default=2)
    args = ap.parse_args()

    data = yaml.safe_load(args.manifest.read_text())
    style = data["style"]
    assets = data["assets"]

    if args.list:
        for a in assets:
            mark = "x" if (ROOT / a["out"]).exists() else " "
            print(f"[{mark}] {a['id']:<22} {a['group']:<10} {a['kind']:<9} {a['out']}")
        return

    selected = assets
    if args.only:
        selected = [a for a in assets if a["id"] in args.only]
    elif args.group:
        selected = [a for a in assets if a["group"] in args.group]
    elif not args.all:
        ap.error("choose --all, --group GROUP, --only ID, or --list")

    if not selected:
        sys.exit("genassets: nothing selected")

    STAGING.mkdir(parents=True, exist_ok=True)
    print(f"genassets: {len(selected)} asset(s), {args.jobs} job(s)\n")

    ok_count = 0
    fail: list[str] = []
    with futures.ThreadPoolExecutor(max_workers=max(1, args.jobs)) as pool:
        jobs = {pool.submit(generate, style, a, args): a["id"] for a in selected}
        for fut in futures.as_completed(jobs):
            aid, ok, detail = fut.result()
            print(f"{'OK  ' if ok else 'FAIL'} {aid:<22} {detail}")
            if ok:
                ok_count += 1
            else:
                fail.append(aid)

    print(f"\ngenassets: {ok_count}/{len(selected)} succeeded")
    if fail:
        print("failed: " + ", ".join(sorted(fail)))
        sys.exit(1)


if __name__ == "__main__":
    main()
