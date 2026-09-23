import Phaser from 'phaser';
import { DEPTH, SCREEN_H } from '../sim/constants';
import type { FighterKind } from '../sim/fighters';
import { sheetKey, SHEETS } from './animation';
import { BACKDROPS, HIRING_SIGN, layerSpan, signCentres, type BackdropStage } from './backdrops';
import { FLOOR_TOP } from './hud';
import { CELL_H, textWidth } from './pixel-font';
import { pixelText } from './pixel-text';

/**
 * What the brawler stages and the title screen share: the sprite sheets and
 * props, and the backdrops behind them. A stage shows its generated parallax
 * layers when all of them loaded, and its code-drawn backdrop otherwise.
 */

const STREET_TOP = FLOOR_TOP;
const PROPS = ['card', 'coffee', 'form', 'notes', 'folder', 'offer'] as const;
const SIGN_PAPER = 0xf0e8d0;
const SIGN_EDGE = 0x303030;
const SIGN_HEAD = '#b82828';
const SIGN_SMALL = '#404040';

/**
 * Queue every fighter sheet, prop and brawler backdrop layer. A missing file is reported through
 * `onMissing` so the scene can draw a placeholder box instead of failing.
 * Sheets already loaded by an earlier scene are skipped by the loader.
 */
export function loadSprites(scene: Phaser.Scene, onMissing: (key: string) => void): void {
  scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
    console.warn(`[otw] missing ${file.key}; drawing a code fallback`);
    onMissing(file.key);
  });
  for (const prop of PROPS) scene.load.image(`prop-${prop}`, `sprites/props/${prop}.png`);
  for (const layer of [...BACKDROPS.street, ...BACKDROPS.tower]) {
    scene.load.image(layer.key, layer.path);
  }
  for (const kind of Object.keys(SHEETS) as FighterKind[]) {
    for (const [sheet, def] of Object.entries(SHEETS[kind])) {
      scene.load.spritesheet(sheetKey(kind, sheet), `sprites/${kind}/${sheet}.png`, {
        frameWidth: def.frameWidth,
        frameHeight: def.frameHeight,
      });
    }
  }
}

/** Whether every generated layer of `stage` is loaded, so the set can be drawn whole. */
export function hasBackdrop(scene: Phaser.Scene, stage: BackdropStage): boolean {
  return BACKDROPS[stage].every((layer) => scene.textures.exists(layer.key));
}

/**
 * Lay the generated layers of a brawler stage along a stage `length` wide,
 * each standing on the floor line and scrolling at its own speed. Returns
 * false, drawing nothing, when any layer is missing.
 */
function drawLayers(scene: Phaser.Scene, stage: BackdropStage, length: number): boolean {
  if (!hasBackdrop(scene, stage)) return false;
  for (const layer of BACKDROPS[stage]) {
    const height = scene.textures.get(layer.key).getSourceImage().height;
    scene.add
      .tileSprite(0, STREET_TOP - height, layerSpan(length, layer.scroll), height, layer.key)
      .setOrigin(0)
      .setScrollFactor(layer.scroll, 1)
      .setDepth(layer.depth);
  }
  return true;
}

/** The street at night: the skyline and shopfronts over the pavement. */
export function drawStreet(scene: Phaser.Scene, length: number): void {
  const g = scene.add.graphics().setDepth(-10);
  if (drawLayers(scene, 'street', length)) drawHiringSigns(scene, length);
  else drawStreetSkyline(g, length);
  g.fillStyle(0x5a5a66).fillRect(0, STREET_TOP - 6, length, 6);
  g.fillStyle(0x44444e).fillRect(0, STREET_TOP, length, SCREEN_H - STREET_TOP);
  g.fillStyle(0x50505c);
  for (let x = 0; x < length; x += 48) g.fillRect(x, STREET_TOP + DEPTH / 2, 24, 2);
}

/** "WE'RE HIRING (not you)" on the banner in every hiring shop's window. */
function drawHiringSigns(scene: Phaser.Scene, length: number): void {
  const layer = BACKDROPS.street.find((l) => l.key === HIRING_SIGN.layer);
  if (!layer) return;
  const image = scene.textures.get(layer.key).getSourceImage();
  const span = layerSpan(length, layer.scroll);
  const [head, small] = HIRING_SIGN.lines;
  const width = textWidth(head) + 6;
  const height = 2 * CELL_H + 3;
  const top = STREET_TOP - image.height + HIRING_SIGN.top;
  const g = scene.add
    .graphics()
    .setScrollFactor(layer.scroll, 1)
    .setDepth(layer.depth + 0.5);
  for (const centre of signCentres(span, image.width, HIRING_SIGN.centreX)) {
    const left = Math.round(centre - width / 2);
    g.fillStyle(SIGN_EDGE).fillRect(left - 1, top - 1, width + 2, height + 2);
    g.fillStyle(SIGN_PAPER).fillRect(left, top, width, height);
    for (const [line, color, y] of [
      [head, SIGN_HEAD, top + 2],
      [small, SIGN_SMALL, top + 2 + CELL_H],
    ] as const) {
      pixelText(scene, Math.round(centre - textWidth(line) / 2), y, line, color)
        .setScrollFactor(layer.scroll, 1)
        .setDepth(layer.depth + 0.6);
    }
  }
}

/** The fallback street: a flat night sky over blocks of lit windows. */
function drawStreetSkyline(g: Phaser.GameObjects.Graphics, length: number): void {
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
}

/**
 * The top floor of the tower: a glass wall onto a sunset skyline, broken up
 * by concrete pillars, over grey office carpet, with the office furniture
 * along the window when the generated layers are there.
 */
export function drawTower(scene: Phaser.Scene, length: number): void {
  const g = scene.add.graphics().setDepth(-10);
  if (!drawLayers(scene, 'tower', length)) drawSunset(g, length);
  drawGlassFrame(g, length);
}

/** The fallback view out of the tower: sunset bands over a block skyline. */
function drawSunset(g: Phaser.GameObjects.Graphics, length: number): void {
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
}

/** The glass wall's glints, mullions and pillars, and the office carpet. */
function drawGlassFrame(g: Phaser.GameObjects.Graphics, length: number): void {
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
