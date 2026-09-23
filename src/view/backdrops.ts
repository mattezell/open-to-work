import { SCREEN_W } from '../sim/constants';

/**
 * The generated parallax layers behind each stage, far to near. Phaser-free
 * so the layer plan is tested; src/view/scenery.ts draws it, and falls back
 * to the code-drawn backdrop when any layer of a stage failed to load.
 */

export type BackdropStage = 'street' | 'tunnel' | 'tower';

export interface BackdropLayer {
  /** Texture key, and the file under public/ it loads from. */
  key: string;
  path: string;
  /** How far it moves per pixel the camera moves: 0 is fixed to the sky, 1 moves with the floor. */
  scroll: number;
  /** Display depth. Every layer sits behind the fighters, whose depth is their z. */
  depth: number;
}

/** Below the code-drawn floor and frame (depth -10), in draw order. */
const FAR = -22;
const MID = -21;
const NEAR = -20;
/** In front of the tower's glass frame but still behind the fight. */
const INDOORS = -9;

function layer(name: string, scroll: number, depth: number): BackdropLayer {
  return { key: `bg-${name}`, path: `sprites/bg/${name}.png`, scroll, depth };
}

export const BACKDROPS: Record<BackdropStage, readonly BackdropLayer[]> = {
  street: [
    layer('street-far', 0.15, FAR),
    layer('street-mid', 0.4, MID),
    layer('street-near', 1, NEAR),
  ],
  // The tunnel scrolls by distance ridden rather than by camera.
  tunnel: [layer('tunnel-far', 0.25, FAR), layer('tunnel-near', 0.6, NEAR)],
  tower: [layer('tower-far', 0.15, FAR), layer('tower-near', 1, INDOORS)],
};

/**
 * How wide a layer must be to cover a stage `length` pixels long: the screen,
 * plus the share of the rest of the stage that the layer scrolls past.
 */
export function layerSpan(length: number, scroll: number): number {
  return Math.ceil(SCREEN_W + Math.max(0, length - SCREEN_W) * scroll);
}

/**
 * The paper banner taped across the hiring shop's window on the street's
 * near layer, drawn in the pixel font because the art is generated without
 * text. Its place is in the layer's own tile, read off the generated image
 * (the shop is the left third of public/sprites/bg/street-near.png); if that
 * image is regenerated, find the window again and move it.
 */
export const HIRING_SIGN = {
  layer: 'bg-street-near',
  lines: ["WE'RE HIRING", '(not you)'],
  centreX: 36,
  top: 60,
} as const;

/** Where the sign's centre falls in each repeat of a tile `tileWidth` wide, along `span`. */
export function signCentres(span: number, tileWidth: number, centreX: number): number[] {
  const centres: number[] = [];
  for (let x = centreX; x < span; x += tileWidth) centres.push(x);
  return centres;
}
