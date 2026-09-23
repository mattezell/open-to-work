# OPEN TO WORK

A 16-bit co-op beat 'em up about the job hunt. You are a bearded architect
laid off on a Tuesday; your co-op partner is an AI sidekick that hits hard and
is sometimes confidently wrong. Fight through the Job Board, survive the
Take-Home Tunnel, and take down The Panel.

Built in four days (2026-09-22 to 2026-09-25) for a The New Guard Deep Dive.

## Status

Stage 1 (the Job Board) is complete: Matt and TOKEN against ATS BOTs and
Spam Recruiters, with The Unpaid Take Home as the stage boss. Clearing it
leads into Stage 2, the Take-Home Tunnel, a hover-board run. Stage 3 is not
built yet; clearing the tunnel ends the run. See
`DESIGN.md` for the game and `ROADMAP.md` for progress.

## Run it

```bash
npm install
npm run dev        # http://127.0.0.1:5180
npm run check      # typecheck, lint, format check, vitest, pipeline unit tests
npm run build      # static build in dist/
```

Add `?stage=2` to the URL to start in the tunnel without clearing the street
first (`http://127.0.0.1:5180/?stage=2`).

## Controls

| Action | Keys |
|---|---|
| Move (belt: left/right, up/down for depth) | Arrows or WASD |
| Attack (tap three times for the jab, jab, haymaker chain) | J or Z |
| Jump (attack in the air for a jump kick) | K, X or Space |
| Special (spinning clothesline, costs health, invulnerable) | L or C |
| Give TOKEN its next order (Go wild, Focus, Guard) | Q or Tab |
| Restart after the stage ends | Enter |

On phones and tablets an on-screen pad appears: a floating stick (put your
left thumb down anywhere on the left half) and three Genesis-style buttons,
A special, B attack, C jump. Tap any button to restart after a stage ends.
Portrait puts the game on top and the pad below; landscape puts the pad in
the side bars. On Android the first touch asks for fullscreen and a landscape
lock; iPhone Safari has no fullscreen API, so there the page stays as is. The
pad also appears on a laptop touchscreen at the first touch and hides again
on the next keypress. The cyan pill above the buttons shows TOKEN's current
order; tap it for the next one.

## TOKEN

TOKEN, the AI sidekick, fights on its own through the same controls a
player uses. You give it one standing order at a time:

| Order | What TOKEN does |
|---|---|
| Go wild | Hits whichever crowd is biggest. Sometimes swings at an enemy that already left. |
| Focus | Goes after the enemy you last hit, for double damage. |
| Guard | Stays at your side and takes hits meant for you, at half damage. |

When TOKEN is knocked out it reboots, and gets back up after five seconds
at half health. Losing TOKEN never ends the game; losing Matt does.

## Stage 1 enemies

| Enemy | What it does | How to beat it |
|---|---|---|
| ATS BOT | Walks up and shreds your resume. | Hit it first; it winds up for a sixth of a second. |
| Spam Recruiter | Keeps its distance and throws business cards along its depth line. Backs off if you close in. | Step up or down off its line, or jump the card, then chase it down. TOKEN on Guard catches cards for you. |
| The Unpaid Take Home | The boss. Its slam knocks you down, and it keeps swinging through your hits once the slam has started. At two thirds and one third health it calls in scope creep: one more ATS BOT each time. | Hit it between slams, and sidestep when it raises its arms. |

Coffee on the street heals 30 when Matt walks over it hurt. It stays put
while he is at full health, and TOKEN leaves it for him.

## Stage 2: the Take-Home Tunnel

The track scrolls on its own and speeds up twice. Up and down steer Matt
across three lanes; jump clears the hurdles, and walls have to be steered
around (the red floor shows which lanes a wall closes). A crash costs 15 hp.
At 0 hp the run rewinds to the last checkpoint at 60 hp instead of ending,
and every retry comes off the clear bonus. Matt starts the tunnel with the
health he finished the street with, but never below 60.

TOKEN rides behind and calls the next hazard. Its order still matters:

| Order | In the tunnel |
|---|---|
| Go wild | Calls every hazard, and one call in four is confidently wrong. |
| Focus | Every call is right. |
| Guard | Takes the first crash of each section for Matt. |

## Layout

- `src/sim/`: the game itself, pure deterministic TypeScript, no Phaser.
  Everything that matters is tested here, including a bot that must clear
  Stage 1 on several seeds.
- `src/view/`: Phaser rendering, keyboard input and the touch pad. Reads the sim, never
  changes game state except by passing input to `step`.
- `tools/`: the codex imagegen art pipeline (`assets.yaml` is the art
  direction). `public/sprites/` holds its output.

## Docs

| File | What |
|---|---|
| `DESIGN.md` | Game design, architecture, asset pipeline, schedule |
| `ROADMAP.md` | Milestones and decisions |
| `CHANGELOG.md` | User-facing changes |
| `JOURNAL.md` | Build log, feeds the Deep Dive |
