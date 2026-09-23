import { input, NO_INPUT, type InputFrame } from './input';
import type { StageDef } from './stage';
import { createWorld, spawnFighter, step, type Fighter, type World } from './world';

export const EMPTY_STAGE: StageDef = { id: 'test', length: 4000, waves: [] };

export function run(world: World, ticks: number, frame: InputFrame = NO_INPUT): void {
  for (let i = 0; i < ticks; i++) step(world, [frame]);
}

/** Press attack once (one tick down, one tick up). */
export function tapAttack(world: World): void {
  step(world, [input({ attack: true })]);
  step(world, [NO_INPUT]);
}

export function player(world: World): Fighter {
  const p = world.fighters[0];
  if (!p) throw new Error('world has no player');
  return p;
}

/** A world with Matt and one passive ATS Bot standing right in front of him. No TOKEN. */
export function duel(gap = 24): { world: World; matt: Fighter; bot: Fighter } {
  const world = createWorld(EMPTY_STAGE, 1, { sidekick: false });
  const matt = player(world);
  const bot = spawnFighter(world, 'ats', matt.x + gap, matt.z);
  bot.cooldown = 100_000;
  return { world, matt, bot };
}
