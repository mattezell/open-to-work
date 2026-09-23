import { describe, expect, it } from 'vitest';
import { DEPTH } from './constants';
import { ATTACKS, KINDS, PROJECTILES } from './fighters';
import { setState } from './fighter-step';
import { input, NO_INPUT } from './input';
import { COFFEE_HEAL } from './pickups';
import { STAGE_1, type StageDef } from './stage';
import { EMPTY_STAGE, player, run, tapAttack } from './test-helpers';
import {
  createWorld,
  livingEnemies,
  sidekick,
  spawnFighter,
  step,
  type Fighter,
  type SimEvent,
  type World,
} from './world';

function soloWorld(stage: StageDef = EMPTY_STAGE): { world: World; matt: Fighter } {
  const world = createWorld(stage, 1, { sidekick: false });
  return { world, matt: player(world) };
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

/** A Spam Recruiter 100px in front of Matt on his depth line, ready to throw. */
function spamDuel(): { world: World; matt: Fighter; spam: Fighter } {
  const { world, matt } = soloWorld();
  const spam = spawnFighter(world, 'spam', matt.x + 100, matt.z);
  spam.cooldown = 0;
  return { world, matt, spam };
}

describe('Spam Recruiter', () => {
  it('throws a business card that flies across and hits Matt', () => {
    const { world, matt, spam } = spamDuel();
    runUntil(world, () => world.projectiles.length > 0, 120);
    const card = world.projectiles[0];
    expect(card?.ownerId).toBe(spam.id);
    expect(card?.vx).toBeLessThan(0);
    runUntil(world, () => matt.hp < KINDS.matt.maxHp, 120);
    expect(matt.hp).toBe(KINDS.matt.maxHp - ATTACKS.card.damage);
    expect(world.projectiles).toHaveLength(0);
    expect(spam.score).toBeGreaterThan(0);
  });

  it('misses a Matt who stepped off the card line', () => {
    const { world, matt } = spamDuel();
    runUntil(world, () => world.projectiles.length > 0, 120);
    matt.z = matt.z < DEPTH / 2 ? matt.z + 20 : matt.z - 20;
    runUntil(world, () => world.projectiles.length === 0, 200);
    expect(matt.hp).toBe(KINDS.matt.maxHp);
  });

  it('sails under a jumping Matt', () => {
    const { world, matt } = spamDuel();
    runUntil(world, () => world.projectiles.length > 0, 120);
    const card = world.projectiles[0];
    if (!card) throw new Error('no card');
    // Jump so he is airborne as the card arrives.
    const arrival = Math.floor((card.x - matt.x) / PROJECTILES.card.speed);
    run(world, Math.max(0, arrival - 22));
    step(world, [input({ jump: true })]);
    runUntil(world, () => world.projectiles.length === 0, 200);
    expect(matt.hp).toBe(KINDS.matt.maxHp);
  });

  it('still lands a card thrown just before the thrower went down', () => {
    const { world, matt, spam } = spamDuel();
    runUntil(world, () => world.projectiles.length > 0, 120);
    world.fighters = world.fighters.filter((f) => f !== spam);
    runUntil(world, () => matt.hp < KINDS.matt.maxHp, 120);
    expect(matt.hp).toBe(KINDS.matt.maxHp - ATTACKS.card.damage);
  });

  it('backs off when Matt closes in, and never throws from point blank', () => {
    const { world, matt, spam } = spamDuel();
    spam.x = matt.x + 30;
    const start = spam.x;
    let tossed = false;
    runUntil(
      world,
      () => {
        tossed ||= spam.attack === 'toss';
        return false;
      },
      40,
    );
    expect(spam.x).toBeGreaterThan(start);
    expect(tossed).toBe(false);
    expect(matt.hp).toBe(KINDS.matt.maxHp);
  });

  it('is caught by TOKEN under Guard', () => {
    const world = createWorld(EMPTY_STAGE, 1);
    const matt = player(world);
    const token = sidekick(world);
    if (!token) throw new Error('no TOKEN');
    world.directive = 'guard';
    token.x = matt.x - 4;
    token.z = matt.z + 12;
    token.cooldown = 100_000;
    const spam = spawnFighter(world, 'spam', matt.x + 100, matt.z);
    spam.cooldown = 0;
    const events = runUntil(world, () => token.hp < KINDS.token.maxHp, 300);
    expect(matt.hp).toBe(KINDS.matt.maxHp);
    expect(token.hp).toBe(KINDS.token.maxHp - Math.ceil(ATTACKS.card.damage / 2));
    expect(events).toContainEqual({ type: 'intercept' });
  });

  it('drops a card that leaves the screen', () => {
    const { world, matt } = spamDuel();
    runUntil(world, () => world.projectiles.length > 0, 120);
    matt.z = matt.z < DEPTH / 2 ? matt.z + 20 : matt.z - 20;
    runUntil(world, () => world.projectiles.length === 0, 400);
    expect(world.projectiles).toHaveLength(0);
  });
});

describe('Unpaid Take Home', () => {
  function bossDuel(): { world: World; matt: Fighter; boss: Fighter } {
    const { world, matt } = soloWorld();
    const boss = spawnFighter(world, 'takehome', matt.x + 40, matt.z);
    return { world, matt, boss };
  }

  it('walks up and slams Matt to the floor', () => {
    const { world, matt, boss } = bossDuel();
    boss.cooldown = 0;
    boss.x = matt.x + 80;
    runUntil(world, () => matt.hp < KINDS.matt.maxHp, 400);
    expect(matt.hp).toBe(KINDS.matt.maxHp - ATTACKS.slam.damage);
    expect(matt.state).toBe('knockdown');
  });

  it('shrugs off a jab mid-slam and keeps swinging', () => {
    const { world, matt, boss } = bossDuel();
    boss.x = matt.x + 24;
    boss.facing = -1;
    setState(boss, 'attack');
    boss.attack = 'slam';
    boss.attackTick = 0;
    tapAttack(world);
    run(world, 4);
    expect(boss.hp).toBe(KINDS.takehome.maxHp - ATTACKS.jab1.damage);
    expect(boss.state).toBe('attack');
    expect(boss.attack).toBe('slam');
  });

  it('flinches like anyone else when caught off guard', () => {
    const { world, boss } = bossDuel();
    boss.x = player(world).x + 24;
    boss.cooldown = 100_000;
    tapAttack(world);
    run(world, 4);
    expect(boss.state).toBe('hurt');
  });

  it('calls in scope creep at two thirds and one third health, once each', () => {
    const { world, boss } = bossDuel();
    boss.cooldown = 100_000;
    const maxHp = KINDS.takehome.maxHp;
    const ats = (): number => livingEnemies(world).filter((f) => f.kind === 'ats').length;

    boss.hp = Math.floor((maxHp * 2) / 3) + 1;
    step(world, [NO_INPUT]);
    expect(ats()).toBe(0);

    boss.hp = Math.floor((maxHp * 2) / 3);
    step(world, [NO_INPUT]);
    expect(world.events).toContainEqual({ type: 'reinforcements', by: boss.id });
    expect(ats()).toBe(1);
    run(world, 30);
    expect(ats()).toBe(1);

    boss.hp = Math.floor(maxHp / 3);
    step(world, [NO_INPUT]);
    expect(ats()).toBe(2);
  });

  it('calls both waves at once when one blow takes it past both marks', () => {
    const { world, boss } = bossDuel();
    boss.cooldown = 100_000;
    boss.hp = 10;
    step(world, [NO_INPUT]);
    expect(livingEnemies(world).filter((f) => f.kind === 'ats')).toHaveLength(2);
    expect(boss.summons).toBe(2);
  });

  it('sends one reinforcement from behind, then one from ahead', () => {
    const { world, boss } = bossDuel();
    boss.cooldown = 100_000;
    boss.hp = 50;
    step(world, [NO_INPUT]);
    const xs = livingEnemies(world)
      .filter((f) => f.kind === 'ats')
      .map((f) => f.x);
    expect(Math.min(...xs)).toBeLessThan(world.cameraX);
    expect(Math.max(...xs)).toBeGreaterThan(world.cameraX + 320);
  });
});

describe('coffee', () => {
  const COFFEE_STAGE: StageDef = { ...EMPTY_STAGE, pickups: [{ kind: 'coffee', x: 120, z: 28 }] };

  it('lies on the street from the start', () => {
    const { world } = soloWorld(COFFEE_STAGE);
    expect(world.pickups).toEqual([expect.objectContaining({ kind: 'coffee', x: 120, z: 28 })]);
  });

  it('heals a hurt Matt who walks over it, capped at full', () => {
    const { world, matt } = soloWorld(COFFEE_STAGE);
    matt.hp = KINDS.matt.maxHp - 10;
    matt.z = 28;
    const events: SimEvent[] = [];
    for (let i = 0; i < 120 && world.pickups.length > 0; i++) {
      step(world, [input({ right: true })]);
      events.push(...world.events);
    }
    expect(world.pickups).toHaveLength(0);
    expect(matt.hp).toBe(KINDS.matt.maxHp);
    expect(events).toContainEqual({ type: 'pickup', kind: 'coffee', by: matt.id });
  });

  it('heals by a fixed amount', () => {
    const { world, matt } = soloWorld(COFFEE_STAGE);
    matt.hp = 20;
    matt.z = 28;
    run(world, 120, input({ right: true }));
    expect(matt.hp).toBe(20 + COFFEE_HEAL);
  });

  it('stays put when Matt is at full health', () => {
    const { world, matt } = soloWorld(COFFEE_STAGE);
    matt.z = 28;
    run(world, 120, input({ right: true }));
    expect(world.pickups).toHaveLength(1);
  });

  it('is not for TOKEN', () => {
    const world = createWorld(COFFEE_STAGE, 1);
    const token = sidekick(world);
    if (!token) throw new Error('no TOKEN');
    token.hp = 10;
    token.x = 120;
    token.z = 28;
    run(world, 5);
    expect(world.pickups).toHaveLength(1);
    expect(token.hp).toBe(10);
  });
});

describe('Stage 1', () => {
  it('mixes in Spam Recruiters and ends with the Unpaid Take Home', () => {
    const kinds = STAGE_1.waves.flatMap((w) => w.spawns.map((s) => s.kind));
    expect(kinds).toContain('spam');
    expect(STAGE_1.waves.at(-1)?.spawns.map((s) => s.kind)).toEqual(['takehome']);
    expect(STAGE_1.pickups?.length).toBeGreaterThan(0);
  });
});
