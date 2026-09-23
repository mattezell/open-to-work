import Phaser from 'phaser';
import { carryFromStreet, type Carry } from '../sim/campaign';
import { SCREEN_H, SCREEN_W } from '../sim/constants';
import { createBot, SHARP } from '../sim/bot';
import { KINDS, PROJECTILES, type FighterKind } from '../sim/fighters';
import type { InputFrame } from '../sim/input';
import { hotSeat } from '../sim/panel';
import {
  createWorld,
  players,
  sidekick,
  step,
  type Fighter,
  type Pickup,
  type Projectile,
  type World,
} from '../sim/world';
import { poseFor, sheetKey } from './animation';
import { DEMO_SEED, DEMO_TICKS, startPressed, TITLE_SCENE } from './attract';
import { sharedAudio } from './audio';
import { barkFor, DIRECTIVE_LABELS } from './barks';
import { mergeInputs, type HeldKeys } from './controls';
import { sharedDevices } from './devices';
import { sfxForSim } from './music';
import { NameCards } from './name-cards';
import { drawStreet, drawTower, loadSprites, onAnyTap } from './scenery';
import { bindPause } from './pause-scene';
import { PixelBanner, PixelBubble, PixelCard, pixelText } from './pixel-text';
import {
  BARK_MIN_TICKS,
  BARK_TICKS,
  drawBar,
  FLOOR_TOP,
  HURT_BUZZ_MS,
  INK,
  MAX_TICKS_PER_FRAME,
  RESTART_DELAY_TICKS,
  restartHint,
  TICK_MS,
} from './hud';
import {
  blinkedOut,
  BOSS_NAMES,
  bossOf,
  BRAWL_STAGES,
  clearedBanner,
  closingTime,
  fighterAlpha,
  isFadingCorpse,
  isWaitingPanelist,
  panelBanner,
  TOWER_INTRO,
  towerRetry,
  type BrawlStage,
} from './stage-view';
import type { TouchPad } from './touch';

/** Screen y of the back edge of the walkable street (z = 0). */
const STREET_TOP = FLOOR_TOP;
/** How far above TOKEN's feet a bark sits. */
const BARK_RISE = 70;
/** Keeps the bubble's ink plate clear of the screen edges. */
const BARK_MARGIN = 5;

/** The boss name and bar share one line in the strip below the street, clear of any feet. */
const BOSS_BAR_W = 150;
const BOSS_BAR_Y = SCREEN_H - 11;
const BOSS_NAME_GAP = 6;
/** Coffee bobs gently so it reads as something to grab. */
const PICKUP_BOB_TICKS = 40;
const BANNER_TICKS = 120;
const INTRO_TICKS = 150;
/** Waiting panelists sit in shadow behind their desks. */
const WAITING_TINT = 0x707070;
const HOT_SEAT_LIGHT = 0xffe070;
/** How far above a panelist's feet the hot-seat arrow points: just over the tallest head. */
const HOT_SEAT_ARROW_RISE = 84;
const OFFER_FLIGHT_MS = 800;
const OFFER_RISE = 100;
const MATT_FALLBACK: Carry = { hp: 100, score: 0, directive: 'wild' };
/** A name card sits this far over its enemy's head, and never higher than just under the HUD. */
const CARD_RISE = 4;
const CARD_TOP = 28;

/** Enemies already named this visit. The demo keeps its own set, so it never spends a card. */
const introduced = new Set<FighterKind>();

export interface GameData {
  carry?: Carry;
  stage?: BrawlStage;
  /** The attract-mode demo: the bot plays the street until someone presses start. */
  demo?: boolean;
}

/** Where a fighter's feet land on screen, in world pixels (the camera handles scroll). */
export function feetPosition(f: Fighter): { x: number; y: number } {
  return { x: Math.round(f.x), y: Math.round(STREET_TOP + f.z - f.y) };
}

export class GameScene extends Phaser.Scene {
  private world!: World;
  private keys!: HeldKeys;
  private touch!: TouchPad;
  private accumulator = 0;
  private endedTicks = 0;
  private lastHp = 0;
  private readonly sprites = new Map<number, Phaser.GameObjects.Sprite>();
  private readonly placeholders = new Map<number, Phaser.GameObjects.Rectangle>();
  private readonly missingSheets = new Set<string>();
  private readonly projectileSprites = new Map<number, Phaser.GameObjects.Image>();
  private readonly pickupSprites = new Map<number, Phaser.GameObjects.Image>();
  private shadows!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private hotSeatMarker!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.BitmapText;
  private bannerText!: PixelBanner;
  private tokenText!: Phaser.GameObjects.BitmapText;
  private barkText!: PixelBubble;
  private bossText!: Phaser.GameObjects.BitmapText;
  private barkTicks = 0;
  private banner = '';
  private bannerTicks = 0;
  private stage: BrawlStage = 'street';
  /** Set when the scene is entered from an earlier stage; a restart after a loss starts fresh. */
  private carry: Carry | undefined;
  /** What Matt walked into this stage with, so a tower retry keeps his score. */
  private arrival: Carry | undefined;
  private offer: Phaser.GameObjects.Image | undefined;
  private demo = false;
  private demoBot: ReturnType<typeof createBot> | undefined;
  /** Set once the scene has asked to change, so the rest of the frame does not act again. */
  private leaving = false;
  private cards!: NameCards;
  private card!: PixelCard;

  constructor() {
    super('game');
  }

  init(data: GameData): void {
    this.demo = data.demo ?? false;
    this.stage = this.demo ? 'street' : (data.stage ?? 'street');
    this.carry = data.carry;
    this.arrival = data.carry;
  }

  preload(): void {
    loadSprites(this, (key) => this.missingSheets.add(key));
  }

  create(): void {
    ({ keys: this.keys, touch: this.touch } = sharedDevices(this.game));
    // The scene object outlives a restart; the game objects these maps held did not.
    for (const objects of [
      this.sprites,
      this.placeholders,
      this.projectileSprites,
      this.pickupSprites,
    ]) {
      objects.clear();
    }
    const length = BRAWL_STAGES[this.stage].length + SCREEN_W;
    if (this.stage === 'tower') drawTower(this, length);
    else drawStreet(this, length);
    this.shadows = this.add.graphics().setDepth(-1);
    this.hud = this.add.graphics().setScrollFactor(0).setDepth(1000);
    this.hotSeatMarker = this.add.graphics().setDepth(999.5);
    this.scoreText = pixelText(this, 8, 16).setScrollFactor(0).setDepth(1001);
    this.tokenText = pixelText(this, SCREEN_W - 8, 16)
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1001);
    this.barkText = new PixelBubble(this, 0.5, 999);
    this.bossText = pixelText(this, 0, BOSS_BAR_Y - 1)
      .setScrollFactor(0)
      .setDepth(1001);
    this.bannerText = new PixelBanner(this, SCREEN_W / 2, 80, 1001);
    this.card = new PixelCard(this, 1000.5);
    this.leaving = false;
    this.input.keyboard?.on('keydown-ENTER', () => {
      if (this.demo) this.startRun();
      else if (this.world.status !== 'playing') this.advance();
    });
    if (this.demo) {
      this.touch.setPauseHandler(() => this.startRun(), 'START');
      onAnyTap(this, () => this.startRun());
    } else {
      bindPause(this, this.touch);
    }
    this.restart();
  }

  update(_time: number, delta: number): void {
    this.accumulator = Math.min(this.accumulator + delta, TICK_MS * MAX_TICKS_PER_FRAME);
    while (this.accumulator >= TICK_MS && !this.leaving) {
      this.accumulator -= TICK_MS;
      const player = mergeInputs(this.keys.snapshot(), this.touch.snapshot());
      if (!this.demoBot) this.tick(player);
      else if (startPressed(player)) this.startRun();
      else this.tick(this.demoBot(this.world));
    }
    this.cameras.main.scrollX = Math.round(this.world.cameraX);
    this.drawFighters();
    this.drawProjectiles();
    this.drawPickups();
    this.drawHud();
  }

  private tick(frame: InputFrame): void {
    if (this.demo && (this.world.status !== 'playing' || this.world.tick >= DEMO_TICKS)) {
      this.leave(TITLE_SCENE);
      return;
    }
    if (this.world.status !== 'playing') {
      this.endedTicks++;
      const pressed = frame.attack || frame.jump || frame.special;
      if (pressed && this.endedTicks > RESTART_DELAY_TICKS) this.advance();
      return;
    }
    if (this.bannerTicks > 0) this.bannerTicks--;
    step(this.world, [frame]);
    this.cards.step(this.world.fighters, this.world.cameraX);
    this.showBarks();
    this.showStageEvents();
    this.playSounds();
    const hp = players(this.world)[0]?.hp ?? 0;
    if (hp < this.lastHp && !this.demo) this.touch.buzz(HURT_BUZZ_MS);
    this.lastHp = hp;
  }

  /**
   * A cleared street goes on to the tunnel and a cleared tower to the ending.
   * A loss on the street starts the run over; a loss in the tower retries the
   * tower at full health, keeping the score Matt arrived with.
   */
  private advance(): void {
    if (this.world.status === 'cleared') {
      if (this.stage === 'tower') {
        this.scene.start('ending', { score: players(this.world)[0]?.score ?? 0 });
      } else {
        this.scene.start('tunnel', { carry: carryFromStreet(this.world) });
      }
      return;
    }
    this.carry = this.stage === 'tower' ? towerRetry(this.arrival ?? MATT_FALLBACK) : undefined;
    this.restart();
  }

  /** Out of the demo into a real run, from the start of the street. */
  private startRun(): void {
    // The button that started the run should not also throw Matt's first punch.
    this.keys.snapshot();
    this.touch.snapshot();
    this.leave('game', { stage: 'street' } satisfies GameData);
  }

  private leave(key: string, data?: GameData): void {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.start(key, data);
  }

  private restart(): void {
    const seed = this.demo ? DEMO_SEED : Date.now() >>> 0;
    this.world = createWorld(BRAWL_STAGES[this.stage], seed, { carry: this.carry });
    this.demoBot = this.demo ? createBot(SHARP) : undefined;
    this.cards = new NameCards(this.demo ? new Set() : introduced);
    this.accumulator = 0;
    this.endedTicks = 0;
    this.lastHp = players(this.world)[0]?.hp ?? 0;
    this.barkTicks = 0;
    this.bannerTicks = 0;
    this.offer?.destroy();
    this.offer = undefined;
    // Attract mode is silent, as in the arcade; the music starts with the run.
    if (!this.demo) sharedAudio().play(this.stage);
    if (this.stage === 'tower') {
      this.showBanner(TOWER_INTRO, INTRO_TICKS);
    }
  }

  private showBanner(text: string, ticks: number): void {
    this.banner = text;
    this.bannerTicks = ticks;
  }

  /** Round cards as each interviewer takes the hot seat, and the offer letter at the end. */
  private showStageEvents(): void {
    for (const event of this.world.events) {
      if (event.type === 'panel')
        this.showBanner(panelBanner(event.kind, event.last), BANNER_TICKS);
      if (event.type === 'hired') this.flyOffer();
    }
  }

  /** The hiring manager slides the offer letter across to Matt, and he holds it up. */
  private flyOffer(): void {
    const manager = this.world.fighters.find((f) => f.kind === 'manager');
    const matt = players(this.world)[0];
    if (!manager || !matt) return;
    const from = feetPosition(manager);
    const to = feetPosition(matt);
    this.offer = this.add
      .image(from.x, from.y - 40, 'prop-offer')
      .setDepth(1002)
      .setScale(1.5);
    this.tweens.add({
      targets: this.offer,
      x: to.x,
      y: to.y - OFFER_RISE,
      angle: 720,
      duration: OFFER_FLIGHT_MS,
      ease: 'Quad.easeOut',
    });
  }

  private playSounds(): void {
    if (this.demo) return;
    const audio = sharedAudio();
    for (const event of this.world.events) audio.sfx(sfxForSim(event));
  }

  /** Turn this tick's sim events into TOKEN's speech bubble. */
  private showBarks(): void {
    if (this.barkTicks > 0) this.barkTicks--;
    const tokenId = sidekick(this.world)?.id;
    for (const event of this.world.events) {
      const bark = barkFor(event, tokenId, this.world.tick);
      if (!bark) continue;
      if (!bark.urgent && this.barkTicks > BARK_TICKS - BARK_MIN_TICKS) continue;
      this.barkText.setText(bark.text);
      this.barkTicks = BARK_TICKS;
    }
  }

  private drawFighters(): void {
    this.shadows.clear();
    const seen = new Set<number>();
    for (const f of this.world.fighters) {
      seen.add(f.id);
      const feet = feetPosition(f);
      const ground = Math.round(STREET_TOP + f.z);
      const alpha = fighterAlpha(f);
      this.shadows.fillStyle(0x000000, 0.35 * alpha).fillEllipse(feet.x, ground, 30, 6);
      const visible = !blinkedOut(f, this.world.tick);
      const pose = poseFor(f);
      const key = sheetKey(f.kind, pose.sheet);
      if (this.missingSheets.has(key)) {
        this.drawPlaceholder(f, feet, visible);
        continue;
      }
      let sprite = this.sprites.get(f.id);
      if (!sprite) {
        sprite = this.add.sprite(feet.x, feet.y, key).setOrigin(0.5, 1);
        this.sprites.set(f.id, sprite);
      }
      sprite
        .setTexture(key, pose.frame)
        .setPosition(feet.x, feet.y)
        .setFlipX(f.facing === -1)
        .setDepth(f.z)
        .setAlpha(alpha)
        .setVisible(visible && !isFadingCorpse(f));
      if (isWaitingPanelist(f)) sprite.setTint(WAITING_TINT);
      else sprite.clearTint();
    }
    this.prune(this.sprites, seen);
    this.prune(this.placeholders, seen);
    this.drawHotSeat();
  }

  /** A pool of light under the interviewer whose turn it is, and a bobbing arrow over its head. */
  private drawHotSeat(): void {
    this.hotSeatMarker.clear();
    const seat = hotSeat(this.world);
    if (!seat || this.world.status !== 'playing') return;
    const feet = feetPosition(seat);
    this.shadows.fillStyle(HOT_SEAT_LIGHT, 0.22).fillEllipse(feet.x, feet.y, 64, 14);
    const tip = feet.y - HOT_SEAT_ARROW_RISE + (Math.floor(this.world.tick / 12) % 2);
    this.hotSeatMarker
      .fillStyle(0x101010)
      .fillTriangle(feet.x - 6, tip - 7, feet.x + 6, tip - 7, feet.x, tip + 1)
      .fillStyle(HOT_SEAT_LIGHT)
      .fillTriangle(feet.x - 4, tip - 6, feet.x + 4, tip - 6, feet.x, tip - 1);
  }

  /** Cards, forms and folders in flight at throwing height, shadowed so their depth line reads. */
  private drawProjectiles(): void {
    const seen = new Set<number>();
    for (const p of this.world.projectiles) {
      seen.add(p.id);
      const ground = Math.round(STREET_TOP + p.z);
      this.shadows.fillStyle(0x000000, 0.35).fillEllipse(Math.round(p.x), ground, 10, 3);
      const sprite = this.spriteFor(this.projectileSprites, p, `prop-${p.kind}`);
      sprite
        .setPosition(Math.round(p.x), ground - PROJECTILES[p.kind].height)
        .setFlipX(p.vx < 0)
        .setDepth(p.z + 0.5);
    }
    this.prune(this.projectileSprites, seen);
  }

  private drawPickups(): void {
    const seen = new Set<number>();
    const bob = Math.floor(this.world.tick / PICKUP_BOB_TICKS) % 2;
    for (const pickup of this.world.pickups) {
      seen.add(pickup.id);
      const ground = Math.round(STREET_TOP + pickup.z);
      this.shadows.fillStyle(0x000000, 0.35).fillEllipse(pickup.x, ground, 14, 4);
      this.spriteFor(this.pickupSprites, pickup, `prop-${pickup.kind}`)
        .setOrigin(0.5, 1)
        .setPosition(pickup.x, ground - 1 - bob)
        .setDepth(pickup.z);
    }
    this.prune(this.pickupSprites, seen);
  }

  private spriteFor(
    sprites: Map<number, Phaser.GameObjects.Image>,
    thing: Projectile | Pickup,
    key: string,
  ): Phaser.GameObjects.Image {
    let sprite = sprites.get(thing.id);
    if (!sprite) {
      sprite = this.add.image(0, 0, key);
      sprites.set(thing.id, sprite);
    }
    return sprite;
  }

  private drawPlaceholder(f: Fighter, feet: { x: number; y: number }, visible: boolean): void {
    const stats = KINDS[f.kind];
    let box = this.placeholders.get(f.id);
    if (!box) {
      box = this.add.rectangle(0, 0, stats.halfWidth * 2, stats.height, 0xc04040).setOrigin(0.5, 1);
      box.setStrokeStyle(1, INK);
      this.placeholders.set(f.id, box);
    }
    box.setPosition(feet.x, feet.y).setDepth(f.z).setVisible(visible);
  }

  private prune(objects: Map<number, Phaser.GameObjects.GameObject>, seen: Set<number>): void {
    for (const [id, object] of objects) {
      if (!seen.has(id)) {
        object.destroy();
        objects.delete(id);
      }
    }
  }

  /** TOKEN's bar and standing order, top right, plus its speech bubble. */
  private drawToken(): void {
    const token = sidekick(this.world);
    const order = DIRECTIVE_LABELS[this.world.directive];
    this.touch.setOrderLabel(`TOKEN: ${order}`);
    if (!token) {
      this.tokenText.setText('');
      this.barkText.setVisible(false);
      return;
    }
    const width = 60;
    const health = token.state === 'dead' ? 0 : token.hp / KINDS.token.maxHp;
    drawBar(this.hud, SCREEN_W - 8 - width, 6, width, health, 0x60c0e0);
    const hint = this.touch.active ? '' : ' [Q]';
    const status = token.state === 'dead' ? 'REBOOTING' : order;
    this.tokenText.setText(`TOKEN ${status}${hint}`);

    const feet = feetPosition(token);
    this.barkText
      .setVisible(this.barkTicks > 0)
      .setPosition(
        Phaser.Math.Clamp(
          feet.x,
          this.world.cameraX + this.barkText.width / 2 + BARK_MARGIN,
          this.world.cameraX + SCREEN_W - this.barkText.width / 2 - BARK_MARGIN,
        ),
        Math.max(feet.y - BARK_RISE, 34),
      );
  }

  /** A named health bar along the bottom while a boss, or an interviewer in the hot seat, is up. */
  private drawBoss(): void {
    const boss = bossOf(this.world);
    const name = boss ? BOSS_NAMES[boss.kind] : undefined;
    this.bossText.setText(name ?? '');
    if (!boss || !name) return;
    // Whole-pixel placement: text centred on a half pixel smears in the pixel font.
    const nameLeft = Math.round((SCREEN_W - this.bossText.width - BOSS_NAME_GAP - BOSS_BAR_W) / 2);
    this.bossText.setX(nameLeft);
    const left = nameLeft + Math.round(this.bossText.width) + BOSS_NAME_GAP;
    drawBar(this.hud, left, BOSS_BAR_Y, BOSS_BAR_W, boss.hp / KINDS[boss.kind].maxHp, 0xe0a040);
  }

  private drawHud(): void {
    const matt = players(this.world)[0];
    this.hud.clear();
    drawBar(this.hud, 8, 6, 100, (matt?.hp ?? 0) / KINDS.matt.maxHp, 0xe0c040);
    this.scoreText.setText(`MATT  ${String(matt?.score ?? 0).padStart(6, '0')}`);
    this.drawToken();
    this.drawBoss();
    this.drawCard();

    const blink = Math.floor(this.world.tick / 15) % 2 === 0;
    const again = this.endedTicks > RESTART_DELAY_TICKS ? restartHint(this.touch.active) : '';
    const banner: Record<World['status'], string> = {
      playing: this.playingBanner(blink),
      cleared: clearedBanner(this.stage, again),
      gameover: `POSITION FILLED\n\n${again}`,
    };
    this.bannerText.setText(banner[this.world.status]);
  }

  /** The newest enemy's name card, over its head and inside the screen. */
  private drawCard(): void {
    const card = this.cards.current;
    const f = card && this.world.fighters.find((fighter) => fighter.id === card.id);
    this.card.setVisible(Boolean(f));
    if (!card || !f) return;
    this.card.setText(card.entry.head, card.entry.tagline);
    const feet = feetPosition(f);
    const half = this.card.width / 2 + BARK_MARGIN;
    this.card.setPosition(
      Phaser.Math.Clamp(feet.x, this.world.cameraX + half, this.world.cameraX + SCREEN_W - half),
      Math.max(feet.y - KINDS[f.kind].height - CARD_RISE, CARD_TOP + this.card.height),
    );
  }

  /** A timed card wins; otherwise the GO prompt, or the nudge to close out the last interviewer. */
  private playingBanner(blink: boolean): string {
    if (this.demo) return blink ? 'PRESS START' : '';
    if (this.bannerTicks > 0) return this.banner;
    if (this.world.goPrompt > 0) return blink ? 'GO >>' : '';
    return closingTime(this.world) && blink ? 'CLOSE THE DEAL!' : '';
  }
}
