import Phaser from 'phaser';
import { DEPTH, SCREEN_H, SCREEN_W, TICK_HZ } from '../sim/constants';
import { KINDS, type FighterKind } from '../sim/fighters';
import { STAGE_1 } from '../sim/stage';
import { createWorld, players, step, type Fighter, type World } from '../sim/world';
import { poseFor, sheetKey, SHEETS } from './animation';
import { HeldKeys } from './controls';

/** Screen y of the back edge of the walkable street (z = 0). */
const STREET_TOP = SCREEN_H - DEPTH - 18;
const TICK_MS = 1000 / TICK_HZ;
/** Never simulate more than this many ticks per rendered frame, so a stalled tab cannot spiral. */
const MAX_TICKS_PER_FRAME = 5;

const INK = 0x101010;
const HUD_TEXT: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '8px',
  color: '#f0f0e0',
  resolution: 4,
};

/** Where a fighter's feet land on screen, in world pixels (the camera handles scroll). */
export function feetPosition(f: Fighter): { x: number; y: number } {
  return { x: Math.round(f.x), y: Math.round(STREET_TOP + f.z - f.y) };
}

export class GameScene extends Phaser.Scene {
  private world!: World;
  private keys!: HeldKeys;
  private accumulator = 0;
  private readonly sprites = new Map<number, Phaser.GameObjects.Sprite>();
  private readonly placeholders = new Map<number, Phaser.GameObjects.Rectangle>();
  private readonly missingSheets = new Set<string>();
  private shadows!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;

  constructor() {
    super('game');
  }

  preload(): void {
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn(`[otw] missing sprite sheet ${file.key}; drawing a placeholder box`);
      this.missingSheets.add(file.key);
    });
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
    this.keys = new HeldKeys(window);
    this.drawStreet();
    this.shadows = this.add.graphics().setDepth(-1);
    this.hud = this.add.graphics().setScrollFactor(0).setDepth(1000);
    this.scoreText = this.add.text(8, 16, '', HUD_TEXT).setScrollFactor(0).setDepth(1001);
    this.bannerText = this.add
      .text(SCREEN_W / 2, 80, '', { ...HUD_TEXT, fontSize: '16px' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1001);
    this.input.keyboard?.on('keydown-ENTER', () => {
      if (this.world.status !== 'playing') this.restart();
    });
    this.restart();
  }

  update(_time: number, delta: number): void {
    this.accumulator = Math.min(this.accumulator + delta, TICK_MS * MAX_TICKS_PER_FRAME);
    while (this.accumulator >= TICK_MS) {
      this.accumulator -= TICK_MS;
      if (this.world.status === 'playing') step(this.world, [this.keys.snapshot()]);
    }
    this.cameras.main.scrollX = Math.round(this.world.cameraX);
    this.drawFighters();
    this.drawHud();
  }

  private restart(): void {
    this.world = createWorld(STAGE_1, Date.now() >>> 0);
    this.accumulator = 0;
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
        .setVisible(visible && !(f.state === 'dead' && f.stateTick % 6 < 3));
    }
    this.prune(this.sprites, seen);
    this.prune(this.placeholders, seen);
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

  private drawHud(): void {
    const matt = players(this.world)[0];
    const hp = matt?.hp ?? 0;
    const max = KINDS.matt.maxHp;
    this.hud.clear();
    this.hud.fillStyle(INK).fillRect(7, 5, 102, 8);
    this.hud.fillStyle(0x803030).fillRect(8, 6, 100, 6);
    this.hud.fillStyle(0xe0c040).fillRect(8, 6, Math.round((100 * hp) / max), 6);
    this.scoreText.setText(`MATT  ${String(matt?.score ?? 0).padStart(6, '0')}`);

    const go = this.world.goPrompt > 0 && Math.floor(this.world.tick / 15) % 2 === 0;
    const banner: Record<World['status'], string> = {
      playing: go ? 'GO >>' : '',
      cleared: 'OFFER EXTENDED\n\npress enter',
      gameover: 'POSITION FILLED\n\npress enter',
    };
    this.bannerText.setText(banner[this.world.status]);
  }
}
