import { describe, expect, it } from 'vitest';
import { SCREEN_W, TICK_HZ } from './constants';
import { ATTACKS } from './fighters';
import { botInput, CASUAL, createBot, type BotSkill } from './bot';
import { STAGE_1 } from './stage';
import { NO_INPUT } from './input';
import { createWorld, livingEnemies, players, spawnFighter, step, type World } from './world';
import type { InputFrame } from './input';

const TIME_BUDGET_TICKS = 180 * TICK_HZ;

describe('beatability', () => {
  it.each([1, 2, 3, 4, 5])('the scripted bot clears Stage 1 (seed %i)', (seed) => {
    const world = createWorld(STAGE_1, seed);
    while (world.status === 'playing' && world.tick < TIME_BUDGET_TICKS) {
      step(world, [botInput(world)]);
    }
    const matt = players(world)[0];
    expect(world.status).toBe('cleared');
    expect(matt?.hp ?? 0).toBeGreaterThan(20);
  });
});

interface Run {
  cleared: boolean;
  hp: number;
}

function playStage1(skill: BotSkill, seed: number, sidekick: boolean): Run {
  const world = createWorld(STAGE_1, seed, { sidekick });
  const bot = createBot(skill);
  while (world.status === 'playing' && world.tick < TIME_BUDGET_TICKS) {
    step(world, [bot(world)]);
  }
  return { cleared: world.status === 'cleared', hp: players(world)[0]?.hp ?? 0 };
}

function averageHp(runs: Run[]): number {
  return runs.reduce((sum, r) => sum + r.hp, 0) / runs.length;
}

const SEEDS = [1, 2, 3, 4, 5];

/**
 * Stage 1 is the tutorial: a first-time player should clear it and feel it.
 * These bands were set by sweeping enemy startup and cooldown (JOURNAL,
 * 2026-09-22 difficulty entry); retune them only with a new sweep.
 */
describe('Stage 1 difficulty for a casual player', () => {
  it('clears with TOKEN, taking real damage on the way', () => {
    const runs = SEEDS.map((seed) => playStage1(CASUAL, seed, true));
    expect(runs.every((r) => r.cleared)).toBe(true);
    expect(averageHp(runs)).toBeGreaterThanOrEqual(40);
    expect(averageHp(runs)).toBeLessThanOrEqual(80);
  });

  it('clears solo too, but only just', () => {
    const runs = SEEDS.map((seed) => playStage1(CASUAL, seed, false));
    expect(runs.filter((r) => r.cleared).length).toBeGreaterThanOrEqual(4);
    expect(averageHp(runs)).toBeLessThanOrEqual(65);
  });
});

describe('casual bot', () => {
  it('only changes its mind on reaction ticks', () => {
    const world = createWorld(STAGE_1, 1);
    const bot = createBot(CASUAL);
    const frames: InputFrame[] = [];
    for (let t = 0; t < 600; t++) {
      const frame = bot(world);
      frames.push(frame);
      step(world, [frame]);
    }
    const moves = (f: InputFrame | undefined): string =>
      f ? [f.left, f.right, f.up, f.down].join() : '';
    frames.forEach((frame, tick) => {
      if (tick % CASUAL.reactionTicks !== 0) expect(moves(frame)).toBe(moves(frames[tick - 1]));
    });
  });
});

function offScreenStrikers(world: World): number {
  return livingEnemies(world).filter((e) => {
    if (e.attack === null) return false;
    const def = ATTACKS[e.attack];
    const live = e.attackTick >= def.startup && e.attackTick < def.startup + def.active;
    return live && (e.x < world.cameraX || e.x > world.cameraX + SCREEN_W);
  }).length;
}

describe('fairness', () => {
  it('does not attack a player pinned to the locked edge from off screen', () => {
    const world = createWorld(STAGE_1, 1);
    const matt = players(world)[0];
    if (!matt) throw new Error('no player');
    world.stage = { ...STAGE_1, waves: [] };
    world.activeWave = 0;
    world.cameraX = 159;
    matt.x = world.cameraX + SCREEN_W - 12;
    const lurker = spawnFighter(world, 'ats', matt.x + 34, matt.z);
    lurker.cooldown = 0;
    for (let t = 0; t < 600; t++) {
      step(world, [NO_INPUT]);
      expect(offScreenStrikers(world)).toBe(0);
    }
  });

  it('never lets an enemy land a hitbox from off screen', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const world = createWorld(STAGE_1, seed);
      while (world.status === 'playing' && world.tick < TIME_BUDGET_TICKS) {
        step(world, [botInput(world)]);
        expect(offScreenStrikers(world)).toBe(0);
      }
    }
  });
});
