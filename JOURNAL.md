# Journal

Append-only, reverse-chronological. Newest entries at the top. This is the raw
material for the TNG Deep Dive: decisions, surprises, what broke, exact
commands.

## 2026-09-23 05:50 CDT: playtest item 2, a pixel font

**What.** Every `this.add.text` is now bitmap text in a font drawn for the
game: `src/view/pixel-font.ts` holds 95 glyphs as `#`/`.` rows (5x7 caps,
one descender row, 6x9 cell), `src/view/pixel-text.ts` bakes them into a
canvas texture per colour and registers a Phaser RetroFont. Banners became
`PixelBanner` (title line 2x, body 1x, centred as a block); the bark bubble
became `PixelBubble` (text on an ink rectangle, since BitmapText has no
background colour). 11 new tests.

**Why.** Matt's playtest: the 8px text is blurry. Browser text at 8px is
anti-aliased, then `Scale.FIT` stretches the 320px canvas by a fractional
factor; no `resolution` setting fixes that. Bitmap glyphs on whole game
pixels under `pixelArt: true` stay nearest-neighbour sharp at any size.

**Assumptions (logged per the standing instruction).**
- Hand-drawn glyphs in the repo rather than a downloaded font: no new
  dependency or licence question, and the table is testable. Shapes follow
  the classic 5x7 LCD character set.
- Colours are baked per texture, not tinted: Phaser's canvas renderer does
  not tint bitmap text, and a phone that falls back to canvas would show
  every pop in cream. Four small textures at most.
- A one-pixel ink drop shadow baked into every glyph. The first screenshots
  showed cream titles fighting the tower's sunset; the shadow sits in the
  cell's spare column and row, so metrics did not change.
- Banners split at the first blank line: title 2x, body 1x. At 2x the old
  single-object banners overflowed ("next: the take-home tunnel" is 311 px
  at 12 px a letter); the title/body split reads more like an arcade card.
- The ending caption was re-spaced inside its 58 px plate (title at +4,
  lines at +24) because the new line height pushed the hint into the score.
  Item 5 redoes this screen anyway.

**What broke.** `RetroFont.Parse` returns the whole cache entry
(`{data, texture, frame}`), but its typings say it returns the font data.
Wrapping it again in `{data: ...}` gave glyphs with no `kerning` table and
a `Cannot read properties of undefined (reading '84')` deep in
`GetBitmapTextSize` on the first `setText`. Fix: add the returned entry to
the cache as is, typed `unknown`, with a comment. Worth a gotcha note.

**Rejected.** Tint on one white texture (canvas renderer). A web font such
as Press Start 2P via CSS (network fetch, FOUT, still anti-aliased at
fractional scale). Keeping `add.text` and raising `resolution` (the blur
is the scaler, not the resolution).

**Verified.** Playwright at 3x (960x672), WebGL renderer: street bark,
tower intro card, round card and boss bar, tunnel intro, CRASH and CLEAR
pops, ending caption. No console errors. `npm run check`: 208 TS tests,
20 tools tests.

## 2026-09-23 05:37 CDT: playtest fixes 1, flicker, the Panel, tunnel feedback

**What.** Matt's first playtest (Tue night) came back with a list; he
approved an order of seven items, one commit each. This is item 1: the
quick fixes.

- *Special flicker.* The view blinked any fighter with `invuln > 0`, and
  the special grants invulnerability through its spin, so Matt strobed on
  every L. The blink is now a view rule (`blinkedOut` in `stage-view.ts`):
  recovery only, never during the special, never a seated panelist. The sim
  is unchanged; invulnerability still works the same.
- *The Panel strobing.* Two causes, both found by screenshot, not by
  reading code. A panelist knocked down blinked through its getup (the
  cause I had guessed), and a beaten panelist is `state: 'dead'`, which
  `isFadingCorpse` blinked forever, since seated corpses are never removed.
  The second only showed up because the probe's round 2 shot was missing
  the Screener. Both now spare seated fighters.
- *The pile of desks.* The desks were 8 px apart in x and 18 px in depth,
  with 80 px sprites. Now a diagonal 60 px apart: Screener front left
  (z 46), Tech Lead middle, Hiring Manager back right (z 10). The desk line
  used to be the leftmost desk of all three, which would have left the
  back desks out of reach once spread; it now counts only the interviewers
  still to come, so each win opens up the room. The Panel tests now read
  the seating from `STAGE_3` instead of a copy, so they cover the real
  layout.
- *Hot seat marker.* A pool of light under the hot seat and a bobbing arrow
  over its head. The first cut put the arrow exactly under TOKEN's speech
  bubble; raised and drawn above it.
- *Tunnel clear vs crash.* The complaint was that clearing the big obstacle
  and hitting it both look like clipping. Measured: the hurdle art is 20 px
  tall but the sim clears at 16, and the three per-lane hurdles stack into
  one column where the front lane is drawn over Matt mid-jump. Fixes: a
  CLEAR +200 pop and chime on `cleared-hazard` (which was silent), CRASH -15
  with a shake and red flash on a crash, and the lanes in front of Matt go
  see-through as he passes. Difficulty untouched, as Matt asked.

**Assumptions.** Opening the room as each interviewer falls (Matt can walk
past a slumped desk) rather than keeping all three desks as the wall. The
hurdle fix is a view fix, not new art or a new clear height. The CLEAR pop
covers walls dodged as well as hurdles jumped.

**Alternatives rejected.** Drawing Matt over every hazard once he is high
enough (tried, then removed: with the front lanes faded it changed nothing
and made him look like he was standing on the stack). Raising the clear
height to match the art (makes the stage harder, which Matt did not want).

**Verified.** `npm run check` green (197 TS tests, 20 tools tests).
Playwright probe on the dev server: the Screener's sprite stays
visible through 20 samples of getup invulnerability, Matt stays visible
through a special, the round 2 screenshot shows the beaten Screener
slumped in place, a jumped hurdle pops CLEAR +200 with hp unchanged, a
crash pops CRASH -15. Not heard: the new chime.

## 2026-09-22 20:55 CDT: M5, the bark bank and the synth

**What.** TOKEN now has 144 lines across 18 moments, generated by
qwen3.8-27b on this box and reviewed, and the game has music and sound
effects synthesised in the browser. M5 was scheduled for Thursday. Built
unattended; assumptions below.

**The bark bank.** `tools/genbarks.py` reads `tools/barks.yaml` (persona,
rules, 18 moments with three hand-written seeds each), asks llama-swap for 14
candidates per moment, filters them, and writes `src/view/barks.json`. The
seeds are the old inline lines from `barks.ts`, so nothing TOKEN used to say
was lost. 54 seeds plus 90 generated lines; 14 generated lines vetoed in
review.

- *Failure 1: a reasoning model starved of answer tokens.* First run at
  `max_tokens: 1500` with `reasoning_effort: low`: 7 of 18 moments came back
  with empty content and 2 cut off mid-array. qwen3.8 spends its budget
  thinking before it answers, and `low` does not mean short. Worse, the first
  cut of the tool treated an empty reply as zero candidates and silently
  wrote seeds-only moments. Fixed both: `max_tokens: 8000`, and an
  `IncompleteReply` error on `finish_reason == "length"` or empty content, so
  a starved moment is reported as failed and the run exits non-zero. Rerun
  with `--only` for those moments.
- *Failure 2: YAML flow sequences.* The first `barks.yaml` wrote seeds as
  `[a, b, c]`; lines with commas and question marks parsed wrong. Now block
  style with every seed JSON-quoted, checked against the old `barks.ts`.
- *Curation as data.* Review is a `veto:` list in the yaml, not hand edits
  to the JSON. Raw replies are kept in `tools/_staging/barks/` (gitignored),
  so `--reselect` refills vetoed slots from spare candidates without calling
  the model. The bank can be regenerated and the curation survives.
  What got vetoed: five 404 jokes (the model's favourite), lines off context
  ("Deleting my resume now." as a checkpoint line), and flat ones.
- *Tests on the committed bank*, not just the tool: at least 3 lines per
  moment, at most 40 characters, plain ASCII, no repeats, no real company names.

**The synth.** `src/view/music.ts` is the score as data and is unit-tested;
`src/view/audio.ts` is the WebAudio side. Four voices (square bass through a
closing low-pass, square lead, sine kick, noise snare and hat), a lookahead
scheduler on the audio clock, 18 effect recipes. The sim gained one event,
`hit`, so the view plays hit sounds from facts instead of diffing hp.

**Assumptions made without Matt:**

1. Music is written, not generated: four two-bar loops in tracker notation.
   A model could write these too, but a funk bass line is a taste call and
   short enough to write directly.
2. Synthesis, not samples: no audio files, no licensing questions, matches
   the Momentum precedent named in DESIGN.
3. Mute on M (free key), remembered in localStorage; touch players get a
   SOUND pill at top centre, clear of the HUD corners and the pad.
4. The tunnel speeds its music with the board speed, capped at 1.35x so
   section 3 does not turn into chipmunk funk.
5. TOKEN's lines stay at 8 per moment. More would repeat less, but each
   extra line is one more to review.

**Verification.** `npm run check` green (typecheck, lint, format, 189
tests, 20 tool tests). Playwright against the dev server, with an
AudioContext spy: nothing plays before the first key; street music books
oscillator and noise voices once it arrives; M suspends the context, stops
new voices, stores `1`, and survives a reload; the tunnel schedules; on an
emulated phone the SOUND pill shows and a tap mutes. Every one of the 18
effects and all 4 tracks fired from the page with no errors.
*Not verified:* how any of it sounds. Headless Chromium has no ears. The
mix levels are a first guess, flagged in ROADMAP for Matt's first listen.

**Tooling gotcha.** Writing `genbarks.py`, the file-writing tool decoded the
`\u2019`-style escapes in the ASCII-normalisation table into the literal
characters, which then broke the "this file is plain ASCII" sweep. Re-escaped
with a script. Worth a line in the Deep Dive: always sweep generated files
for non-ASCII, even when you typed escapes.

## 2026-09-22 20:40 CDT: Stage 3, the Interview Tower, and the ending

**What.** The run is complete end to end: street, tunnel, tower, HIRED.
Stage 3 is back on the belt, on the top floor of an office tower, with
three new enemy rules and The Panel as the final boss. The last hit hands
Matt the offer letter and the run ends on a generated rooftop card. Built
autonomously while Matt was away; assumptions below.

**Shape.** No new sim module this time: the tower is `STAGE_3` on the
brawler, and every new behaviour is a rule the brawler did not have.

- *Heavy* (`KindStats.heavy`, LeetCode Golem): hits without knockdown chip
  1 hp and never stagger. Only the haymaker, jump kick and special hurt.
- *Ghost* (`Fighter.ghost`, `src/sim/ghoster.ts`): ticks out of play.
  `isVulnerable`, TOKEN's targeting and the bot all skip a ghosted
  fighter, so one field covers both the Ghoster and the waiting panelists.
- *Seated* (`KindStats.seated`, `src/sim/panel.ts`): never moves, no
  knockback, corpse stays. `updatePanel` puts the first living panelist in
  the hot seat each tick and holds the rest at `ghost = 1`.
- *Wide projectiles* (`ProjectileDef.wide`): the Tech Lead's sticky-note
  wall ignores depth, so only a jump clears it. It is the one attack in the
  game that teaches jumping.
- `StageDef.endsOnLastWave` and `SpawnDef.inset` (the panel sits at fixed
  screen positions inside the locked camera).

The view keeps its tower rules in a Phaser-free `src/view/stage-view.ts`
(boss bar choice, round cards, the closing prompt, alphas, the retry carry)
so they are unit tested; `GameScene` just draws them. `EndingScene` is new.

**Assumptions (Matt to overrule).**

1. The design's Golem "must be thrown". There is no grab or throw in the
   game, and building one for a single enemy was out of scope, so the Golem
   is heavy-armored instead: the lesson is the same (stop jabbing, finish
   the chain).
2. "Ghosting Phantom" became **Ghoster**. TOKEN's Go wild whiffs are
   already called phantom swings in the design, and two phantoms read as a
   mistake. The pipeline group is still named `phantom`; the sprites live
   in `public/sprites/ghoster/`.
3. The Panel is three object-headed interviewers at separate desks (a
   clipboard, a whiteboard and a coffee mug for heads), not one desk
   with three heads: three fighters reuse all the brawler rules, a
   three-headed boss would have been a new body type.
4. "FINISH HIM" became **CLOSE THE DEAL!** The enemies are the process;
   a fatality prompt over a hiring manager is the wrong joke.
5. The stage ends on the last panelist, not at the end of the floor.
6. Coffee in the lobby at 180: a typical arrival from the tunnel has about
   60 hp and walks straight into a Golem.
7. A loss in the tower retries the tower at full health with the arrival
   score. Sending someone back to the street after two stages is the one
   unfair thing the game could do.

**Tuning.** Sweeps over 10 seeds arriving with 60 hp. First cut: CASUAL
with TOKEN 6/10, CASUAL solo 0/10, too hard for the last stage of a
showcase. After retuning the Golem (now 64 hp, smash 12) and the panel
cooldowns and adding the lobby coffee: CASUAL with TOKEN 9/10, CASUAL solo
3/10, SHARP with TOKEN 10/10, SHARP solo 9/10. Pinned by bands in
`bot.test.ts` over 5 seeds. The bot needed one new skill, jumping an
incoming wide projectile, the same "read the telegraph" fix as the Take
Home's armor.

**What broke.**

- *A latent crash in the shipped Stage 2 build.* Phaser reuses the scene
  object across `scene.start`, and shutdown destroys every game object, but
  `GameScene` kept its id-to-sprite maps. The second visit to the street
  (clear the tunnel, press a button: the only way to start a second run)
  called `setTexture` on a destroyed sprite and froze on tick 0 with
  `Cannot read properties of undefined (reading 'sys')`. Found while wiring
  the ending's "again"; proven by removing the fix and replaying the flow in
  Playwright, then restoring it. Both stage scenes now clear their maps in
  `create`.
- *Phaser keeps the last scene data.* `scene.start('game')` with no data
  re-used the tower data it was booted with, so "again" from the ending
  restarted the tower. Every `scene.start` now passes its stage explicitly.
- *`?stage=3` via the READY event was too late*: the game had already
  autostarted the street. Calling `game.scene.start(key, data)` right after
  `new Phaser.Game` works because before boot it queues the autostart with
  that data (SceneManager `_data`).
- Vitest swallows `console.log`, so the tuning sweeps printed nothing;
  `process.stderr.write` does get through.

**Art.** Generated this stage: Golem, Ghoster, three panelists, the form,
sticky-note, folder and offer props, and the rooftop ending card (Matt
holding up the letter beside TOKEN at sunset). The Golem smash sheet drifted
greyer than its other sheets; kept, logged in ROADMAP.

**Follow-ups.** Matt's playtest decides the Stage 3 bands. The tower
backdrop is code-drawn. M5 (audio, bark bank) next.

## 2026-09-22 20:15 CDT: Stage 2, the Take-Home Tunnel

**What.** The second stage is playable end to end: clear the street, press
Enter, and Matt and TOKEN drop onto hover-boards for a 45-second
autoscrolling run. Hurdles to jump, paperwork walls to steer around, three
sections that speed up, checkpoints, and a rewind instead of a game over.
Built autonomously while Matt was away; assumptions below.

**Shape.** The tunnel is its own sim (`src/sim/tunnel.ts`, `TunnelWorld`,
`stepTunnel`), not the brawler with a flag: it shares no rules with the
belt fight. The same `InputFrame` drives both, so keyboard, touch pad and
bots work unchanged. `src/sim/campaign.ts` carries score, health and TOKEN's
order between stages. The view got two small extractions on the way:
`hud.ts` (shared constants and the health bar) and `devices.ts`, a
per-game singleton for the keyboard and touch pad. Without it every scene
switch would have built a second touch pad and a second set of key
listeners.

**The bot-modeling lesson (the interesting part for the Deep Dive).** The
first CASUAL tunnel bot copied the brawler bot: it decided every 15 ticks
and held that input in between. It was terrible in ways that said nothing
about the track.

1. Every seed played out identically. The tunnel has no randomness a bot
   reacts to, so a seeded bot needs its own jitter or a 10-seed sweep is one
   run counted ten times.
2. It looped forever on seed 3: after a rewind it replayed the exact same
   mistake, because the jitter did not change between attempts. Now it
   re-rolls per retry.
3. It overshot lanes: holding "up" for 15 ticks moves 22.5 px against an
   18 px lane gap. A human does not hold a direction blindly between
   decisions; they steer to a target. The fix was to separate *when you
   decide* (reaction cadence, every 15 ticks) from *how precisely you
   execute* (steer to the chosen lane every tick, jump timing jittered).

The general rule: a reaction cadence is not a timing error. Model them
separately or the bot measures its own clumsiness, not the level.

**Result.** 10 seeds: SHARP never crashes; CASUAL takes 0 to 2 crashes and
never rewinds (hp 70 to 100); CASUAL on Guard takes no damage. Section 3
went from 3.4 to 3.6 px a tick with the open lane swapping edge to edge. A
slower steer (1.2) changed nothing, so it went back to 1.5.

**Assumptions made without Matt (overrule freely).**

- The tunnel is a breather after the boss, not a Battletoads wall. The bot
  cannot model the real trap (a human trusting a wrong Go wild call at
  speed), so real difficulty is a playtest question for Matt, listed in the
  ROADMAP tuning notes.
- Go wild calls are wrong 25 percent of the time. Often enough to notice,
  rare enough that listening still pays.
- Matt enters the tunnel with his street health, floored at 60 (the retry
  health), so a scraped boss win is not punished twice.
- Losing on the street and restarting starts a fresh run; it does not keep
  the tunnel's carry. There is nothing to carry into a restart yet.
- Clearing the tunnel shows "next: the interview tower (coming soon)" and
  Enter goes back to the street, until Stage 3 exists.
- The hover-board came out red and blue instead of grey and orange. It
  reads fine; not worth a regeneration tonight.
- Walls block lanes, but a 20 px pillar at a depth line is ambiguous in
  2.5D, so each blocked lane also gets a red strip painted on the floor.
  Found by looking at the screenshots, not by any test.
- `?stage=2` boots straight into the tunnel, for playtesting it alone.

**Verified.** `npm run check` green (141 tests). Playwright probe against
the dev server: the intro banner, a JUMP! call at 282 px, a hurdle crash
(-15), a timed jump clearing the second hurdle (+200), an order change,
the clear banner, Enter back to the street, and a street clear with hp 37,
score 4242 and Guard arriving in the tunnel as hp 60, score 4242, Guard. No
page errors.

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
