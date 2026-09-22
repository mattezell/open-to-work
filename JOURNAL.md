# Journal

Append-only, reverse-chronological. Newest entries at the top. This is the raw
material for the TNG Deep Dive: decisions, surprises, what broke, exact
commands.

## 2026-09-22 18:50 CDT: asset pipeline adapted, design candidates rendered

**What.** Ported an earlier game's `genassets.py`/`pixelize.py`. Changes: the
per-game palette is gone in favour of a Genesis snap (median-cut to 15
colours per sheet, then every channel onto the 8-level 9-bit grid, one
palette line per sheet); assets can list `refs` that are attached to codex
with `-i`; a new `design` kind stops after the cutout at full resolution;
prompt placeholders are any string key in the style block (`{matt}`,
`{token}`). Rendered 3 likeness candidates for Matt (from his two photos)
and 2 for TOKEN in tmux session `otw-art`: 5/5 succeeded, 73 to 81 s each,
no retries, no signals.

**Why.** Approved designs become the reference images for every animation
sheet, which should hold the likeness better than text alone.

**Gotcha.** `codex exec -i` is variadic (`<FILE>...`), so it must come after
the positional prompt or it swallows the prompt as another image path.

**Alternatives rejected.** Snapping to one fixed game-wide palette (the
earlier game's route): Genesis hardware gives each sprite its own 15-colour line,
so a per-sheet palette is both more authentic and less speckly.

## 2026-09-22 18:36 CDT - Codex imagegen probe: first sheet, first try

**What:** one `codex exec` call (Codex CLI 0.155.1, built-in image_gen,
ChatGPT login) for a 4-frame Genesis-style sheet: idle, walk, punch, kick.
51 seconds, 2172x724 RGBA, 67 percent of pixels at alpha 0 (real
transparency, no chroma key needed). Saved as
`docs/probe-2026-09-22-first-sheet.png`.

```
codex exec --skip-git-repo-check -s workspace-write -C <dir> \
  'Use the built-in image_gen tool to create ONE image: a 16-bit Sega Genesis
   era beat-em-up sprite sheet, side view facing right, ... 4 frames in a
   single horizontal row: idle, walk, punch, kick ... fully transparent
   background. Do not end your turn while the render is in flight ...' \
  </dev/null
```

**Result:** the character holds across frames (face, beard, hoodie, sneakers),
poses read clearly, outline and palette are on-genre. Frames are not on a
fixed grid and heights differ (the kick crouches), so the wiki's
largest-blob, one-scale, one-anchor normalisation is still required.

**Surprise:** better than expected for fighting animation, which was the
biggest risk in the design. The procedural fallback is probably not needed.

## 2026-09-22 18:35 CDT - Day 1: laid off, pitched, approved

**What:** Matt's role was eliminated this morning (Tuesday
2026-09-22); his open-to-work post went up and his former CEO reposted it with
"We could not have done it without you." Same afternoon, in a fresh Opus 5.5
session, Matt asked for something fun that shows both his value and the
model's. The pitch: a co-op beat 'em up where the job hunt is the enemy and
an AI is your player 2. His reply: "JFC I love it."

**Why this concept:** it combines what made his two best games work.
Momentum (`~/w/portals`) is fun because of one tight mechanic; Craft Beer
Hero landed because it was local, true, and affectionate. His retro loves
(TMNT, Battletoads, Streets of Rage, ToeJam and Earl, MK) point to a belt
scroller, which is also the most scope-safe genre for four days.

**Alternatives considered and rejected:**
- A fighting game (MK / SF): lives or dies on balance, not a four-day job.
- An Echo the Dolphin style explorer: atmosphere-first, wrong register.
- Publishing his agent setup (`matts-claudes`) as the showcase: most direct
  proof of value, least fun.
- Continuing the plain Opus 5.5 benchmark: reads as a benchmark, not a
  showcase. Folded in instead: the opus55 journal keeps model notes.

**Human steer, logged:** Matt corrected the day (Tuesday, not Monday) and
pointed at his own codex imagegen sprite pipeline instead of the conjure
video route I had proposed. The wiki page he meant was on this box
(`projects` wiki), no SSH needed.

**Follow-ups:** codex probe result, sidekick identity, dependency approval.
