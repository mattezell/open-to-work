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
