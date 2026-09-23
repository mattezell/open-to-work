# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Design document and project docs.
- Deterministic simulation core: belt movement, three-hit chain, jump kick,
  special, hit-stop, knockdown and getup, wave camera lock, ATS enemy AI.
- Beatability bot and fairness tests (no enemy attacks from off screen).
- Asset pipeline: Genesis 9-bit colour snap, reference images, per-character
  body height, blob-based frame splitting.
- Approved Matt and TOKEN designs; all Matt, TOKEN and ATS BOT animation sheets.
- Playable Stage 1 in the browser: Phaser view over the sim, keyboard
  controls, health bar, score, GO prompt, end-of-stage banners.
- Touch controls for phones and tablets: floating 8-way stick and A/B/C
  buttons with multi-touch, portrait and landscape layouts, safe-area
  insets, fullscreen and landscape lock on Android, a short vibration when
  Matt takes damage. Keyboard and touch can be used together.
- Restart by tapping any button after the stage ends (after a one second
  pause, so mashing does not skip the result screen).
- TOKEN, the AI sidekick, fighting beside Matt with a zap one-two. Three
  standing orders cycled with Q or Tab (or the order pill on touch): Go
  wild, Focus (double damage on Matt's target), Guard (takes hits for Matt
  at half damage). TOKEN reboots after a KO instead of staying down.
- TOKEN's health bar and current order in the HUD, and speech bubbles when
  it takes an order, blocks a hit, lands a KO, whiffs or reboots.
- Stage 1 is complete. Spam Recruiters keep their distance and throw
  business cards along their depth line; step off the line or jump them,
  and TOKEN on Guard catches them for you. The Unpaid Take Home ends the
  stage: a slam that knocks Matt down, armor while it swings, and scope
  creep (an extra ATS BOT) at two thirds and one third health, with a named
  health bar along the bottom of the screen. Two coffees on the street heal
  30 each.
- Stage 2, the Take-Home Tunnel: an autoscrolling hover-board run after the
  street. Three lanes, hurdles to jump and walls to steer around, three
  sections that speed up, checkpoints, and a rewind instead of a game over.
  TOKEN rides along calling hazards (wrong one time in four on Go wild) or
  taking the first crash of each section on Guard. Score, health and
  TOKEN's order carry over from the street. `?stage=2` starts in the tunnel.
- Hover-board art: Matt riding and wiping out, TOKEN on its hover disc,
  hurdle and paperwork-wall props.
- Stage 3, the Interview Tower, and the ending. A cleared tunnel leads up
  the tower. LeetCode Golems shrug off anything short of a knockdown blow;
  Ghosters vanish after a hit and come back behind Matt; The Panel of three
  interviewers takes Matt one round at a time from behind their desks
  (forms, a floor-wide wall of sticky notes to jump, fast folders), with
  round cards and a CLOSE THE DEAL! prompt on the last one. The final blow
  hands Matt the offer letter, and the run ends on the HIRED card with the
  final score. Losing in the tower retries the tower at full health.
  `?stage=3` starts in the tower. TOKEN has lines for ghosting, each round
  and the offer.

### Changed

- Stage 1 is longer (2200 px, was 1600): Spam Recruiters join waves 2 and 3,
  and a fourth wave brings the boss.

- Stage 1 fights back: ATS BOTs wind up faster (10 ticks, was 20) and swing
  again sooner, so mashing in front of one no longer stunlocks it forever.

### Fixed

- Starting a second run after clearing the tunnel froze the game on the
  first frame of the street: the scene reused sprites its previous visit
  had destroyed. Both stage scenes now drop them on entry.

- Enemies no longer stack on one spot: they spread in depth and split
  around Matt instead of queueing on one side.
