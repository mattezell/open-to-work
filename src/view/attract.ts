import { TICK_HZ } from '../sim/constants';
import type { InputFrame } from '../sim/input';
import { ROSTER } from './help';

/**
 * The arcade attract loop: the title, then the enemies one at a time, then
 * a demo of the bot playing the street, then the title again. Any start
 * button at any point starts a real run.
 */
export const TITLE_SCENE = 'title';
export const TITLE_TICKS = 10 * TICK_HZ;
export const ROSTER_ENTRY_TICKS = Math.round(1.5 * TICK_HZ);
export const DEMO_TICKS = 30 * TICK_HZ;
/** The demo always plays the same street, so it is the one the tests watched. */
export const DEMO_SEED = 7;

export type AttractScreen =
  { screen: 'title' } | { screen: 'roster'; index: number } | { screen: 'demo' };

/** What the title scene shows `ticks` after it opened. */
export function attractScreen(ticks: number): AttractScreen {
  if (ticks < TITLE_TICKS) return { screen: 'title' };
  const index = Math.floor((ticks - TITLE_TICKS) / ROSTER_ENTRY_TICKS);
  return index < ROSTER.length ? { screen: 'roster', index } : { screen: 'demo' };
}

/** The buttons that start a run from the title or the demo. Moving the stick does not. */
export function startPressed(frame: InputFrame): boolean {
  return frame.attack || frame.jump || frame.special;
}

export function startHint(touch: boolean): string {
  return touch ? 'tap to start' : 'enter, space or J';
}
