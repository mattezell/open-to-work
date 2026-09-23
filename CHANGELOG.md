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

### Changed

- Stage 1 fights back: ATS BOTs wind up faster (10 ticks, was 20) and swing
  again sooner, so mashing in front of one no longer stunlocks it forever.

### Fixed

- Enemies no longer stack on one spot: they spread in depth and split
  around Matt instead of queueing on one side.
