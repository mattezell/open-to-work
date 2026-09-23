# OPEN TO WORK

A 16-bit co-op beat 'em up about the job hunt. You are a bearded architect
laid off on a Tuesday; your co-op partner is an AI sidekick that hits hard and
is sometimes confidently wrong. Fight through the Job Board, survive the
Take-Home Tunnel, and take down The Panel.

Built in four days (2026-09-22 to 2026-09-25) for a The New Guard Deep Dive.

## Status

Stage 1 (the Job Board) is playable: Matt and TOKEN against ATS BOTs. See
`DESIGN.md` for the game and `ROADMAP.md` for progress.

## Run it

```bash
npm install
npm run dev        # http://127.0.0.1:5180
npm run check      # typecheck, lint, format check, vitest, pipeline unit tests
npm run build      # static build in dist/
```

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
