import { describe, expect, it } from 'vitest';
import { TICK_HZ } from './constants';
import { ATTACKS, KINDS } from './fighters';
import { setState } from './fighter-step';
import { input, NO_INPUT } from './input';
import { nextDirective, REBOOT_TICKS, sidekickIntent, type Directive } from './sidekick';
import { botInput } from './bot';
import { STAGE_1 } from './stage';
import { EMPTY_STAGE, run } from './test-helpers';
import {
  createWorld,
  players,
  sidekick,
  spawnFighter,
  step,
  type Fighter,
  type SimEvent,
  type World,
} from './world';

interface Squad {
  world: World;
  matt: Fighter;
  token: Fighter;
}

function squad(directive: Directive = 'wild'): Squad {
  const world = createWorld(EMPTY_STAGE, 1);
  const matt = players(world)[0];
  const token = sidekick(world);
  if (!matt || !token) throw new Error('squad needs Matt and TOKEN');
  world.directive = directive;
  return { world, matt, token };
}

/** A passive ATS Bot that never swings unless the test arms it. */
function passiveBot(world: World, x: number, z: number): Fighter {
  const bot = spawnFighter(world, 'ats', x, z);
  bot.cooldown = 100_000;
  return bot;
}

/** Step until `done` or the limit, collecting every event along the way. */
function runUntil(world: World, done: () => boolean, limit = 600): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < limit && !done(); i++) {
    step(world, [NO_INPUT]);
    events.push(...world.events);
  }
  return events;
}

describe('TOKEN', () => {
  it('spawns beside Matt as an AI-piloted ally, and is not a player slot', () => {
    const { world, token } = squad();
    expect(token.team).toBe('player');
    expect(token.pilot).toBe('ai');
    expect(players(world).map((p) => p.kind)).toEqual(['matt']);
    expect(world.directive).toBe('wild');
  });

  it('can be left out', () => {
    expect(sidekick(createWorld(EMPTY_STAGE, 1, { sidekick: false }))).toBeUndefined();
  });

  it('tags along behind Matt when there is nothing to fight', () => {
    const { world, matt, token } = squad();
    run(world, 240, input({ right: true }));
    run(world, 120);
    expect(Math.abs(token.x - matt.x)).toBeLessThanOrEqual(52);
    expect(token.x).toBeLessThan(matt.x);
  });

  it('lands its one-two on an enemy', () => {
    const { world, token } = squad();
    const bot = passiveBot(world, token.x + 70, token.z);
    const attacks = new Set<string>();
    runUntil(world, () => {
      if (token.attack) attacks.add(token.attack);
      return attacks.has('zap2') && token.attack === null;
    });
    expect(attacks).toEqual(new Set(['zap1', 'zap2']));
    expect(bot.hp).toBe(KINDS.ats.maxHp - ATTACKS.zap1.damage - ATTACKS.zap2.damage);
  });
});

describe('orders', () => {
  it('cycle Go wild, Focus, Guard', () => {
    expect(nextDirective('wild')).toBe('focus');
    expect(nextDirective('focus')).toBe('guard');
    expect(nextDirective('guard')).toBe('wild');
  });

  it('change once per press, not per tick held, and announce it', () => {
    const { world } = squad();
    step(world, [input({ order: true })]);
    expect(world.events).toContainEqual({ type: 'order', directive: 'focus' });
    run(world, 30, input({ order: true }));
    expect(world.directive).toBe('focus');
    step(world, [NO_INPUT]);
    step(world, [input({ order: true })]);
    expect(world.directive).toBe('guard');
  });
});

describe('Focus', () => {
  function firstZapDamage(directive: Directive): number {
    const { world, matt, token } = squad(directive);
    const bot = passiveBot(world, token.x + 30, token.z);
    matt.lastTarget = bot.id;
    runUntil(world, () => bot.hp < KINDS.ats.maxHp);
    return KINDS.ats.maxHp - bot.hp;
  }

  it("doubles TOKEN's damage on Matt's target", () => {
    expect(firstZapDamage('wild')).toBe(ATTACKS.zap1.damage);
    expect(firstZapDamage('focus')).toBe(ATTACKS.zap1.damage * 2);
  });

  it("goes after Matt's target over a closer enemy", () => {
    const { world, matt, token } = squad('focus');
    passiveBot(world, token.x + 30, token.z);
    const marked = passiveBot(world, token.x + 140, token.z);
    matt.lastTarget = marked.id;
    runUntil(world, () => marked.hp < KINDS.ats.maxHp, 900);
    expect(marked.hp).toBeLessThan(KINDS.ats.maxHp);
  });
});

describe('Guard', () => {
  function enemySwingsAtMatt(directive: Directive): {
    matt: Fighter;
    token: Fighter;
    events: SimEvent[];
  } {
    const { world, matt, token } = squad(directive);
    // Close enough to step in, but outside the swing's own depth band.
    token.x = matt.x - 4;
    token.z = matt.z + 12;
    token.cooldown = 100_000;
    const bot = spawnFighter(world, 'ats', matt.x + 26, matt.z);
    bot.cooldown = 0;
    const events = runUntil(
      world,
      () => matt.hp < KINDS.matt.maxHp || token.hp < KINDS.token.maxHp,
    );
    return { matt, token, events };
  }

  it('takes a hit meant for Matt, at half damage', () => {
    const { matt, token, events } = enemySwingsAtMatt('guard');
    expect(matt.hp).toBe(KINDS.matt.maxHp);
    expect(token.hp).toBe(KINDS.token.maxHp - Math.ceil(ATTACKS.shred.damage / 2));
    expect(events).toContainEqual({ type: 'intercept' });
  });

  it('only while guarding', () => {
    const { matt, events } = enemySwingsAtMatt('wild');
    expect(matt.hp).toBe(KINDS.matt.maxHp - ATTACKS.shred.damage);
    expect(events).not.toContainEqual({ type: 'intercept' });
  });
});

describe('Go wild', () => {
  it('sometimes swings at an enemy that is no longer there', () => {
    let whiffs = 0;
    for (const seed of [1, 2, 3]) {
      const world = createWorld(STAGE_1, seed);
      while (world.status === 'playing' && world.tick < 180 * TICK_HZ) {
        step(world, [botInput(world)]);
        whiffs += world.events.filter((e) => e.type === 'whiff').length;
      }
    }
    expect(whiffs).toBeGreaterThan(0);
  });

  it('never whiffs under the other orders', () => {
    for (const directive of ['focus', 'guard'] as const) {
      const world = createWorld(STAGE_1, 1);
      world.directive = directive;
      let whiffs = 0;
      while (world.status === 'playing' && world.tick < 180 * TICK_HZ) {
        step(world, [botInput(world)]);
        whiffs += world.events.filter((e) => e.type === 'whiff').length;
      }
      expect(whiffs).toBe(0);
    }
  });
});

describe('reboot', () => {
  it('gets back up at half health after a KO, and says so', () => {
    const { world, token } = squad();
    token.hp = 0;
    setState(token, 'dead');
    const events = runUntil(world, () => token.state !== 'dead', REBOOT_TICKS + 10);
    expect(events).toContainEqual({ type: 'reboot' });
    expect(events).toContainEqual({ type: 'rebooted' });
    expect(token.state).toBe('getup');
    expect(token.hp).toBe(KINDS.token.maxHp / 2);
    expect(token.invuln).toBeGreaterThan(0);
  });

  it('does not count toward a game over', () => {
    const { world, matt, token } = squad();
    token.hp = 0;
    setState(token, 'dead');
    run(world, 10);
    expect(world.status).toBe('playing');
    matt.hp = 0;
    setState(matt, 'dead');
    step(world, [NO_INPUT]);
    expect(world.status).toBe('gameover');
  });

  it('lies still while rebooting', () => {
    const { world, token } = squad();
    token.hp = 0;
    setState(token, 'dead');
    expect(sidekickIntent(world, token)).toEqual(NO_INPUT);
  });
});

describe('in a real stage', () => {
  it('lands hits and KOs for the team', () => {
    const world = createWorld(STAGE_1, 2);
    const token = sidekick(world);
    let tokenKos = 0;
    while (world.status === 'playing' && world.tick < 180 * TICK_HZ) {
      step(world, [botInput(world)]);
      tokenKos += world.events.filter((e) => e.type === 'ko' && e.by === token?.id).length;
    }
    expect(world.status).toBe('cleared');
    expect(token?.score ?? 0).toBeGreaterThan(0);
    expect(tokenKos).toBeGreaterThan(0);
  });
});
