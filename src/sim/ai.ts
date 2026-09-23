import {
  DEPTH_TOLERANCE,
  MAX_CONCURRENT_ENEMY_ATTACKS,
  SCREEN_MARGIN,
  SCREEN_W,
} from './constants';
import { ATTACKS, KINDS } from './fighters';
import { NO_INPUT, input, type InputFrame } from './input';
import { randomInt } from './rng';
import type { Fighter, World } from './world';

const DEADZONE = 2;
const ENGAGE_GAP = 26;
/** While cooling down, enemies circle at this gap instead of crowding. */
const WAIT_GAP = 48;

function nearestTarget(world: World, enemy: Fighter): Fighter | null {
  let best: Fighter | null = null;
  let bestDist = Infinity;
  for (const f of world.fighters) {
    if (f.team === enemy.team || f.state === 'dead') continue;
    const dist = Math.abs(f.x - enemy.x) + Math.abs(f.z - enemy.z);
    if (dist < bestDist) {
      best = f;
      bestDist = dist;
    }
  }
  return best;
}

function attackersInFlight(world: World): number {
  return world.fighters.filter((f) => f.team === 'enemy' && f.state === 'attack').length;
}

function isOnScreen(world: World, x: number): boolean {
  return x >= world.cameraX + SCREEN_MARGIN && x <= world.cameraX + SCREEN_W - SCREEN_MARGIN;
}

/**
 * Stay on the enemy's current side of the target unless that slot is off
 * screen: a player pinned against the locked camera edge must never be hit by
 * something standing where they cannot see or reach it.
 */
function chooseSide(world: World, enemy: Fighter, target: Fighter, gap: number): 1 | -1 {
  const current = enemy.x >= target.x ? 1 : -1;
  if (isOnScreen(world, target.x + current * gap)) return current;
  return current === 1 ? -1 : 1;
}

/** An enemy drives itself through the same controls a player uses. */
export function enemyIntent(world: World, enemy: Fighter): InputFrame {
  if (enemy.state !== 'idle' && enemy.state !== 'walk') return NO_INPUT;
  const target = nearestTarget(world, enemy);
  if (!target) return NO_INPUT;

  const gap = enemy.cooldown > 0 ? WAIT_GAP : ENGAGE_GAP;
  const side = chooseSide(world, enemy, target, gap);
  const dx = target.x + side * gap - enemy.x;
  const dz = target.z - enemy.z;
  const facingTarget = (target.x - enemy.x) * enemy.facing >= 0;
  const onScreen = isOnScreen(world, enemy.x);
  const reach = ATTACKS.shred.reach + KINDS[target.kind].halfWidth;
  const inRange = Math.abs(target.x - enemy.x) <= reach - 2 && Math.abs(dz) <= DEPTH_TOLERANCE - 2;
  const targetStanding = target.state !== 'knockdown' && target.state !== 'getup';

  if (
    inRange &&
    onScreen &&
    facingTarget &&
    targetStanding &&
    enemy.cooldown === 0 &&
    attackersInFlight(world) < MAX_CONCURRENT_ENEMY_ATTACKS
  ) {
    enemy.cooldown = randomInt(world, 70, 120);
    return input({ attack: true });
  }

  const wantRight = dx > DEADZONE || (!facingTarget && side === -1);
  const wantLeft = dx < -DEADZONE || (!facingTarget && side === 1);
  return input({
    right: wantRight && !wantLeft,
    left: wantLeft && !wantRight,
    down: dz > DEADZONE,
    up: dz < -DEADZONE,
  });
}
