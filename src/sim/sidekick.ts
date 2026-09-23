import { DEPTH, DEPTH_TOLERANCE } from './constants';
import { ATTACKS, KINDS } from './fighters';
import { setState } from './fighter-step';
import { input, NO_INPUT, type InputFrame } from './input';
import { randomInt } from './rng';
import type { Fighter, World } from './world';

/**
 * TOKEN's standing order. Go wild hits whatever crowd is biggest and sometimes
 * swings at an enemy that already left; Focus doubles its damage on Matt's
 * target; Guard keeps it at Matt's side, taking hits meant for him.
 */
export type Directive = 'wild' | 'focus' | 'guard';

export const DIRECTIVES: readonly Directive[] = ['wild', 'focus', 'guard'];
export const FOCUS_DAMAGE_SCALE = 2;
/** Ticks TOKEN lies rebooting after a KO before it gets back up. */
export const REBOOT_TICKS = 300;

/** How close TOKEN must be to Matt to step in front of a hit. */
const GUARD_REACH_X = 40;
const GUARD_REACH_Z = 14;
/** Guard only engages enemies this close to Matt. */
const GUARD_ENGAGE = 90;
const CROWD_RADIUS = 50;
const STRIKE_GAP = 24;
const FOLLOW_GAP = 40;
const SLOP = 3;
/** Chance an enemy KO in Go wild mode leaves a phantom TOKEN will swing at later. */
const PHANTOM_CHANCE_PERCENT = 40;
/** A phantom waits this long, so the corpse is gone before TOKEN goes after it. */
const PHANTOM_WAKE = 150;
const PHANTOM_GIVE_UP = 330;

export function nextDirective(current: Directive): Directive {
  return DIRECTIVES[(DIRECTIVES.indexOf(current) + 1) % DIRECTIVES.length] ?? 'wild';
}

function isStanding(f: Fighter): boolean {
  return f.state !== 'dead' && f.state !== 'knockdown' && f.state !== 'getup';
}

function distance(a: Fighter, b: { x: number; z: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
}

function nearestTo(point: { x: number; z: number }, candidates: Fighter[]): Fighter | undefined {
  let best: Fighter | undefined;
  for (const c of candidates) {
    if (!best || distance(c, point) < distance(best, point)) best = c;
  }
  return best;
}

/** Enemies worth swinging at: on their feet and in play. */
function standingEnemies(world: World): Fighter[] {
  return world.fighters.filter((f) => f.team === 'enemy' && isStanding(f) && f.ghost === 0);
}

function human(world: World): Fighter | undefined {
  return world.fighters.find((f) => f.pilot === 'human' && f.state !== 'dead');
}

function tokenOf(world: World): Fighter | undefined {
  return world.fighters.find((f) => f.kind === 'token');
}

/** Under Guard, the TOKEN that would take a hit aimed at `target`, if it is close enough. */
export function guardInterceptor(world: World, target: Fighter): Fighter | undefined {
  if (world.directive !== 'guard' || target.pilot !== 'human') return undefined;
  const token = tokenOf(world);
  if (!token || token.invuln > 0 || token.hp <= 0) return undefined;
  if (token.state !== 'idle' && token.state !== 'walk' && token.state !== 'attack')
    return undefined;
  const close =
    Math.abs(token.x - target.x) <= GUARD_REACH_X && Math.abs(token.z - target.z) <= GUARD_REACH_Z;
  return close ? token : undefined;
}

/** Called on every KO. In Go wild mode TOKEN may remember a foe that is no longer there. */
export function noteKo(world: World, fallen: Fighter): void {
  if (world.directive !== 'wild' || fallen.team !== 'enemy' || world.phantom) return;
  if (!tokenOf(world)) return;
  if (randomInt(world, 0, 99) < PHANTOM_CHANCE_PERCENT) {
    world.phantom = { x: fallen.x, z: fallen.z, ticks: 0 };
  }
}

/** Housekeeping before TOKEN steps: phantom memory and rebooting after a KO. */
export function updateSidekick(world: World, token: Fighter): void {
  if (world.phantom) {
    world.phantom.ticks++;
    if (world.directive !== 'wild' || world.phantom.ticks > PHANTOM_GIVE_UP) world.phantom = null;
  }
  if (token.state !== 'dead') return;
  if (token.stateTick === 0) world.events.push({ type: 'reboot' });
  if (token.stateTick >= REBOOT_TICKS) {
    token.hp = Math.ceil(KINDS[token.kind].maxHp / 2);
    setState(token, 'getup');
    token.invuln = 90;
    world.events.push({ type: 'rebooted' });
  }
}

function walkTo(me: Fighter, x: number, z: number): InputFrame {
  const dx = x - me.x;
  const dz = z - me.z;
  return input({ right: dx > SLOP, left: dx < -SLOP, down: dz > SLOP, up: dz < -SLOP });
}

/** Line up beside `target` and punch when in reach and off cooldown. */
function engage(world: World, me: Fighter, target: { x: number; z: number }): InputFrame {
  const side = me.x <= target.x ? -1 : 1;
  const aligned = Math.abs(target.z - me.z) <= DEPTH_TOLERANCE - 2;
  const inRange = Math.abs(target.x - me.x) <= ATTACKS.zap1.reach + KINDS.ats.halfWidth - 2;
  if (aligned && inRange) {
    const facing = target.x >= me.x ? 1 : -1;
    if (me.facing !== facing) return input({ right: facing === 1, left: facing === -1 });
    if (me.cooldown > 0) return NO_INPUT;
    me.cooldown = randomInt(world, 50, 90);
    return input({ attack: true });
  }
  return walkTo(me, target.x + side * STRIKE_GAP, target.z);
}

/** Hang back behind Matt, off his depth line so the two sprites do not overlap. */
function follow(me: Fighter, leader: Fighter, gap: number): InputFrame {
  const x = leader.x - leader.facing * gap;
  const z = leader.z + (leader.z < DEPTH / 2 ? 12 : -12);
  if (Math.abs(me.x - x) <= 8 && Math.abs(me.z - z) <= 6) return NO_INPUT;
  return walkTo(me, x, z);
}

function biggestCrowd(me: Fighter, enemies: Fighter[]): Fighter | undefined {
  let best: Fighter | undefined;
  let bestCount = -1;
  for (const e of enemies) {
    const count = enemies.filter((o) => Math.abs(o.x - e.x) <= CROWD_RADIUS).length;
    if (
      count > bestCount ||
      (count === bestCount && best && distance(me, e) < distance(me, best))
    ) {
      best = e;
      bestCount = count;
    }
  }
  return best;
}

function chooseTarget(world: World, me: Fighter, leader: Fighter): Fighter | undefined {
  const enemies = standingEnemies(world);
  switch (world.directive) {
    case 'wild':
      return biggestCrowd(me, enemies);
    case 'focus':
      return enemies.find((e) => e.id === leader.lastTarget) ?? nearestTo(leader, enemies);
    case 'guard': {
      const threat = nearestTo(leader, enemies);
      return threat && distance(threat, leader) <= GUARD_ENGAGE ? threat : undefined;
    }
  }
}

/** TOKEN drives itself through the same controls a player uses. */
export function sidekickIntent(world: World, me: Fighter): InputFrame {
  // Holding attack through a swing continues the one-two when the first punch lands.
  if (me.state === 'attack') return input({ attack: true });
  if (me.state !== 'idle' && me.state !== 'walk') return NO_INPUT;
  const leader = human(world);
  if (!leader) return NO_INPUT;

  const phantom = world.phantom;
  if (phantom && phantom.ticks >= PHANTOM_WAKE) {
    const swing = engage(world, me, phantom);
    if (swing.attack) {
      world.phantom = null;
      world.events.push({ type: 'whiff' });
    }
    return swing;
  }

  const target = chooseTarget(world, me, leader);
  if (target) return engage(world, me, target);
  return follow(me, leader, world.directive === 'guard' ? FOLLOW_GAP - 8 : FOLLOW_GAP);
}
