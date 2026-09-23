import Phaser from 'phaser';
import { carryFromStreet, type Carry } from '../sim/campaign';
import { DEPTH, SCREEN_H, SCREEN_W } from '../sim/constants';
import { KINDS, PROJECTILES, type FighterKind } from '../sim/fighters';
import type { InputFrame } from '../sim/input';
import { STAGE_1 } from '../sim/stage';
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
import { poseFor, sheetKey, SHEETS } from './animation';
import { barkFor, DIRECTIVE_LABELS } from './barks';
import { mergeInputs, type HeldKeys } from './controls';
import { sharedDevices } from './devices';
import {
  BARK_MIN_TICKS,
  BARK_TICKS,
  drawBar,
  FLOOR_TOP,
  HUD_TEXT,
  HURT_BUZZ_MS,
  INK,
  MAX_TICKS_PER_FRAME,
  RESTART_DELAY_TICKS,
  restartHint,
  TICK_MS,
} from './hud';
import type { TouchPad } from './touch';

/** Screen y of the back edge of the walkable street (z = 0). */
const STREET_TOP = FLOOR_TOP;
/** How far above TOKEN's feet a bark sits. */
const BARK_RISE = 70;

/** The boss name and bar share one line in the strip below the street, clear of any feet. */
const BOSS_BAR_W = 150;
const BOSS_BAR_Y = SCREEN_H - 11;
const BOSS_NAME_GAP = 6;
const BOSS_NAMES: Partial<Record<FighterKind, string>> = { takehome: 'THE UNPAID TAKE HOME' };
/** Coffee bobs gently so it reads as something to grab. */
const PICKUP_BOB_TICKS = 40;

/** Where a fighter's feet land on screen, in world pixels (the camera handles scroll). */
export function feetPosition(f: Fighter): { x: number; y: number } {
  return { x: Math.round(f.x), y: Math.round(STREET_TOP + f.z - f.y) };
}

/** A KO'd enemy blinks out before it is removed. TOKEN lies still while it reboots. */
function isFadingCorpse(f: Fighter): boolean {
  return f.state === 'dead' && f.team === 'enemy' && f.stateTick % 6 < 3;
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
  private scoreText!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private tokenText!: Phaser.GameObjects.Text;
  private barkText!: Phaser.GameObjects.Text;
  private bossText!: Phaser.GameObjects.Text;
  private barkTicks = 0;
  /** Set when the scene is entered from an earlier stage; a restart after a loss starts fresh. */
  private carry: Carry | undefined;

  constructor() {
    super('game');
  }

  init(data: { carry?: Carry }): void {
    this.carry = data.carry;
  }

  preload(): void {
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn(`[otw] missing sprite sheet ${file.key}; drawing a placeholder box`);
      this.missingSheets.add(file.key);
    });
    this.load.image('prop-card', 'sprites/props/card.png');
    this.load.image('prop-coffee', 'sprites/props/coffee.png');
    for (const kind of Object.keys(SHEETS) as FighterKind[]) {
      for (const [sheet, def] of Object.entries(SHEETS[kind])) {
        this.load.spritesheet(sheetKey(kind, sheet), `sprites/${kind}/${sheet}.png`, {
          frameWidth: def.frameWidth,
          frameHeight: def.frameHeight,
        });
      }
    }
  }

  create(): void {
    ({ keys: this.keys, touch: this.touch } = sharedDevices(this.game));
    this.drawStreet();
    this.shadows = this.add.graphics().setDepth(-1);
    this.hud = this.add.graphics().setScrollFactor(0).setDepth(1000);
    this.scoreText = this.add.text(8, 16, '', HUD_TEXT).setScrollFactor(0).setDepth(1001);
    this.tokenText = this.add
      .text(SCREEN_W - 8, 16, '', { ...HUD_TEXT, align: 'right' })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1001);
    this.barkText = this.add
      .text(0, 0, '', { ...HUD_TEXT, backgroundColor: '#101010', padding: { x: 2, y: 1 } })
      .setOrigin(0.5, 1)
      .setDepth(999);
    this.bossText = this.add
      .text(0, BOSS_BAR_Y - 2, '', HUD_TEXT)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1001);
    this.bannerText = this.add
      .text(SCREEN_W / 2, 80, '', { ...HUD_TEXT, fontSize: '16px', align: 'center' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1001);
    this.input.keyboard?.on('keydown-ENTER', () => {
      if (this.world.status !== 'playing') this.advance();
    });
    this.restart();
  }

  update(_time: number, delta: number): void {
    this.accumulator = Math.min(this.accumulator + delta, TICK_MS * MAX_TICKS_PER_FRAME);
    while (this.accumulator >= TICK_MS) {
      this.accumulator -= TICK_MS;
      this.tick(mergeInputs(this.keys.snapshot(), this.touch.snapshot()));
    }
    this.cameras.main.scrollX = Math.round(this.world.cameraX);
    this.drawFighters();
    this.drawProjectiles();
    this.drawPickups();
    this.drawHud();
  }

  private tick(frame: InputFrame): void {
    if (this.world.status !== 'playing') {
      this.endedTicks++;
      const pressed = frame.attack || frame.jump || frame.special;
      if (pressed && this.endedTicks > RESTART_DELAY_TICKS) this.advance();
      return;
    }
    step(this.world, [frame]);
    this.showBarks();
    const hp = players(this.world)[0]?.hp ?? 0;
    if (hp < this.lastHp) this.touch.buzz(HURT_BUZZ_MS);
    this.lastHp = hp;
  }

  /** Off to the tunnel after a clear; back to the top of the street after a loss. */
  private advance(): void {
    if (this.world.status === 'cleared') {
      this.scene.start('tunnel', { carry: carryFromStreet(this.world) });
      return;
    }
    this.carry = undefined;
    this.restart();
  }

  private restart(): void {
    this.world = createWorld(STAGE_1, Date.now() >>> 0, { carry: this.carry });
    this.accumulator = 0;
    this.endedTicks = 0;
    this.lastHp = players(this.world)[0]?.hp ?? 0;
    this.barkTicks = 0;
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

  private drawStreet(): void {
    const g = this.add.graphics().setDepth(-10);
    const length = STAGE_1.length + SCREEN_W;
    g.fillStyle(0x2a2440).fillRect(0, 0, length, STREET_TOP);
    for (let x = 0; x < length; x += 64) {
      const height = 60 + ((x * 37) % 50);
      g.fillStyle(0x3b3358).fillRect(x, STREET_TOP - height, 56, height);
      g.fillStyle(0xe0c060);
      for (let wy = STREET_TOP - height + 8; wy < STREET_TOP - 12; wy += 14) {
        for (let wx = x + 6; wx < x + 50; wx += 12) {
          if ((wx * 7 + wy * 13) % 5 === 0) g.fillRect(wx, wy, 5, 6);
        }
      }
    }
    g.fillStyle(0x5a5a66).fillRect(0, STREET_TOP - 6, length, 6);
    g.fillStyle(0x44444e).fillRect(0, STREET_TOP, length, SCREEN_H - STREET_TOP);
    g.fillStyle(0x50505c);
    for (let x = 0; x < length; x += 48) g.fillRect(x, STREET_TOP + DEPTH / 2, 24, 2);
  }

  private drawFighters(): void {
    this.shadows.clear();
    const seen = new Set<number>();
    for (const f of this.world.fighters) {
      seen.add(f.id);
      const feet = feetPosition(f);
      const ground = Math.round(STREET_TOP + f.z);
      this.shadows.fillStyle(0x000000, 0.35).fillEllipse(feet.x, ground, 30, 6);
      const visible = f.invuln === 0 || Math.floor(this.world.tick / 3) % 2 === 0;
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
        .setVisible(visible && !isFadingCorpse(f));
    }
    this.prune(this.sprites, seen);
    this.prune(this.placeholders, seen);
  }

  /** Business cards in flight, at throwing height, with a small shadow so their depth line reads. */
  private drawProjectiles(): void {
    const seen = new Set<number>();
    for (const p of this.world.projectiles) {
      seen.add(p.id);
      const ground = Math.round(STREET_TOP + p.z);
      this.shadows.fillStyle(0x000000, 0.35).fillEllipse(Math.round(p.x), ground, 10, 3);
      const sprite = this.spriteFor(this.projectileSprites, p, 'prop-card');
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
          this.world.cameraX + this.barkText.width / 2 + 2,
          this.world.cameraX + SCREEN_W - this.barkText.width / 2 - 2,
        ),
        Math.max(feet.y - BARK_RISE, 34),
      );
  }

  /** A named health bar along the bottom while a boss is on the street. */
  private drawBoss(): void {
    const boss = this.world.fighters.find((f) => BOSS_NAMES[f.kind] && f.state !== 'dead');
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

    const go = this.world.goPrompt > 0 && Math.floor(this.world.tick / 15) % 2 === 0;
    const again = this.endedTicks > RESTART_DELAY_TICKS ? restartHint(this.touch.active) : '';
    const banner: Record<World['status'], string> = {
      playing: go ? 'GO >>' : '',
      cleared: `STAGE CLEAR\n\nnext: the take-home tunnel\n\n${again}`,
      gameover: `POSITION FILLED\n\n${again}`,
    };
    this.bannerText.setText(banner[this.world.status]);
  }
}
