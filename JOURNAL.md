# Journal

Append-only, reverse-chronological. Newest entries at the top. This is the raw
material for the TNG Deep Dive: decisions, surprises, what broke, exact
commands.

## 2026-09-22 19:57 CDT: M4 Stage 1, the rest of the cast

**What.** Stage 1 now has its full design cast: the Spam Recruiter (a
ranged thrower), The Unpaid Take Home (the stage boss) and coffee pickups.
Worked autonomously while Matt was away; every judgment call is listed below
so he can overrule any of them.

**New sim pieces.** Projectiles (`projectiles.ts`): a card launches on the
first active tick of the toss, flies 3.2 px a tick along the thrower's depth
line, and hits the first vulnerable opponent it reaches. Hits go through the
same `applyHit` as melee, so hitstun, score, KO events and TOKEN's Guard
intercept all work for free. Pickups (`pickups.ts`). Boss reinforcements
(`boss.ts`). Armor as a per-kind flag in `combat.ts`.

**Assumptions made without Matt (overrule freely).**

- A card flies at 40 px height with 20 px clearance, so a jump clears it and
  a sidestep of one depth band dodges it. Classic belt-brawler rule; it makes
  the Recruiter a positioning test, not a damage tax.
- The Recruiter holds about 100 px away, backs off inside 48 px and never
  throws from point blank. Without the back-off, mashing stunlocked it just
  like the old ATS.
- The Take Home is armored only mid-swing (it takes damage but is not
  interrupted). Outside a swing it flinches like anyone. Full armor made it a
  wall; no armor made it an ATS with more hp.
- Scope creep: one ATS per threshold (2/3 and 1/3 hp), first from behind,
  then from ahead. Two per threshold was the first draft; numbers below.
- Coffee heals 30, only for Matt, and only when he is hurt, so a full-health
  player does not waste it.
- Name on the boss bar: THE UNPAID TAKE HOME.

**The bot had to learn to dodge.** With the boss in, SHARP solo died on 10 of
10 seeds: the frame-perfect bot mashed straight into armored slams. A human
sees the arms go up and steps aside, so the bot now does too (`dodge()` in
`bot.ts`: sidestep one band when an armored enemy nearby is winding up, or a
card is incoming on its line). First version jittered: it picked the
sidestep direction from its own depth instead of the attacker's, oscillated
at z 42 and stayed inside the hit band. Fixed and pinned by a test (steps
off the line on a slam, takes no damage).

**Sweep** (10 seeds, 300 s budget, final code):

| Setup | Cleared | Avg hp | Min hp |
|---|---|---|---|
| SHARP solo, 2 adds per call, no dodge | 0/10 | - | - |
| SHARP solo, 2 adds per call, dodge | 9/10 | - | - |
| CASUAL solo, 2 adds per call, dodge | 5/10 | - | - |
| SHARP solo (chosen: 1 add per call) | 10/10 | 64 | 38 |
| SHARP + TOKEN | 10/10 | 88 | 44 |
| CASUAL solo | 6/10 | 21 | 0 |
| CASUAL + TOKEN | 10/10 | 62 | 42 |

Reading: the stage is beatable by a perfect player alone on every seed, a
first-timer with TOKEN always gets through with a margin, and a first-timer
alone loses about 4 in 10, nearly all on the boss. That is the intended
shape for "the AI sidekick matters". The CASUAL band tests from the last
entry still pass unchanged.

**Art.** Spam Recruiter and Take Home designs and sheets, coffee and card
props, all through `tools/genassets.py`. The Take Home walk and knockdown
drifted peach against the manila-yellow model sheet, so I added an explicit
colour line to both prompts and regenerated. The knockdown came back right.
The walk came back olive-green, so instead of re-rolling I recoloured it by
script: pixels with saturation above 0.3 and hue 45 to 90 degrees moved to
hue 44 (saturation x1.3, value x1.1); peach pixels (hue 12 to 30, value
above 0.8) moved to hue 42. Reads correctly at 1x, slightly paler than idle.
The v1 and v2 sheets are kept in the session scratchpad, not the repo.

**Browser check.** Playwright against the dev server, teleporting through
the stage by editing the live `world`: coffee drawn and healed 40 to 70,
a card in flight drawn at throwing height with its shadow, the boss bar
named and filling, scope creep spawning one ATS at 60 percent. No page
errors. The HUD's 8 px system monospace smears E into C in headless
Chromium (the old TOKEN label does it too); the bitmap-font item in ROADMAP
covers it.

**Follow-ups.** Matt's playtest decides the CASUAL-solo loss rate. A
per-character shared palette in the pipeline would remove the recolour step.

## 2026-09-22 19:43 CDT: Stage 1 difficulty

**What.** The bot that proves beatability plays frame-perfect, so it said
nothing about difficulty. I split it into skill profiles: SHARP (the old
bot, still the must-always-win floor) and CASUAL, a first-time player who
reacts a quarter second late (15 ticks), mashes at human speed (every 7
ticks), lines up by eye (4 px extra depth slack, so some swings miss) and
never uses the special. Then measured before touching anything.

**The finding.** Across 10 seeds, every one of 120 enemy swings against
CASUAL was interrupted before it landed. ATS startup was 20 ticks; Matt's
jab is 3. Even a player 15 ticks late turns and hits first, so any enemy in
front of Matt is stunlocked, and one behind him is too slow to matter.
Enemy cooldown made no difference at all, because enemies spent the stage
in hitstun, never on cooldown.

**Sweep** (10 seeds each, average Matt hp at the end, all runs cleared):

| shred startup | SHARP solo | CASUAL solo | CASUAL + TOKEN |
|---|---|---|---|
| 20 (old) | 92 | 100 | 99 |
| 14 | 84 | 68 | 99 |
| 12 | 76 | 52 | 86 |
| 10 (chosen, cooldown 45-80) | 76 | 44 | 68 |

**Assumptions made without Matt.** Stage 1 is the tutorial: CASUAL with
TOKEN should clear every seed at hp 40-80, CASUAL solo should mostly clear
but barely. 10 ticks (167 ms) of wind-up is short; the approach walk is the
real telegraph, and the wind-up frames scale automatically from `startup`.
If it plays unfair on a phone, the next lever is wave size, not speed.

**Alternatives rejected.** Super armor on ATS (removes the satisfaction of
the chain on the most basic enemy); making enemies avoid attacking a
player who faces them (smarter, but hides the problem that the swing was
simply too slow).

## 2026-09-22 19:39 CDT: TOKEN joins the fight (M3)

**What.** TOKEN is a second fighter on Matt's team, piloted by
`src/sim/sidekick.ts`, which produces an `InputFrame` each tick exactly like
a player's pad. It has a two-hit zap chain that only continues when the
first zap lands, three standing orders, a reboot after a KO, and speech
bubbles driven by sim events (`world.events`, cleared each step) so the view
never guesses what happened. Enemy AI got depth separation and a side split
while I was in there, because TOKEN made the bunching obvious.

**Assumptions made without Matt (flag any to change):**
- Orders cycle on one key, Q or Tab, plus a cyan pill on the touch pad.
  One button beats a three-way picker on a phone; three orders are few
  enough to cycle.
- Go wild targets the biggest crowd and, after 40% of enemy KOs, remembers a
  phantom it swings at about 2.5 seconds later ("hallucinated that one").
  That is the confidently-wrong joke from DESIGN.md made mechanical.
- Focus doubles TOKEN's damage on the enemy Matt last hit.
- Guard intercepts hits aimed at Matt when TOKEN is within 40 px and in a
  state that could plausibly step in; TOKEN takes half the damage. I chose
  interception over a damage-reduction aura because it is visible: you see
  TOKEN take the hit and say so.
- A KO'd TOKEN reboots after 5 seconds at half health, and never counts
  toward a game over. A permanently dead partner in a four-day game is just
  a worse game.
- Enemies prefer Matt: TOKEN counts as 60 px further away when they pick a
  target, so it cannot tank the whole stage by standing in front.
- Barks are placeholder lines until the M5 bank.

**Measured, not guessed.** A throwaway probe (vitest writing a TSV, since
vitest swallows console output) ran the bot through Stage 1 on several seeds
per order. Without TOKEN, Matt finishes at hp 92 on every seed; with TOKEN,
92 to 100. TOKEN's KOs: wild 3-4, focus 3, guard 0-1. The identical 92 across
seeds says the enemies barely attack, so the RNG never matters: Stage 1 is
too easy, and that is a difficulty problem, not a TOKEN problem (ROADMAP,
tuning notes).

**Bugs found.**
- Enemy overlap: two bots ended every run on the same pixel. Separation only
  applied while they were on cooldown; applying it always took overlap to 0.
- The side split never fired for two enemies: a "switch if the other side is
  lighter by a margin" rule compares 1 against 1 forever. Replaced with id
  seniority: an enemy only counts the crowd of enemies older than itself,
  so the second one sees an occupied flank and goes round. Now pinned by
  `ai.test.ts`.
- TOKEN vanished while rebooting because the corpse blink applied to every
  dead fighter. Only enemy corpses blink now; TOKEN shows a loading frame.
- An existing test ("enemies approach and attack an idle player") started
  failing because TOKEN now protected the idle player. The test was right
  about its own subject, so it opts out of TOKEN (`{ sidekick: false }`).

**Follow-ups.** A sloppier bot to tune difficulty against; the real bark
bank; a real-phone check of the order pill position.

## 2026-09-22 19:26 CDT: touch controls

**What.** Phones and tablets get an on-screen pad: a floating 8-way stick on
the left half, Genesis A/B/C buttons on the right, multi-touch by pointer id
so one thumb walks while the other punches. Keyboard and touch merge into one
`InputFrame` per tick, so the sim did not change at all. The pure part
(`touch-state.ts`: 45 degree sector quantising, pointer ownership, the same
tap latch as the keyboard) is unit tested; the DOM part is verified by
Playwright driving CDP touch events against the dev server.

**Assumptions made without Matt (he asked me to proceed and flag them):**
- Button order and roles follow Streets of Rage 2: A special, B attack
  (largest, under the thumb), C jump.
- Portrait is supported rather than forcing a rotate prompt: game on top at
  full width, pad below. Landscape puts the pad in the pillarbox bars; the
  buttons overhang the right edge of the play field, so they go translucent
  there.
- On Android the first touch asks for fullscreen plus a landscape lock, once
  (a player who leaves fullscreen is not dragged back). Momentum does the
  same.
- The pad shows on a coarse pointer or the first touch, and hides on a
  keypress unless the device is touch-first, so touch laptops start on keys.
- A 40 ms vibration when Matt loses health (Android only; iOS has no API).
- Restart is any button after a one second pause, replacing Enter-only.

**Bugs found by the playtest.**
- The overlay's class was `touch`, and the touch-mode flag on `<html>` was
  also `touch`, so the overlay's `display: none; position: fixed` hit the
  root element and the whole page vanished on phones. Renamed the overlay to
  `pad`. Only a real render catches that one; unit tests cannot.
- First fight test scored 0 and I nearly chased an input bug. Isolating one
  tap at a time showed every tap reaching the sim as an attack; the script
  had walked Matt into the bots while mashing. With a fair setup, touch
  cleared both bots (1660) and keyboard scored 970 on the same timing.
- The HUD score read "000068" in screenshots when it was 0: the blurry 8 px
  browser font. Added a dev-only `window.__otwGame` handle so playtests read
  the sim instead of pixels. The bitmap font item gets more urgent.

**Not verified:** real devices. Emulated Chromium says nothing about iOS
Safari's gesture quirks or how the layout feels in a hand.

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
