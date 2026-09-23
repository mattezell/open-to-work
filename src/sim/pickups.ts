import { KINDS } from './fighters';
import type { PickupKind } from './stage';
import type { Fighter, World } from './world';

/** How much health a coffee gives back. */
export const COFFEE_HEAL = 30;
const REACH_X = 14;
const REACH_Z = 8;

const HEAL: Record<PickupKind, number> = { coffee: COFFEE_HEAL };

function canCollect(f: Fighter): boolean {
  return f.pilot === 'human' && (f.state === 'idle' || f.state === 'walk');
}

/**
 * A player walking over a pickup takes it, but only when it would help: coffee
 * at full health stays on the street for later.
 */
export function collectPickups(world: World): void {
  world.pickups = world.pickups.filter((pickup) => {
    const taker = world.fighters.find(
      (f) =>
        canCollect(f) &&
        f.hp < KINDS[f.kind].maxHp &&
        Math.abs(f.x - pickup.x) <= REACH_X &&
        Math.abs(f.z - pickup.z) <= REACH_Z,
    );
    if (!taker) return true;
    taker.hp = Math.min(KINDS[taker.kind].maxHp, taker.hp + HEAL[pickup.kind]);
    world.events.push({ type: 'pickup', kind: pickup.kind, by: taker.id });
    return false;
  });
}
