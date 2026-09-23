import type Phaser from 'phaser';
import { DEPTH, SCREEN_H, TICK_HZ } from '../sim/constants';

/** What every stage scene shares: timing, the floor line, the bars. */

/** Screen y of the back edge of the floor band (z = 0), on the street and in the tunnel. */
export const FLOOR_TOP = SCREEN_H - DEPTH - 18;
export const TICK_MS = 1000 / TICK_HZ;
/** Never simulate more than this many ticks per rendered frame, so a stalled tab cannot spiral. */
export const MAX_TICKS_PER_FRAME = 5;
/** After a stage ends, ignore buttons this long so a mashing player sees the result screen. */
export const RESTART_DELAY_TICKS = TICK_HZ;
export const HURT_BUZZ_MS = 40;
/** How long a bark stays up, and how long before chatter may replace it. */
export const BARK_TICKS = 100;
export const BARK_MIN_TICKS = 40;

export const INK = 0x101010;

export function restartHint(touch: boolean): string {
  return touch ? 'tap a button' : 'press enter';
}

/** An inked bar: dark red track, `color` fill for `fraction` of it. */
export function drawBar(
  g: Phaser.GameObjects.Graphics,
  left: number,
  top: number,
  width: number,
  fraction: number,
  color: number,
): void {
  const fill = Math.round(width * Math.min(1, Math.max(0, fraction)));
  g.fillStyle(INK).fillRect(left - 1, top - 1, width + 2, 8);
  g.fillStyle(0x803030).fillRect(left, top, width, 6);
  g.fillStyle(color).fillRect(left, top, fill, 6);
}
