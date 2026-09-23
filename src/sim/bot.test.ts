import { describe, expect, it } from 'vitest';
import { SCREEN_W, TICK_HZ } from './constants';
import { ATTACKS } from './fighters';
import { botInput } from './bot';
import { STAGE_1 } from './stage';
import { NO_INPUT } from './input';
import { createWorld, livingEnemies, players, spawnFighter, step, type World } from './world';

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
