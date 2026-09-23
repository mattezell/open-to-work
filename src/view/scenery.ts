import Phaser from 'phaser';
import { DEPTH, SCREEN_H } from '../sim/constants';
import type { FighterKind } from '../sim/fighters';
import { sheetKey, SHEETS } from './animation';
import { FLOOR_TOP } from './hud';

/**
 * What the brawler stages and the title screen share: the sprite sheets and
 * props, and the code-drawn backdrops behind them.
 */

const STREET_TOP = FLOOR_TOP;
const PROPS = ['card', 'coffee', 'form', 'notes', 'folder', 'offer'] as const;

/**
 * Queue every fighter sheet and prop. A missing sheet is reported through
 * `onMissing` so the scene can draw a placeholder box instead of failing.
 * Sheets already loaded by an earlier scene are skipped by the loader.
 */
export function loadSprites(scene: Phaser.Scene, onMissing: (key: string) => void): void {
  scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
    console.warn(`[otw] missing sprite sheet ${file.key}; drawing a placeholder box`);
    onMissing(file.key);
  });
  for (const prop of PROPS) scene.load.image(`prop-${prop}`, `sprites/props/${prop}.png`);
  for (const kind of Object.keys(SHEETS) as FighterKind[]) {
    for (const [sheet, def] of Object.entries(SHEETS[kind])) {
      scene.load.spritesheet(sheetKey(kind, sheet), `sprites/${kind}/${sheet}.png`, {
        frameWidth: def.frameWidth,
        frameHeight: def.frameHeight,
      });
    }
  }
}

/** The street at night: a lit skyline over the pavement. */
export function drawStreet(scene: Phaser.Scene, length: number): void {
  const g = scene.add.graphics().setDepth(-10);
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

/**
 * The top floor of the tower: a glass wall onto a sunset skyline, broken up
 * by concrete pillars, over grey office carpet.
 */
export function drawTower(scene: Phaser.Scene, length: number): void {
  const g = scene.add.graphics().setDepth(-10);
  const bands = [0xf0a050, 0xe07850, 0xb05868, 0x6a4a78, 0x3a3660];
  const bandH = Math.ceil(STREET_TOP / bands.length);
  bands.forEach((color, i) => {
    g.fillStyle(color).fillRect(0, STREET_TOP - (i + 1) * bandH, length, bandH);
  });
  for (let x = 0; x < length; x += 40) {
    const height = 24 + ((x * 53) % 40);
    g.fillStyle(0x28243c).fillRect(x, STREET_TOP - height, 34, height);
    g.fillStyle(0xf0d080);
    for (let wy = STREET_TOP - height + 5; wy < STREET_TOP - 6; wy += 8) {
      if ((x * 3 + wy) % 7 < 3) g.fillRect(x + 5 + ((wy * 5) % 20), wy, 3, 3);
    }
  }
  g.fillStyle(0xffffff, 0.08);
  for (let x = 0; x < length; x += 96) g.fillTriangle(x, 0, x + 30, 0, x, 60);
  g.fillStyle(0x505868);
  for (let x = 0; x < length; x += 96) g.fillRect(x - 2, 0, 4, STREET_TOP);
  for (let x = 0; x < length; x += 384) {
    g.fillStyle(0x6a7282).fillRect(x + 188, 0, 20, STREET_TOP);
    g.fillStyle(0x4a5262).fillRect(x + 204, 0, 4, STREET_TOP);
  }
  g.fillStyle(0x3a3e4a).fillRect(0, STREET_TOP - 6, length, 6);
  g.fillStyle(0x5a6070).fillRect(0, STREET_TOP, length, SCREEN_H - STREET_TOP);
  g.fillStyle(0x525868);
  for (let x = 0; x < length; x += 32) g.fillRect(x, STREET_TOP, 1, SCREEN_H - STREET_TOP);
  for (let z = 14; z < DEPTH; z += 14) g.fillRect(0, STREET_TOP + z, length, 1);
}

/**
 * Call `handler` on a tap or click anywhere on the page while `scene` runs.
 * The tap that brought the scene up is not counted. The on-screen pills stop
 * their own taps, so SOUND never doubles as start.
 */
export function onAnyTap(scene: Phaser.Scene, handler: () => void): void {
  const openedAt = performance.now();
  const onTap = (e: PointerEvent): void => {
    if (e.timeStamp >= openedAt) handler();
  };
  window.addEventListener('pointerdown', onTap);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
    window.removeEventListener('pointerdown', onTap),
  );
}
