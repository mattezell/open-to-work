import { DEPTH_TOLERANCE } from './constants';
import { ATTACKS, KINDS, SPECIAL_COST } from './fighters';
import { input, NO_INPUT, type InputFrame } from './input';
import { livingEnemies, players, type Fighter, type World } from './world';

const STRIKE_GAP = 22;
const ALIGN_SLOP = 3;
const CROWD_RADIUS = 44;

function nearest(me: Fighter, enemies: Fighter[]): Fighter | undefined {
  return enemies.reduce<Fighter | undefined>((best, e) => {
    if (!best) return e;
    const d = Math.abs(e.x - me.x) + Math.abs(e.z - me.z);
    const bestD = Math.abs(best.x - me.x) + Math.abs(best.z - me.z);
    return d < bestD ? e : best;
  }, undefined);
}

/**
 * A plain scripted player: walk right, line up with the nearest enemy, mash
 * the chain, spin out when flanked. The beatability proof runs this headless;
 * if it cannot clear a stage within budget, the stage is too hard to ship.
 */
export function botInput(world: World, index = 0): InputFrame {
  const me = players(world)[index];
  if (!me || me.state === 'dead') return NO_INPUT;
  const standing = livingEnemies(world).filter(
    (e) => e.state !== 'knockdown' && e.state !== 'getup',
  );
  const target = nearest(me, standing);
  if (!target) {
    return livingEnemies(world).length === 0 ? input({ right: true }) : NO_INPUT;
  }

  const flanked =
    standing.some((e) => e.x < me.x && me.x - e.x < CROWD_RADIUS) &&
    standing.some((e) => e.x > me.x && e.x - me.x < CROWD_RADIUS);
  if (flanked && me.hp > SPECIAL_COST * 3 && world.tick % 2 === 0) {
    return input({ special: true });
  }

  const side = target.x >= me.x ? 1 : -1;
  const dx = target.x - side * STRIKE_GAP - me.x;
  const dz = target.z - me.z;
  const aligned = Math.abs(dz) <= DEPTH_TOLERANCE - 2;
  const inRange =
    Math.abs(target.x - me.x) <= ATTACKS.jab1.reach + KINDS[target.kind].halfWidth - 2;
  if (aligned && inRange) {
    if (me.facing !== side) return input({ right: side === 1, left: side === -1 });
    return input({ attack: world.tick % 2 === 0 });
  }
  return input({
    right: dx > ALIGN_SLOP,
    left: dx < -ALIGN_SLOP,
    down: dz > ALIGN_SLOP,
    up: dz < -ALIGN_SLOP,
  });
}
