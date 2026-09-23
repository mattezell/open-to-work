import { CRASH_DAMAGE, HAZARD_SCORE, type TunnelEvent } from '../sim/tunnel';

/**
 * What the tunnel scene shows for each hazard, kept free of Phaser so the
 * rules are testable. A clean clear and a crash have to read differently at a
 * glance, even mid-jump.
 */
export interface Pop {
  text: string;
  color: string;
}

export const CLEAR_COLOR = '#80f080';
export const CRASH_COLOR = '#ff6060';
export const SHIELD_COLOR = '#80d0ff';

/** The word that springs off Matt's board when a hazard goes by, if any. */
export function popFor(event: TunnelEvent): Pop | null {
  switch (event.type) {
    case 'cleared-hazard':
      return { text: `CLEAR +${HAZARD_SCORE}`, color: CLEAR_COLOR };
    case 'crash':
      return { text: `CRASH -${CRASH_DAMAGE}`, color: CRASH_COLOR };
    case 'shield':
      return { text: 'BLOCKED', color: SHIELD_COLOR };
    default:
      return null;
  }
}

/** Hurdles in the lanes in front of Matt turn see-through as he passes, so they never hide the jump. */
export const PASSING_HAZARD_ALPHA = 0.35;
const PASSING_REACH = 36;

/**
 * How opaque to draw one lane of a hazard `offset` pixels ahead of Matt. A
 * hurdle spans every lane, and the lanes nearer the camera would otherwise
 * cover Matt at the very moment he clears or clips it.
 */
export function hazardAlpha(laneZ: number, mattZ: number, offset: number): number {
  return laneZ > mattZ && Math.abs(offset) < PASSING_REACH ? PASSING_HAZARD_ALPHA : 1;
}

export const TUNNEL_INTRO = 'THE TAKE-HOME TUNNEL\n\njump the hurdles\nsteer round the walls';
export const TUNNEL_CLEARED = 'TAKE-HOME SUBMITTED\n\nnext: the interview tower';
