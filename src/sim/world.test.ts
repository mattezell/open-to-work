import { describe, expect, it } from 'vitest';
import { DEPTH, SCREEN_W } from './constants';
import { ATTACKS, KINDS, SPECIAL_COST } from './fighters';
import { input } from './input';
import { STAGE_1 } from './stage';
import { EMPTY_STAGE, duel, player, run, tapAttack } from './test-helpers';
import { createWorld, livingEnemies, step } from './world';

describe('belt movement', () => {
  it('walks along x and depth at the kind speed', () => {
    const world = createWorld(EMPTY_STAGE, 1);
    const matt = player(world);
    const { x, z } = matt;
    run(world, 10, input({ right: true, down: true }));
    expect(matt.x).toBeCloseTo(x + 10 * KINDS.matt.walkX);
    expect(matt.z).toBeCloseTo(z + 10 * KINDS.matt.walkZ);
    expect(matt.state).toBe('walk');
    expect(matt.facing).toBe(1);
  });

  it('clamps depth to the street', () => {
    const world = createWorld(EMPTY_STAGE, 1);
    run(world, 200, input({ up: true }));
    expect(player(world).z).toBe(0);
    run(world, 200, input({ down: true }));
    expect(player(world).z).toBe(DEPTH);
  });

  it('scrolls the camera forward but never back', () => {
    const world = createWorld(EMPTY_STAGE, 1);
    run(world, 300, input({ right: true }));
    const scrolled = world.cameraX;
    expect(scrolled).toBeGreaterThan(0);
    run(world, 300, input({ left: true }));
    expect(world.cameraX).toBe(scrolled);
    expect(player(world).x).toBeGreaterThanOrEqual(world.cameraX);
  });
});

describe('attack chain', () => {
  it('connects jab, jab, haymaker and the haymaker knocks down', () => {
    const { world, matt, bot } = duel();
    const seen: string[] = [];
    for (let i = 0; i < 90 && bot.state !== 'knockdown'; i++) {
      step(world, [input({ attack: i % 2 === 0 })]);
      if (matt.attack && seen.at(-1) !== matt.attack) seen.push(matt.attack);
    }
    expect(seen).toEqual(['jab1', 'jab2', 'haymaker']);
    expect(bot.state).toBe('knockdown');
    expect(bot.hp).toBe(
      KINDS.ats.maxHp - ATTACKS.jab1.damage - ATTACKS.jab2.damage - ATTACKS.haymaker.damage,
    );
  });

  it('resets to the first jab after a whiff', () => {
    const { world, matt } = duel(200);
    tapAttack(world);
    run(world, 40);
    tapAttack(world);
    expect(matt.attack).toBe('jab1');
  });

  it('hits each target once per swing', () => {
    const { world, bot } = duel();
    tapAttack(world);
    run(world, 30);
    expect(bot.hp).toBe(KINDS.ats.maxHp - ATTACKS.jab1.damage);
  });
});

describe('hit-stop', () => {
  it('freezes the world on contact and still buffers presses', () => {
    const { world, matt, bot } = duel();
    tapAttack(world);
    while (world.hitstop === 0) step(world, [input({})]);
    const frozenTick = matt.attackTick;
    const botX = bot.x;
    const stop = world.hitstop;
    // Press during the freeze: it must survive until the freeze ends.
    step(world, [input({ attack: true })]);
    for (let i = 1; i < stop; i++) step(world, [input({})]);
    expect(matt.attackTick).toBe(frozenTick);
    expect(bot.x).toBe(botX);
    expect(matt.attackBuffer).toBeGreaterThan(0);
    run(world, 20);
    expect(matt.chain).toBe(2);
  });
});

describe('knockdown', () => {
  it('lands, gets up invulnerable, and recovers', () => {
    const { world, bot } = duel();
    for (let i = 0; i < 90 && bot.state !== 'knockdown'; i++) {
      step(world, [input({ attack: i % 2 === 0 })]);
    }
    run(world, 40);
    expect(bot.y).toBe(0);
    run(world, 40);
    expect(bot.state).toBe('getup');
    expect(bot.invuln).toBeGreaterThan(0);
    run(world, 30);
    expect(['idle', 'walk']).toContain(bot.state);
  });

  it('kills at zero health and removes the body', () => {
    const { world, bot } = duel();
    bot.hp = 1;
    tapAttack(world);
    run(world, 12);
    expect(bot.state).toBe('knockdown');
    run(world, 100);
    expect(bot.state).toBe('dead');
    run(world, 70);
    expect(world.fighters).not.toContain(bot);
    expect(player(world).score).toBeGreaterThanOrEqual(KINDS.ats.score);
  });
});

describe('special', () => {
  it('hits both sides and costs health', () => {
    const { world, matt, bot } = duel();
    bot.x = matt.x - 20;
    step(world, [input({ special: true })]);
    run(world, 20);
    expect(matt.hp).toBe(KINDS.matt.maxHp - SPECIAL_COST);
    expect(bot.state).toBe('knockdown');
  });

  it('cannot be used when it would kill', () => {
    const { world, matt } = duel();
    matt.hp = SPECIAL_COST;
    step(world, [input({ special: true })]);
    expect(matt.attack).toBeNull();
    expect(matt.hp).toBe(SPECIAL_COST);
  });
});

describe('waves', () => {
  it('locks the camera until the wave is cleared, then says GO', () => {
    const world = createWorld(STAGE_1, 3);
    const matt = player(world);
    const firstWave = STAGE_1.waves[0];
    if (!firstWave) throw new Error('stage 1 has no waves');
    while (world.activeWave === -1) step(world, [input({ right: true })]);
    const lockedAt = world.cameraX;
    run(world, 200, input({ right: true }));
    expect(world.cameraX).toBe(lockedAt);
    expect(matt.x).toBeLessThanOrEqual(lockedAt + SCREEN_W);
    expect(livingEnemies(world).length).toBe(firstWave.spawns.length);

    for (const enemy of livingEnemies(world)) {
      enemy.hp = 0;
      enemy.state = 'dead';
    }
    step(world, [input({})]);
    expect(world.activeWave).toBe(-1);
    expect(world.wavesCleared).toBe(1);
    expect(world.goPrompt).toBeGreaterThan(0);
    run(world, 60, input({ right: true }));
    expect(world.cameraX).toBeGreaterThan(lockedAt);
  });

  it('enemies approach and attack an idle player', () => {
    const world = createWorld(STAGE_1, 5, { sidekick: false });
    while (world.activeWave === -1) step(world, [input({ right: true })]);
    run(world, 600);
    expect(player(world).hp).toBeLessThan(KINDS.matt.maxHp);
  });
});

describe('determinism', () => {
  it('replays identically from the same seed and inputs', () => {
    const script = (tick: number) =>
      input({ right: tick % 90 < 60, attack: tick % 7 === 0, up: tick % 200 < 30 });
    const a = createWorld(STAGE_1, 99);
    const b = createWorld(STAGE_1, 99);
    for (let t = 0; t < 3000; t++) {
      step(a, [script(t)]);
      step(b, [script(t)]);
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
