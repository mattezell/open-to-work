import type { World } from './world';

/**
 * The Ghoster answers one message, then vanishes: every time it is hit, it
 * fades out of play as soon as it recovers, drifts round behind its target,
 * and fades back in a beat before it swings again.
 */
export const GHOST_TICKS = 80;
/** Once visible again it waits this long before it may swing, so the return reads. */
const RETURN_GRACE_TICKS = 30;

export function updateGhosters(world: World): void {
  for (const f of world.fighters) {
    if (f.kind !== 'ghoster' || f.state === 'dead') continue;
    if (f.ghost > 0) {
      f.ghost--;
      continue;
    }
    if (f.state === 'hurt' || f.state === 'knockdown' || f.state === 'getup') {
      f.ghostDue = f.hp > 0;
      continue;
    }
    if (f.ghostDue) {
      f.ghostDue = false;
      f.ghost = GHOST_TICKS;
      f.cooldown = GHOST_TICKS + RETURN_GRACE_TICKS;
      world.events.push({ type: 'ghosted', id: f.id });
    }
  }
}
