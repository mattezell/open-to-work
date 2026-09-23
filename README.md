# OPEN TO WORK

A 16-bit co-op beat 'em up about the job hunt. You are a bearded architect
laid off on a Tuesday; your co-op partner is an AI sidekick that hits hard and
is sometimes confidently wrong. Fight through the Job Board, survive the
Take-Home Tunnel, and take down The Panel.

Built in four days (2026-09-22 to 2026-09-25) for a The New Guard Deep Dive.

## Status

M1 playable: Stage 1 (the Job Board) with Matt against ATS BOTs. See
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
| Restart after the stage ends | Enter |

## Layout

- `src/sim/`: the game itself, pure deterministic TypeScript, no Phaser.
  Everything that matters is tested here, including a bot that must clear
  Stage 1 on several seeds.
- `src/view/`: Phaser rendering and keyboard input. Reads the sim, never
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
