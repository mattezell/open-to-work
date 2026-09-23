# Journal

Append-only, reverse-chronological. Newest entries at the top. This is the raw
material for the TNG Deep Dive: decisions, surprises, what broke, exact
commands.

## 2026-09-22 19:20 CDT: M1 playable on the dev server

**What.** Phaser view over the sim: sprites from the generated sheets,
bottom-anchored at the feet and sorted by depth, flipped for facing, shadows,
invulnerability flicker, HP bar, score, GO prompt. A pure `poseFor(fighter)`
maps sim state to sheet and frame; its test runs whole bot playthroughs and
asserts every pose names a real sheet and frame. ATS BOT sheets rendered
5/5. Served over HTTPS on my private network for phone testing.

**Headless playtest found a real input bug.** The box has no X server, so I
drove the game with Playwright's headless Chromium and read screenshots. 12
jab taps scored nothing. Cause: input was a snapshot of held keys taken once
per sim tick, and a quick tap (down and up inside one 16 ms tick) was never
held at snapshot time. Humans tapping fast on a high-refresh screen would
lose presses the same way. Fix: a key pressed since the last snapshot counts
as held for exactly one snapshot. After the fix the same script scored 548
and dropped a bot.

**Seen and deferred:** enemies stack on one spot, colours drift between a
character's sheets (per-sheet palettes), HUD font blurs. All in ROADMAP
tuning notes.

## 2026-09-22 19:05 CDT: sim core green, the bot found a real bug, strip slicing fixed

**What.** Deterministic sim in `src/sim/` (pure TS, fixed 60 Hz, seeded
mulberry32 on the world, input as data, enemies drive themselves through the
same `InputFrame` a player uses). Belt movement, a jab-jab-haymaker chain
that only advances on contact, a jump kick, a health-cost special with
invulnerability, global hit-stop that still buffers presses, knockdown with
getup invulnerability, wave camera lock with a GO prompt. 23 tests including
a Momentum-style beatability bot across 5 seeds.

**The bot earned its keep on day one.** It kept dying on seed 3. Cause: with
the camera locked for a wave, the player was pinned at the screen edge and an
ATS standing just off screen (dx 36, inside its reach) kept hitting him. The
player cannot see or reach that enemy, so it is unfair, not hard. Fix: enemies
pick the flank that is on screen, and may only start an attack while on
screen. The first regression test I wrote for it passed with the fix
reverted (a mutation check caught that), so it was replaced with a
deterministic pinned-edge scenario that fails without the fix.

**Art.** All 8 Matt sheets rendered first try (64 to 76 s each). Two
post-processing bugs, both fixed with `--reuse-raw` and zero regenerations:

1. Scale drift between sheets. Each sheet was scaled to fill its own frame,
   so Matt changed size between idle and knockdown. Fix: `target_height`
   per asset pins the body height across all of a character's sheets, and
   `x_anchor: mass` centres frames on the alpha centroid so a punch does
   not shove the body backwards.
2. Clipped frames. Codex does not space poses evenly; the lying-down
   knockdown frame and the flying kick crossed the equal-slot boundary and
   got cut in half. Poses also overlap in x, so column gaps cannot separate
   them. Fix: find the N largest connected blobs across the whole strip and
   order them left to right, falling back to slots only when the strip does
   not look like N figures. 0.3 s per strip.

Also dropped saturation for Matt's sheets from 1.18 (inherited from
an earlier game's neon palette) to 1.0: the brick-red tee was reading as fire-truck
red. Saturation and contrast are now per asset.

**Correction on record.** I told Matt Momentum was not on this box. It is
`~/w/portals`; the wiki had it and `tng-wiki search` did not surface it.
Captured an alias map in my wiki inbox.

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
