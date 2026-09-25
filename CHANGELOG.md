# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- A `LICENSE`: the code is MIT, the art is all rights reserved (the hero
  is a real person's likeness).
- CV and contact links without beating the game: the title screen's
  bottom row is now a `START  CV  CONTACT` menu (START chosen, so start
  keys still start), and help ends on a HIRE MATT page listing both URLs.
- A link preview: pasting https://opentowork.immatt.com into Slack,
  Discord, X, LinkedIn or iMessage now shows a card with Matt and TOKEN on
  the roof and the title, plus a description. The site also has a
  favicon and a home-screen icon: TOKEN grinning.
- Live on the web at https://opentowork.immatt.com (Cloudflare Workers
  static assets), with https://otw.immatt.com as a short alias that
  redirects there.
- A campaign beatability test: the bot plays the street, the tunnel and
  the tower in one run, carrying health and score between stages, on ten
  seeds, in `npm run check`.
- Painted parallax backdrops for all three stages, generated and snapped to
  the Genesis palette: a dusk skyline, a storefront row and the near shops
  on the street (with a "WE'RE HIRING (not you)" banner and a recruiting
  agency with its blinds drawn), a server room and a rack row in the
  tunnel, and a sunset city behind the tower's glass with office furniture
  in front. The old code-drawn backdrops stay as the fallback if the
  images fail to load.
- Asset pipeline: `kind: layer` backdrop entries, `--crop` and
  `--seamless` in `pixelize.py image`.
- HIRED card call to action: "Hire the real Matt" with links to
  immatt.com/cv/ and immatt.com/contact/, opened in a new tab, plus PLAY
  AGAIN. The card also carries the credit "Built in
  N days by Matt Ezell + Claude", N from the git history at build time.
- Title screen: the logo, Matt and TOKEN on the street, the start hint for
  keyboard or touch, and a credit line. Enter, Space, J or a tap starts.
- Arcade attract mode: after about 22 s idle the title shows the enemy
  roster one at a time, then the bot plays a silent 30 s demo of the street
  (fixed seed, blinking PRESS START), then returns to the title. Any start
  button during the demo starts a real run.
- Final Fight name cards: the first time each street and tunnel enemy is
  fully on screen, its name and pitch hang over it. Once per kind per page
  visit; the Panel keeps its round banners.
- A one-line pitch for every enemy in the roster (help pages and cards).
- `?stage=1` boots straight into the street, skipping the title.
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

- Music and sound effects, synthesised in the browser with no audio files:
  a funk loop for the street, a four-on-the-floor tunnel track that speeds
  up with the board, a D minor tower theme and a C major ending. Hits, heavy
  hits, knockouts, TOKEN's orders, reboots, pickups, scope creep, ghosting,
  each panel round, crashes, checkpoints and the offer all have a sound.
  M mutes (remembered between visits); touch players get a SOUND pill.
- TOKEN has 144 lines across 18 moments (was 3 per moment), generated by
  qwen3.8-27b from hand-written seeds and reviewed by hand.
- The tunnel says whether a hazard was cleared or hit: CLEAR +200 and a
  chime for a clean pass; CRASH -15, a screen shake and a red flash for a
  hit. The hurdles in the lanes in front of Matt turn see-through as he
  passes them, so they no longer hide the jump.
- The hot seat in The Panel is marked with a pool of light and an arrow.
- Pause and help: Esc or P pauses the street, the tunnel or the tower (and
  the music with it), H or ? opens the help. Five pages turned with left and
  right: the controls (the keys, or the pad on a touch screen), TOKEN's
  orders, and who is who on the street, in the tunnel and in the tower.
  Touch screens get a PAUSE pill; a tap turns the page. The game also
  pauses itself when the window loses focus.

### Changed

- The HIRED card no longer restarts on any button: left and right choose
  an option and Enter or a button picks it.
- Stage 1 is longer (2200 px, was 1600): Spam Recruiters join waves 2 and 3,
  and a fourth wave brings the boss.

- Stage 1 fights back: ATS BOTs wind up faster (10 ticks, was 20) and swing
  again sooner, so mashing in front of one no longer stunlocks it forever.

- The Panel's desks run in a diagonal across the room, 60 px apart (were
  16 px apart and piled on top of each other), and each interviewer beaten
  opens up the room to the next desk.

- All on-screen text is a pixel font drawn for the game (5 by 7 capitals,
  lowercase with descenders) instead of the browser's 8px monospace, so it
  stays sharp at any scale. Every letter carries a one-pixel ink shadow, and
  the centre cards set their title line double size over a smaller body.

### Fixed

- The Panel's desks no longer slide back and forth as the interviewers
  fidget (on the title screen's NOW HIRING roster and in the tower). The
  sprite pipeline centred every frame on the character, so a lean moved
  the desk with it; panel sheets now pin the desk's front leg in place
  (`x_anchor: base` in `tools/assets.yaml`).
- The game sat off centre wherever the screen had room to its sides:
  a quarter of the spare width too far right (a phone in landscape,
  a desktop window), or too low in a tall window. In landscape on a phone
  that put the right edge of the game under the A, B and C buttons. It
  is centred now.
- A double tap on the background on an iPhone (a missed button) zoomed
  the page, with no way to pinch back out, and a zoomed page slid
  sideways under the stick. In touch play, touches outside the game's
  canvas no longer trigger browser gestures.
- Moving the stick on an iPhone paused the game (reported by a player
  who came from Facebook). An in-app browser can take focus from the
  page mid-drag, and a lost focus paused the stage. A
  touch player now pauses only when the page is hidden; keyboard players
  still pause on alt-tab.
- Help no longer says the PAUSE and SOUND pills sit on the HUD; it names
  them as pills off the game.
- The SOUND pill no longer covers the HUD on phones. In landscape it
  sits under PAUSE in the left bar; in portrait all the pills sit just
  under the game instead of over the health bars.
- Fullscreen on Android: no touch anywhere entered it. The pad asked on
  the touch's way down, before Chrome grants the tap its user activation,
  and the one refusal used up its only try. It now asks when any tap
  lifts, keeps asking until one request lands, and a FULL pill (left of
  SOUND, or atop the right bar in landscape) goes back in after the
  player leaves.

- On a phone, touching the stick on the title screen started the game
  instead of moving the menu cursor, and a pad button with CV chosen
  started the game rather than opening the CV. The stick now moves the
  cursor and the pad buttons pick, on the title and the HIRED card.
- The HIRED card's menu row sat 2 to 3 pixels right of centre; it and the
  title's menu now share one centred layout.
- Starting a second run after clearing the tunnel froze the game on the
  first frame of the street: the scene reused sprites its previous visit
  had destroyed. Both stage scenes now drop them on entry.

- Enemies no longer stack on one spot: they spread in depth and split
  around Matt instead of queueing on one side.

- Matt no longer flickers through his special. Only recovery blinks now:
  getting up, and TOKEN rebooting.
- The Panel no longer strobes in a busy fight: a panelist knocked down
  blinked through its getup, and a beaten one blinked like a fading corpse
  for the rest of the stage.
