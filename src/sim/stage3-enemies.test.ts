import { describe, expect, it } from 'vitest';
import { DEPTH } from './constants';
import { ATTACKS, HEAVY_CHIP, KINDS, PROJECTILES } from './fighters';
import { setState } from './fighter-step';
import { GHOST_TICKS } from './ghoster';
import { input, NO_INPUT } from './input';
import { DESK_GAP, hotSeat } from './panel';
import { EMPTY_STAGE, player, run, tapAttack } from './test-helpers';
import { createWorld, spawnFighter, step, type Fighter, type SimEvent, type World } from './world';
import type { StageDef } from './stage';

function soloWorld(stage: StageDef = EMPTY_STAGE): { world: World; matt: Fighter } {
  const world = createWorld(stage, 1, { sidekick: false });
  return { world, matt: player(world) };
}

function runUntil(world: World, done: () => boolean, limit = 600): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < limit && !done(); i++) {
    step(world, [NO_INPUT]);
    events.push(...world.events);
  }
  return events;
}

/** Matt faces an enemy of `kind` standing in reach on his depth line, holding its attacks. */
function faceOff(kind: Fighter['kind'], gap = 24): { world: World; matt: Fighter; foe: Fighter } {
  const { world, matt } = soloWorld();
  const foe = spawnFighter(world, kind, matt.x + gap, matt.z);
  foe.cooldown = 100_000;
  return { world, matt, foe };
}

describe('LeetCode Golem', () => {
  it('shrugs off a jab: a chip of damage and no stagger', () => {
    const { world, foe } = faceOff('golem', 30);
    tapAttack(world);
    run(world, 10);
    expect(foe.hp).toBe(KINDS.golem.maxHp - HEAVY_CHIP);
    expect(foe.state).not.toBe('hurt');
  });

  it('goes down to a knockdown blow at full damage', () => {
    const { world, matt, foe } = faceOff('golem', 30);
    matt.chain = 2;
    matt.chainTimer = 10;
    tapAttack(world);
    run(world, 10);
    expect(foe.state).toBe('knockdown');
    expect(foe.hp).toBe(KINDS.golem.maxHp - ATTACKS.haymaker.damage);
  });

  it('still lets the full chain through to the haymaker', () => {
    const { world, foe } = faceOff('golem', 30);
    for (let i = 0; i < 3; i++) {
      tapAttack(world);
      run(world, 12);
    }
    expect(foe.state).toBe('knockdown');
    expect(foe.hp).toBe(KINDS.golem.maxHp - 2 * HEAVY_CHIP - ATTACKS.haymaker.damage);
  });
});

describe('Ghoster', () => {
  it('fades out of play once it recovers from a hit', () => {
    const { world, foe } = faceOff('ghoster');
    tapAttack(world);
    const events = runUntil(world, () => foe.ghost > 0, 120);
    expect(events).toContainEqual({ type: 'ghosted', id: foe.id });
    const hp = foe.hp;
    tapAttack(world);
    run(world, 10);
    expect(foe.hp).toBe(hp);
  });

  it('comes back behind Matt', () => {
    const { world, matt, foe } = faceOff('ghoster');
    foe.cooldown = 0;
    tapAttack(world);
    runUntil(world, () => foe.ghost > 0, 120);
    expect(matt.facing).toBe(1);
    run(world, GHOST_TICKS);
    expect(foe.ghost).toBe(0);
    expect(foe.x).toBeLessThan(matt.x);
  });

  it('is fair game again once it is back', () => {
    const { world, matt, foe } = faceOff('ghoster');
    tapAttack(world);
    runUntil(world, () => foe.ghost > 0, 120);
    runUntil(world, () => foe.ghost === 0, GHOST_TICKS + 5);
    foe.x = matt.x + 24;
    foe.z = matt.z;
    foe.cooldown = 100_000;
    setState(foe, 'idle');
    const hp = foe.hp;
    tapAttack(world);
    run(world, 10);
    expect(foe.hp).toBeLessThan(hp);
  });
});

/** Matt at the foot of the Panel's desks, all three seated one per depth lane. */
function panelRoom(): { world: World; matt: Fighter; panel: Fighter[] } {
  const stage: StageDef = {
    id: 'panel-test',
    length: 1200,
    endsOnLastWave: true,
    waves: [
      {
        triggerX: 0,
        spawns: [
          { kind: 'screener', side: 'right', z: 10, delay: 0, inset: 64 },
          { kind: 'techlead', side: 'right', z: 28, delay: 0, inset: 56 },
          { kind: 'manager', side: 'right', z: 46, delay: 0, inset: 48 },
        ],
      },
    ],
  };
  const { world, matt } = soloWorld(stage);
  step(world, [NO_INPUT]);
  step(world, [NO_INPUT]);
  const panel = world.fighters.filter((f) => KINDS[f.kind].seated);
  for (const f of panel) f.cooldown = 100_000;
  return { world, matt, panel };
}

/** Put Matt in front of `seat`, lined up, and hit it until it is beaten. */
function satisfy(world: World, matt: Fighter, seat: Fighter): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < 400 && seat.hp > 0; i++) {
    matt.x = seat.x - DESK_GAP - 16;
    matt.z = seat.z;
    matt.facing = 1;
    step(world, [input({ attack: i % 2 === 0 })]);
    events.push(...world.events);
  }
  return events;
}

describe('the Panel', () => {
  it('sits three interviewers, one per lane, with the screener in the hot seat first', () => {
    const { world, panel } = panelRoom();
    expect(panel.map((f) => f.kind).sort()).toEqual(['manager', 'screener', 'techlead']);
    expect(new Set(panel.map((f) => f.z)).size).toBe(3);
    expect(hotSeat(world)?.kind).toBe('screener');
  });

  it('only lets the one in the hot seat be hit', () => {
    const { world, matt, panel } = panelRoom();
    const techlead = panel.find((f) => f.kind === 'techlead');
    if (!techlead) throw new Error('no techlead');
    matt.x = techlead.x - DESK_GAP - 16;
    matt.z = techlead.z;
    tapAttack(world);
    run(world, 10);
    expect(techlead.hp).toBe(KINDS.techlead.maxHp);
  });

  it('keeps players on their side of the desks', () => {
    const { world, matt, panel } = panelRoom();
    run(world, 120, input({ right: true }));
    const nearest = Math.min(...panel.map((f) => f.x));
    expect(matt.x).toBeLessThanOrEqual(nearest - DESK_GAP);
  });

  it('passes the hot seat along in order, and the beaten stay slumped at their desks', () => {
    const { world, matt, panel } = panelRoom();
    const [screener, techlead] = ['screener', 'techlead'].map((k) =>
      panel.find((f) => f.kind === k),
    );
    if (!screener || !techlead) throw new Error('panel missing');
    const seatX = screener.x;
    const events = satisfy(world, matt, screener);
    expect(events).toContainEqual({ type: 'panel', kind: 'techlead', last: false });
    expect(hotSeat(world)).toBe(techlead);
    run(world, 200);
    expect(world.fighters).toContain(screener);
    expect(screener.x).toBe(seatX);
    expect(screener.state).toBe('dead');
  });

  it('makes the offer when the last one is satisfied, and the stage ends there', () => {
    const { world, matt, panel } = panelRoom();
    const events: SimEvent[] = [];
    for (const kind of ['screener', 'techlead', 'manager']) {
      const seat = panel.find((f) => f.kind === kind);
      if (!seat) throw new Error(`no ${kind}`);
      events.push(...satisfy(world, matt, seat));
    }
    expect(events).toContainEqual({ type: 'panel', kind: 'manager', last: true });
    expect(events).toContainEqual({ type: 'hired' });
    runUntil(world, () => world.status !== 'playing', 300);
    expect(world.status).toBe('cleared');
  });

  it('asks questions from the hot seat', () => {
    const { world, panel } = panelRoom();
    for (const f of panel) f.cooldown = 0;
    runUntil(world, () => world.projectiles.length > 0, 120);
    expect(world.projectiles.map((p) => p.kind)).toEqual(['form']);
  });
});

describe("the tech lead's sticky-note shockwave", () => {
  function waveAt(world: World, matt: Fighter, z: number): void {
    world.projectiles.push({
      id: world.nextId++,
      kind: 'notes',
      ownerId: 0,
      team: 'enemy',
      x: matt.x + 60,
      z,
      vx: -PROJECTILES.notes.speed,
    });
  }

  it('hits at any depth', () => {
    const { world, matt } = soloWorld();
    waveAt(world, matt, matt.z < DEPTH / 2 ? DEPTH : 0);
    runUntil(world, () => world.projectiles.length === 0, 120);
    expect(matt.hp).toBe(KINDS.matt.maxHp - ATTACKS.notes.damage);
  });

  it('is cleared by a jump', () => {
    const { world, matt } = soloWorld();
    waveAt(world, matt, matt.z);
    run(world, 12);
    step(world, [input({ jump: true })]);
    runUntil(world, () => world.projectiles.length === 0, 120);
    expect(matt.hp).toBe(KINDS.matt.maxHp);
  });
});
