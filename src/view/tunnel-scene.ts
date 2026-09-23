import Phaser from 'phaser';
import { tunnelStart, type Carry } from '../sim/campaign';
import { DEPTH, SCREEN_H, SCREEN_W } from '../sim/constants';
import type { InputFrame } from '../sim/input';
import {
  createTunnel,
  CRASH_TICKS,
  LANES,
  stepTunnel,
  TUNNEL_1,
  type HazardDef,
  type TunnelWorld,
} from '../sim/tunnel';
import { DIRECTIVE_LABELS, tunnelBarkFor } from './barks';
import { mergeInputs, type HeldKeys } from './controls';
import { sharedDevices } from './devices';
import {
  BARK_MIN_TICKS,
  BARK_TICKS,
  drawBar,
  FLOOR_TOP,
  HUD_TEXT,
  HURT_BUZZ_MS,
  MAX_TICKS_PER_FRAME,
  RESTART_DELAY_TICKS,
  restartHint,
  TICK_MS,
} from './hud';
import type { TouchPad } from './touch';

/** Matt rides at a fixed spot on screen; the track comes to him. */
const MATT_X = 104;
const TOKEN_X = 52;
/** How long a hazard call stays up: long enough to read, gone before the next one. */
const CALL_TICKS = 50;
const TOKEN_BARK_RISE = 62;
/** Frames per ride-cycle step, and how far TOKEN bobs on its hover disc. */
const RIDE_FRAME_TICKS = 6;
const TOKEN_BOB = 2;
/** The far wall scrolls slower than the floor, so the tunnel has depth. */
const WALL_PARALLAX = 0.6;
const BANNER_TICKS = 90;
/** A blocked lane is painted on the floor, so which lanes a wall closes reads at a glance. */
const WALL_LANE_COLOR = 0xc03030;
const WALL_LANE_REACH = 16;
const LANE_HALF = (LANES[1] - LANES[0]) / 2;
const INTRO_TICKS = 150;
const PROGRESS_Y = SCREEN_H - 11;
const PROGRESS_LEFT = 64;
const PROGRESS_W = SCREEN_W - PROGRESS_LEFT - 8;
/** Hazards are drawn from just off the left edge to just off the right. */
const DRAW_BEHIND = MATT_X + 40;
const DRAW_AHEAD = SCREEN_W - MATT_X + 40;

const RIDE_SHEETS = [
  { key: 'matt-ride', path: 'sprites/matt/ride.png', frameWidth: 128, frameHeight: 96 },
  { key: 'matt-crash', path: 'sprites/matt/crash.png', frameWidth: 128, frameHeight: 96 },
  { key: 'token-ride', path: 'sprites/token/ride.png', frameWidth: 112, frameHeight: 80 },
] as const;
const RIDE_FRAMES = 4;

/**
 * Stage 2, the Take-Home Tunnel. The view only reads the TunnelWorld; the
 * sim decides every crash. See DESIGN.md, "Stage 2 as built".
 */
export class TunnelScene extends Phaser.Scene {
  private world!: TunnelWorld;
  private carry: Carry | undefined;
  private keys!: HeldKeys;
  private touch!: TouchPad;
  private accumulator = 0;
  private endedTicks = 0;
  private lastHp = 0;
  private barkTicks = 0;
  private bannerTicks = 0;
  private banner = '';
  private wall!: Phaser.GameObjects.TileSprite;
  private floor!: Phaser.GameObjects.TileSprite;
  private matt!: Phaser.GameObjects.Sprite;
  private token!: Phaser.GameObjects.Sprite;
  private shadows!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private readonly hazardSprites = new Map<string, Phaser.GameObjects.Image>();
  private scoreText!: Phaser.GameObjects.Text;
  private tokenText!: Phaser.GameObjects.Text;
  private barkText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;

  constructor() {
    super('tunnel');
  }

  init(data: { carry?: Carry }): void {
    this.carry = data.carry;
  }

  preload(): void {
    for (const sheet of RIDE_SHEETS) {
      this.load.spritesheet(sheet.key, sheet.path, {
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight,
      });
    }
    this.load.image('prop-hurdle', 'sprites/props/hurdle.png');
    this.load.image('prop-wall', 'sprites/props/wall.png');
  }

  create(): void {
    ({ keys: this.keys, touch: this.touch } = sharedDevices(this.game));
    this.makeTextures();
    this.wall = this.add.tileSprite(0, 0, SCREEN_W, FLOOR_TOP, 'tunnel-wall').setOrigin(0);
    this.floor = this.add
      .tileSprite(0, FLOOR_TOP, SCREEN_W, SCREEN_H - FLOOR_TOP, 'tunnel-floor')
      .setOrigin(0);
    this.shadows = this.add.graphics().setDepth(1);
    this.matt = this.add.sprite(MATT_X, 0, 'matt-ride').setOrigin(0.5, 1);
    this.token = this.add.sprite(TOKEN_X, 0, 'token-ride').setOrigin(0.5, 1);
    this.hud = this.add.graphics().setDepth(1000);
    this.scoreText = this.add.text(8, 16, '', HUD_TEXT).setDepth(1001);
    this.tokenText = this.add
      .text(SCREEN_W - 8, 6, '', { ...HUD_TEXT, align: 'right' })
      .setOrigin(1, 0)
      .setDepth(1001);
    this.barkText = this.add
      .text(TOKEN_X, 0, '', { ...HUD_TEXT, backgroundColor: '#101010', padding: { x: 2, y: 1 } })
      .setOrigin(0, 1)
      .setDepth(999);
    this.progressText = this.add.text(8, PROGRESS_Y - 1, 'TAKE-HOME', HUD_TEXT).setDepth(1001);
    this.bannerText = this.add
      .text(SCREEN_W / 2, 84, '', { ...HUD_TEXT, fontSize: '16px', align: 'center' })
      .setOrigin(0.5)
      .setDepth(1001);
    this.input.keyboard?.on('keydown-ENTER', () => {
      if (this.world.status === 'cleared') this.advance();
    });
    this.start();
  }

  update(_time: number, delta: number): void {
    this.accumulator = Math.min(this.accumulator + delta, TICK_MS * MAX_TICKS_PER_FRAME);
    while (this.accumulator >= TICK_MS) {
      this.accumulator -= TICK_MS;
      this.tick(mergeInputs(this.keys.snapshot(), this.touch.snapshot()));
    }
    this.wall.tilePositionX = Math.round(this.world.distance * WALL_PARALLAX);
    this.floor.tilePositionX = Math.round(this.world.distance);
    this.shadows.clear();
    this.drawHazards();
    this.drawRiders();
    this.drawHud();
  }

  private start(): void {
    const carry = this.carry ?? { hp: 100, score: 0, directive: 'wild' as const };
    this.world = createTunnel(TUNNEL_1, Date.now() >>> 0, tunnelStart(carry));
    this.accumulator = 0;
    this.endedTicks = 0;
    this.lastHp = this.world.matt.hp;
    this.barkTicks = 0;
    this.showBanner('THE TAKE-HOME TUNNEL\n\njump the hurdles\nsteer round the walls', INTRO_TICKS);
  }

  /** Stage 3 is not built yet, so a cleared tunnel ends the run and a button starts a new one. */
  private advance(): void {
    this.scene.start('game');
  }

  private tick(frame: InputFrame): void {
    if (this.bannerTicks > 0) this.bannerTicks--;
    if (this.world.status !== 'playing') {
      this.endedTicks++;
      const pressed = frame.attack || frame.jump || frame.special;
      if (pressed && this.endedTicks > RESTART_DELAY_TICKS) this.advance();
      return;
    }
    stepTunnel(this.world, frame);
    this.react();
    if (this.world.matt.hp < this.lastHp) this.touch.buzz(HURT_BUZZ_MS);
    this.lastHp = this.world.matt.hp;
  }

  /** Turn this tick's events into TOKEN's bubble and the centre banner. */
  private react(): void {
    if (this.barkTicks > 0) this.barkTicks--;
    for (const event of this.world.events) {
      if (event.type === 'checkpoint') this.showBanner('CHECKPOINT', BANNER_TICKS);
      if (event.type === 'retry') this.showBanner('REWIND\n\nback to the checkpoint', BANNER_TICKS);
      const bark = tunnelBarkFor(event, this.world.tick);
      if (!bark) continue;
      if (!bark.urgent && this.barkTicks > BARK_TICKS - BARK_MIN_TICKS) continue;
      this.barkText.setText(bark.text);
      this.barkTicks = event.type === 'call' ? CALL_TICKS : BARK_TICKS;
    }
  }

  private showBanner(text: string, ticks: number): void {
    this.banner = text;
    this.bannerTicks = ticks;
  }

  private drawHazards(): void {
    const seen = new Set<string>();
    this.world.track.hazards.forEach((hazard, index) => {
      const offset = hazard.x - this.world.distance;
      if (offset < -DRAW_BEHIND || offset > DRAW_AHEAD) return;
      const x = Math.round(MATT_X + offset);
      for (const lane of lanesOf(hazard)) {
        const key = `${index}:${lane}`;
        seen.add(key);
        const ground = FLOOR_TOP + LANES[lane];
        let sprite = this.hazardSprites.get(key);
        if (!sprite) {
          sprite = this.add.image(0, 0, `prop-${hazard.kind}`).setOrigin(0.5, 1);
          this.hazardSprites.set(key, sprite);
        }
        sprite.setPosition(x, ground).setDepth(10 + LANES[lane]);
        if (hazard.kind === 'wall') {
          this.shadows.fillStyle(WALL_LANE_COLOR, 0.45);
          this.shadows.fillRect(
            x - WALL_LANE_REACH,
            ground - LANE_HALF,
            WALL_LANE_REACH * 2,
            LANE_HALF * 2,
          );
        }
        this.shadows.fillStyle(0x000000, 0.35).fillEllipse(x, ground, sprite.width, 5);
      }
    });
    for (const [key, sprite] of this.hazardSprites) {
      if (!seen.has(key)) {
        sprite.destroy();
        this.hazardSprites.delete(key);
      }
    }
  }

  private drawRiders(): void {
    const { matt, tokenZ, tick } = this.world;
    const cycle = Math.floor(tick / RIDE_FRAME_TICKS) % RIDE_FRAMES;
    const mattGround = Math.round(FLOOR_TOP + matt.z);
    this.shadows.fillStyle(0x000000, 0.35).fillEllipse(MATT_X, mattGround, 44, 6);
    if (matt.crash > 0) {
      this.matt.setTexture('matt-crash', matt.crash > CRASH_TICKS / 2 ? 0 : 1);
    } else {
      this.matt.setTexture('matt-ride', cycle);
    }
    this.matt
      .setPosition(MATT_X, Math.round(mattGround - matt.y))
      .setDepth(10 + matt.z + 0.5)
      .setVisible(matt.invuln === 0 || Math.floor(tick / 3) % 2 === 0);

    const tokenGround = Math.round(FLOOR_TOP + tokenZ);
    const bob = Math.floor(tick / 20) % 2 === 0 ? 0 : TOKEN_BOB;
    this.shadows.fillStyle(0x000000, 0.35).fillEllipse(TOKEN_X, tokenGround, 30, 5);
    this.token
      .setTexture('token-ride', cycle)
      .setPosition(TOKEN_X, tokenGround - 4 - bob)
      .setDepth(10 + tokenZ + 0.5);
    this.barkText
      .setVisible(this.barkTicks > 0)
      .setPosition(TOKEN_X - 20, Math.max(tokenGround - TOKEN_BARK_RISE, 34));
  }

  private drawHud(): void {
    const { matt, track, distance } = this.world;
    this.hud.clear();
    drawBar(this.hud, 8, 6, 100, matt.hp / 100, 0xe0c040);
    this.scoreText.setText(`MATT  ${String(this.world.score).padStart(6, '0')}`);
    const hint = this.touch.active ? '' : ' [Q]';
    const order = DIRECTIVE_LABELS[this.world.directive];
    this.touch.setOrderLabel(`TOKEN: ${order}`);
    this.tokenText.setText(`TOKEN ${order}${hint}`);

    drawBar(this.hud, PROGRESS_LEFT, PROGRESS_Y, PROGRESS_W, distance / track.length, 0x60c0e0);
    this.hud.fillStyle(0xf0f0e0);
    for (const section of track.sections.slice(1)) {
      const x = PROGRESS_LEFT + Math.round((PROGRESS_W * section.x) / track.length);
      this.hud.fillRect(x, PROGRESS_Y - 2, 1, 10);
    }
    this.progressText.setText(
      this.world.retries > 0 ? `RETRY x${this.world.retries}` : 'TAKE-HOME',
    );

    const again = this.endedTicks > RESTART_DELAY_TICKS ? restartHint(this.touch.active) : '';
    if (this.world.status === 'cleared') {
      this.bannerText.setText(
        `TAKE-HOME SUBMITTED\nnext: the interview tower\n(coming soon)\n\n${again}`,
      );
    } else {
      this.bannerText.setText(this.bannerTicks > 0 ? this.banner : '');
    }
  }

  /**
   * The tunnel's far wall and floor, drawn once into tiling textures: ribbed
   * concrete, strip lights and conduit above, a three-lane floor below.
   */
  private makeTextures(): void {
    if (this.textures.exists('tunnel-wall')) return;
    const g = this.make.graphics({}, false);
    const tile = 128;
    g.fillStyle(0x1c1830).fillRect(0, 0, tile, FLOOR_TOP);
    g.fillStyle(0x2a2444).fillRect(0, 0, tile, 14);
    g.fillStyle(0xe0c060).fillRect(20, 10, 36, 3).fillRect(84, 10, 36, 3);
    g.fillStyle(0x3b3358).fillRect(0, 34, tile, 3).fillRect(0, 40, tile, 2);
    g.fillStyle(0x26203c).fillRect(0, 0, 10, FLOOR_TOP).fillRect(64, 0, 10, FLOOR_TOP);
    g.fillStyle(0x332c50).fillRect(10, 0, 2, FLOOR_TOP).fillRect(74, 0, 2, FLOOR_TOP);
    // Filing-box stacks along the base of the wall: the assignment's paperwork.
    g.fillStyle(0x6a4a30)
      .fillRect(24, FLOOR_TOP - 22, 18, 22)
      .fillRect(92, FLOOR_TOP - 14, 22, 14);
    g.fillStyle(0x8a6a44)
      .fillRect(26, FLOOR_TOP - 20, 14, 3)
      .fillRect(94, FLOOR_TOP - 12, 18, 3);
    g.fillStyle(0xd0d0c0).fillRect(44, FLOOR_TOP - 8, 12, 8);
    g.generateTexture('tunnel-wall', tile, FLOOR_TOP);

    g.clear();
    const floorH = SCREEN_H - FLOOR_TOP;
    g.fillStyle(0x3a3646).fillRect(0, 0, 64, floorH);
    g.fillStyle(0x5a5a66).fillRect(0, 0, 64, 3);
    g.fillStyle(0x4c4860);
    const dividers = [(LANES[0] + LANES[1]) / 2, (LANES[1] + LANES[2]) / 2];
    for (const z of dividers) g.fillRect(8, Math.round(z), 20, 1);
    g.fillStyle(0x24202e).fillRect(0, DEPTH + 2, 64, floorH - DEPTH - 2);
    g.generateTexture('tunnel-floor', 64, floorH);
    g.destroy();
  }
}

function lanesOf(hazard: HazardDef): readonly (0 | 1 | 2)[] {
  return hazard.kind === 'hurdle' ? [0, 1, 2] : (hazard.lanes ?? []);
}
