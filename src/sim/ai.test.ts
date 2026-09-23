import { describe, expect, it } from 'vitest';
import { NO_INPUT } from './input';
import { EMPTY_STAGE, player, run } from './test-helpers';
import { createWorld, sidekick, spawnFighter, type World } from './world';

function soloWorld(): World {
  const world = createWorld(EMPTY_STAGE, 1, { sidekick: false });
  player(world).x = 160;
  return world;
}

describe('enemy spacing', () => {
  it('splits a pair around the player instead of queueing on one side', () => {
    const world = soloWorld();
    const matt = player(world);
    const a = spawnFighter(world, 'ats', matt.x + 60, matt.z);
    const b = spawnFighter(world, 'ats', matt.x + 90, matt.z);
    a.cooldown = b.cooldown = 100_000;
    run(world, 300, NO_INPUT);
    expect(Math.sign(a.x - matt.x)).not.toBe(Math.sign(b.x - matt.x));
  });

  it('keeps three enemies from standing on top of each other', () => {
    const world = soloWorld();
    const matt = player(world);
    const crowd = [0, 1, 2].map((i) => spawnFighter(world, 'ats', matt.x + 60 + i * 4, matt.z));
    for (const e of crowd) e.cooldown = 100_000;
    run(world, 300, NO_INPUT);
    for (const [i, e] of crowd.entries()) {
      for (const other of crowd.slice(i + 1)) {
        const apart = Math.abs(e.x - other.x) >= 12 || Math.abs(e.z - other.z) >= 8;
        expect(apart, `enemies ${e.id} and ${other.id} overlap`).toBe(true);
      }
    }
  });

  it('still go after Matt when TOKEN stands a little closer', () => {
    const world = createWorld(EMPTY_STAGE, 1);
    const matt = player(world);
    const token = sidekick(world);
    if (!token) throw new Error('no TOKEN');
    matt.x = 160;
    token.x = 200;
    token.z = matt.z;
    token.cooldown = 100_000;
    const bot = spawnFighter(world, 'ats', 250, matt.z + 20);
    bot.cooldown = 0;
    let hitMatt = false;
    for (let i = 0; i < 300 && !hitMatt; i++) {
      run(world, 1, NO_INPUT);
      hitMatt = matt.hp < 100;
    }
    expect(hitMatt).toBe(true);
  });
});
