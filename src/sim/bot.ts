import { DEPTH_TOLERANCE } from './constants';
import { ATTACKS, KINDS, SPECIAL_COST } from './fighters';
import { input, NO_INPUT, type InputFrame } from './input';
import { livingEnemies, players, type Fighter, type World } from './world';

const STRIKE_GAP = 22;
const ALIGN_SLOP = 3;
const CROWD_RADIUS = 44;

/** How well a scripted player plays. */
export interface BotSkill {
  /** Ticks between decisions; in between, the bot keeps doing what it decided. */
  reactionTicks: number;
  /** Ticks between attack presses while mashing. */
  mashTicks: number;
  /** Extra depth the bot accepts as "lined up", so some swings miss. */
  alignSlack: number;
  /** Whether it remembers the special when surrounded. */
  usesSpecial: boolean;
}

/** Frame-perfect: decides every tick, mashes as fast as the buffer allows, never misaligns. */
export const SHARP: BotSkill = { reactionTicks: 1, mashTicks: 2, alignSlack: 0, usesSpecial: true };

/**
 * A first-time player: a quarter-second behind the action, mashing at human
 * speed, lining up by eye, and forgetting the special exists. Difficulty is
 * tuned against this one; SHARP is the floor that must always win.
 */
export const CASUAL: BotSkill = {
  reactionTicks: 15,
  mashTicks: 7,
  alignSlack: 4,
  usesSpecial: false,
};

type Plan = { kind: 'idle' } | { kind: 'move'; frame: InputFrame } | { kind: 'mash' };

function nearest(me: Fighter, enemies: Fighter[]): Fighter | undefined {
  return enemies.reduce<Fighter | undefined>((best, e) => {
    if (!best) return e;
    const d = Math.abs(e.x - me.x) + Math.abs(e.z - me.z);
    const bestD = Math.abs(best.x - me.x) + Math.abs(best.z - me.z);
    return d < bestD ? e : best;
  }, undefined);
}

/** What the bot decides to do right now: walk right, line up with the nearest enemy, mash, spin out when flanked. */
function decide(world: World, me: Fighter, skill: BotSkill): Plan {
  const standing = livingEnemies(world).filter(
    (e) => e.state !== 'knockdown' && e.state !== 'getup',
  );
  const target = nearest(me, standing);
  if (!target) {
    return livingEnemies(world).length === 0
      ? { kind: 'move', frame: input({ right: true }) }
      : { kind: 'idle' };
  }

  const flanked =
    standing.some((e) => e.x < me.x && me.x - e.x < CROWD_RADIUS) &&
    standing.some((e) => e.x > me.x && e.x - me.x < CROWD_RADIUS);
  if (skill.usesSpecial && flanked && me.hp > SPECIAL_COST * 3 && world.tick % 2 === 0) {
    return { kind: 'move', frame: input({ special: true }) };
  }

  const side = target.x >= me.x ? 1 : -1;
  const dx = target.x - side * STRIKE_GAP - me.x;
  const dz = target.z - me.z;
  const aligned = Math.abs(dz) <= DEPTH_TOLERANCE - 2 + skill.alignSlack;
  const inRange =
    Math.abs(target.x - me.x) <= ATTACKS.jab1.reach + KINDS[target.kind].halfWidth - 2;
  if (aligned && inRange) {
    if (me.facing !== side)
      return { kind: 'move', frame: input({ right: side === 1, left: side === -1 }) };
    return { kind: 'mash' };
  }
  return {
    kind: 'move',
    frame: input({
      right: dx > ALIGN_SLOP,
      left: dx < -ALIGN_SLOP,
      down: dz > ALIGN_SLOP,
      up: dz < -ALIGN_SLOP,
    }),
  };
}

function act(world: World, plan: Plan, skill: BotSkill): InputFrame {
  switch (plan.kind) {
    case 'idle':
      return NO_INPUT;
    case 'move':
      return plan.frame;
    case 'mash':
      return input({ attack: world.tick % skill.mashTicks === 0 });
  }
}

/**
 * A scripted player at the given skill. It keeps its last decision between
 * reaction ticks, so it needs its own instance per run. The beatability proof
 * runs these headless; if they cannot clear a stage within budget, the stage
 * is too hard to ship.
 */
export function createBot(skill: BotSkill, index = 0): (world: World) => InputFrame {
  let plan: Plan = { kind: 'idle' };
  return (world) => {
    const me = players(world)[index];
    if (!me || me.state === 'dead') return NO_INPUT;
    if (world.tick % skill.reactionTicks === 0) plan = decide(world, me, skill);
    return act(world, plan, skill);
  };
}

/** The SHARP bot, stateless because it decides every tick. */
export function botInput(world: World, index = 0): InputFrame {
  const me = players(world)[index];
  if (!me || me.state === 'dead') return NO_INPUT;
  return act(world, decide(world, me, SHARP), SHARP);
}
