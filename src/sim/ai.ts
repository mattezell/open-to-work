import {
  DEPTH,
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
/**
 * The hiring process is after Matt: TOKEN only draws an enemy's attention when
 * it is this much closer than he is.
 */
const SIDEKICK_AGGRO_PENALTY = 60;
/** Enemies closer than this to each other step apart instead of stacking. */
const PERSONAL_SPACE_X = 24;
const PERSONAL_SPACE_Z = 10;
const CROWD_REACH = 80;
/** Ticks an enemy waits between swings. */
const ENEMY_COOLDOWN_MIN = 45;
const ENEMY_COOLDOWN_MAX = 80;
/** A Spam Recruiter keeps this far off, throws from no closer than THROW_MIN, and backs off inside it. */
const THROW_GAP = 100;
const THROW_MIN = 48;
const THROW_COOLDOWN_MIN = 90;
const THROW_COOLDOWN_MAX = 140;

function nearestTarget(world: World, enemy: Fighter): Fighter | null {
  let best: Fighter | null = null;
  let bestDist = Infinity;
  for (const f of world.fighters) {
    if (f.team === enemy.team || f.state === 'dead') continue;
    const penalty = f.pilot === 'human' ? 0 : SIDEKICK_AGGRO_PENALTY;
    const dist = Math.abs(f.x - enemy.x) + Math.abs(f.z - enemy.z) + penalty;
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

function otherEnemies(world: World, enemy: Fighter): Fighter[] {
  return world.fighters.filter((f) => f.team === 'enemy' && f !== enemy && f.state !== 'dead');
}

/** Enemies on `side` of the target, close enough to be part of the scrum. */
function crowdOn(enemies: Fighter[], target: Fighter, side: 1 | -1): number {
  return enemies.filter((e) => {
    const offset = (e.x - target.x) * side;
    return offset > 0 && offset <= CROWD_REACH;
  }).length;
}

/**
 * Stay on the enemy's current side of the target unless the current slot is
 * off screen (a player pinned against the locked camera edge must never be
 * hit by something standing where they cannot see or reach it), or the other
 * side is emptier. Lower ids hold their side, so a crowd splits around the
 * target once instead of both enemies flipping back and forth.
 */
function chooseSide(world: World, enemy: Fighter, target: Fighter, gap: number): 1 | -1 {
  const current = enemy.x >= target.x ? 1 : -1;
  const other = current === 1 ? -1 : 1;
  if (!isOnScreen(world, target.x + current * gap)) return other;
  const others = otherEnemies(world, enemy);
  const senior = others.filter((e) => e.id < enemy.id);
  const emptier = crowdOn(others, target, other) < crowdOn(senior, target, current);
  return emptier && isOnScreen(world, target.x + other * gap) ? other : current;
}

/**
 * Depth nudge away from any enemy crowding this one. The higher id yields, so
 * two overlapping enemies never both step the same way.
 */
function separation(world: World, enemy: Fighter): number {
  for (const other of otherEnemies(world, enemy)) {
    if (other.id > enemy.id) continue;
    if (Math.abs(other.x - enemy.x) >= PERSONAL_SPACE_X) continue;
    if (Math.abs(other.z - enemy.z) >= PERSONAL_SPACE_Z) continue;
    const away = enemy.z >= other.z ? 1 : -1;
    const roomy = away === 1 ? enemy.z < DEPTH - PERSONAL_SPACE_Z : enemy.z > PERSONAL_SPACE_Z;
    return roomy ? away : -away;
  }
  return 0;
}

function isStanding(f: Fighter): boolean {
  return f.state !== 'knockdown' && f.state !== 'getup';
}

function canSwing(world: World, enemy: Fighter): boolean {
  return enemy.cooldown === 0 && attackersInFlight(world) < MAX_CONCURRENT_ENEMY_ATTACKS;
}

function steer(
  dx: number,
  dz: number,
  nudge: number,
  turnRight: boolean,
  turnLeft: boolean,
): InputFrame {
  const wantRight = dx > DEADZONE || turnRight;
  const wantLeft = dx < -DEADZONE || turnLeft;
  return input({
    right: wantRight && !wantLeft,
    left: wantLeft && !wantRight,
    down: nudge === 1 || (nudge === 0 && dz > DEADZONE),
    up: nudge === -1 || (nudge === 0 && dz < -DEADZONE),
  });
}

/** Walk up, line up, swing: the ATS Bot and the Unpaid Take Home. */
function brawlerIntent(world: World, enemy: Fighter, target: Fighter): InputFrame {
  const gap = enemy.cooldown > 0 ? WAIT_GAP : ENGAGE_GAP;
  const side = chooseSide(world, enemy, target, gap);
  const dx = target.x + side * gap - enemy.x;
  const dz = target.z - enemy.z;
  const facingTarget = (target.x - enemy.x) * enemy.facing >= 0;
  const reach = ATTACKS[KINDS[enemy.kind].basicAttack].reach + KINDS[target.kind].halfWidth;
  const inRange = Math.abs(target.x - enemy.x) <= reach - 2 && Math.abs(dz) <= DEPTH_TOLERANCE - 2;

  if (
    inRange &&
    isOnScreen(world, enemy.x) &&
    facingTarget &&
    isStanding(target) &&
    canSwing(world, enemy)
  ) {
    enemy.cooldown = randomInt(world, ENEMY_COOLDOWN_MIN, ENEMY_COOLDOWN_MAX);
    return input({ attack: true });
  }
  return steer(
    dx,
    dz,
    separation(world, enemy),
    !facingTarget && side === -1,
    !facingTarget && side === 1,
  );
}

/**
 * The Spam Recruiter keeps its distance, lines up on the target's depth and
 * flings business cards. Walk into it and it backs away; it never throws from
 * off screen, where nobody could see the card coming.
 */
function throwerIntent(world: World, enemy: Fighter, target: Fighter): InputFrame {
  const side = chooseSide(world, enemy, target, THROW_GAP);
  const spot = clamp(
    target.x + side * THROW_GAP,
    world.cameraX + SCREEN_MARGIN,
    world.cameraX + SCREEN_W - SCREEN_MARGIN,
  );
  const dz = target.z - enemy.z;
  const distance = Math.abs(target.x - enemy.x);
  const facing = target.x >= enemy.x ? 1 : -1;
  const aligned = Math.abs(dz) <= DEPTH_TOLERANCE - 2;

  if (
    aligned &&
    distance >= THROW_MIN &&
    enemy.facing === facing &&
    isOnScreen(world, enemy.x) &&
    isStanding(target) &&
    canSwing(world, enemy)
  ) {
    enemy.cooldown = randomInt(world, THROW_COOLDOWN_MIN, THROW_COOLDOWN_MAX);
    return input({ attack: true });
  }
  // Close enough to throw from: stop and turn to face rather than drifting.
  const settled = Math.abs(spot - enemy.x) <= 12 && distance >= THROW_MIN;
  const dx = settled ? 0 : spot - enemy.x;
  return steer(
    dx,
    dz,
    separation(world, enemy),
    settled && enemy.facing !== facing && facing === 1,
    settled && enemy.facing !== facing && facing === -1,
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** An enemy drives itself through the same controls a player uses. */
export function enemyIntent(world: World, enemy: Fighter): InputFrame {
  if (enemy.state !== 'idle' && enemy.state !== 'walk') return NO_INPUT;
  const target = nearestTarget(world, enemy);
  if (!target) return NO_INPUT;
  return enemy.kind === 'spam'
    ? throwerIntent(world, enemy, target)
    : brawlerIntent(world, enemy, target);
}
