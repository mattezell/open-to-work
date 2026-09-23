import { describe, expect, it } from 'vitest';
import { input, NO_INPUT, type InputFrame } from './input';
import {
  CRASH_DAMAGE,
  createTunnel,
  HURDLE_HEIGHT,
  LANES,
  RETRY_HP,
  stepTunnel,
  TUNNEL_1,
  type TrackDef,
  type TunnelEvent,
  type TunnelWorld,
} from './tunnel';

/** One section, one hazard, nothing else: the smallest track that tests a rule. */
function track(hazards: TrackDef['hazards'], length = 1000): TrackDef {
  return { id: 'test', length, sections: [{ x: 0, speed: 2 }], hazards };
}

function ride(world: TunnelWorld, ticks: number, frame: InputFrame = NO_INPUT): TunnelEvent[] {
  const events: TunnelEvent[] = [];
  for (let i = 0; i < ticks && world.status === 'playing'; i++) {
    stepTunnel(world, frame);
    events.push(...world.events);
  }
  return events;
}

/** Ride until Matt reaches `x` on the track, holding `frame`. */
function rideTo(world: TunnelWorld, x: number, frame: InputFrame = NO_INPUT): TunnelEvent[] {
  const events: TunnelEvent[] = [];
  while (world.distance < x && world.status === 'playing') events.push(...ride(world, 1, frame));
  return events;
}

const MIDDLE = LANES[1];

describe('the tunnel', () => {
  it('scrolls on its own at the section speed', () => {
    const world = createTunnel(track([]), 1);
    ride(world, 60);
    expect(world.distance).toBe(120);
  });

  it('speeds up section by section', () => {
    const world = createTunnel(
      {
        ...track([]),
        sections: [
          { x: 0, speed: 2 },
          { x: 100, speed: 3 },
        ],
      },
      1,
    );
    rideTo(world, 100);
    const before = world.distance;
    ride(world, 10);
    expect(world.distance - before).toBe(30);
  });

  it('lets Matt steer across the lanes but not off the tunnel', () => {
    const world = createTunnel(track([]), 1);
    expect(world.matt.z).toBe(MIDDLE);
    ride(world, 200, input({ up: true }));
    expect(world.matt.z).toBe(LANES[0] - 8);
    ride(world, 200, input({ down: true }));
    expect(world.matt.z).toBe(LANES[2] + 8);
  });

  it('is cleared at the end of the track, with a bonus for no retries', () => {
    const world = createTunnel(track([], 300), 1);
    const events = ride(world, 400);
    expect(world.status).toBe('cleared');
    expect(events).toContainEqual({ type: 'cleared', retries: 0 });
    expect(world.score).toBeGreaterThan(0);
  });
});

describe('hurdles', () => {
  const HURDLE = track([{ kind: 'hurdle', x: 200 }]);

  it('crash a Matt who stays on the ground', () => {
    const world = createTunnel(HURDLE, 1);
    const events = rideTo(world, 260);
    expect(world.matt.hp).toBe(100 - CRASH_DAMAGE);
    expect(events).toContainEqual({ type: 'crash', kind: 'hurdle' });
  });

  it('are cleared by a jump, and score', () => {
    const world = createTunnel(HURDLE, 1);
    rideTo(world, 176);
    ride(world, 1, input({ jump: true }));
    const events = rideTo(world, 260);
    expect(world.matt.hp).toBe(100);
    expect(events).toContainEqual({ type: 'cleared-hazard', kind: 'hurdle' });
    expect(world.score).toBeGreaterThan(0);
  });

  it('still crash a jump that lands too early', () => {
    const world = createTunnel(HURDLE, 1);
    rideTo(world, 100);
    ride(world, 1, input({ jump: true }));
    rideTo(world, 260);
    expect(world.matt.hp).toBe(100 - CRASH_DAMAGE);
  });

  it('are higher than the jump clears for its first few ticks', () => {
    const world = createTunnel(track([]), 1);
    ride(world, 1, input({ jump: true }));
    expect(world.matt.y).toBeLessThan(HURDLE_HEIGHT);
  });
});

describe('walls', () => {
  const WALL = track([{ kind: 'wall', x: 200, lanes: [1] }]);

  it('crash a Matt in a blocked lane', () => {
    const world = createTunnel(WALL, 1);
    const events = rideTo(world, 260);
    expect(events).toContainEqual({ type: 'crash', kind: 'wall' });
  });

  it('let a Matt in an open lane through', () => {
    const world = createTunnel(WALL, 1);
    ride(world, 30, input({ up: true }));
    const events = rideTo(world, 260);
    expect(world.matt.hp).toBe(100);
    expect(events).toContainEqual({ type: 'cleared-hazard', kind: 'wall' });
  });

  it('cannot be jumped', () => {
    const world = createTunnel(WALL, 1);
    rideTo(world, 176);
    ride(world, 1, input({ jump: true }));
    rideTo(world, 260);
    expect(world.matt.hp).toBe(100 - CRASH_DAMAGE);
  });
});

describe('crashing', () => {
  it('knocks Matt off balance for a moment, then he can steer again', () => {
    const world = createTunnel(track([{ kind: 'hurdle', x: 100 }]), 1);
    rideTo(world, 102);
    expect(world.matt.crash).toBeGreaterThan(0);
    const z = world.matt.z;
    ride(world, 5, input({ up: true }));
    expect(world.matt.z).toBe(z);
    ride(world, 60, input({ up: true }));
    expect(world.matt.z).toBeLessThan(z);
  });

  it('flickers Matt through the next hazard if it is right behind', () => {
    const world = createTunnel(
      track([
        { kind: 'hurdle', x: 100 },
        { kind: 'hurdle', x: 140 },
      ]),
      1,
    );
    rideTo(world, 200);
    expect(world.matt.hp).toBe(100 - CRASH_DAMAGE);
  });

  it('never ends the game: at zero health the run rewinds to the checkpoint', () => {
    const world = createTunnel(
      {
        ...track([{ kind: 'hurdle', x: 700 }]),
        sections: [
          { x: 0, speed: 2 },
          { x: 500, speed: 2 },
        ],
      },
      1,
    );
    world.matt.hp = CRASH_DAMAGE;
    const events: TunnelEvent[] = [];
    while (world.retries === 0 && world.distance < 720) events.push(...ride(world, 1));
    expect(events).toContainEqual({ type: 'retry', checkpoint: 500 });
    expect(world.distance).toBeLessThan(720);
    expect(world.matt.hp).toBe(RETRY_HP);
    expect(world.retries).toBe(1);
    expect(world.status).toBe('playing');
  });

  it('shrinks the clear bonus for every retry', () => {
    const clean = createTunnel(track([], 300), 1);
    ride(clean, 400);
    const retried = createTunnel(track([], 300), 1);
    retried.retries = 1;
    ride(retried, 400);
    expect(retried.score).toBeLessThan(clean.score);
  });
});

describe('TOKEN in the tunnel', () => {
  function callsFor(directive: TunnelWorld['directive'], seed: number): TunnelEvent[] {
    const hazards: TrackDef['hazards'] = [];
    for (let x = 300; x < 9000; x += 300) hazards.push({ kind: 'wall', x, lanes: [0, 1] });
    const world = createTunnel(track(hazards, 9400), seed);
    world.directive = directive;
    world.matt.invuln = 1_000_000;
    return ride(world, 5000).filter((e) => e.type === 'call');
  }

  it('calls out each hazard before it arrives', () => {
    const world = createTunnel(track([{ kind: 'hurdle', x: 400 }]), 1);
    world.directive = 'focus';
    const events = rideTo(world, 300);
    expect(events).toContainEqual({ type: 'call', call: 'jump', correct: true });
  });

  it('names the open lane for a wall', () => {
    const calls = callsFor('focus', 1);
    expect(calls.length).toBeGreaterThan(20);
    expect(calls.every((c) => c.type === 'call' && c.call === 'low' && c.correct)).toBe(true);
  });

  it('is sometimes confidently wrong on Go wild, never on Focus', () => {
    const wrong = callsFor('wild', 3).filter((c) => c.type === 'call' && !c.correct);
    expect(wrong.length).toBeGreaterThan(0);
    const focusWrong = callsFor('focus', 3).filter((c) => c.type === 'call' && !c.correct);
    expect(focusWrong).toHaveLength(0);
  });

  it('on Guard takes the first crash of each section for Matt', () => {
    const world = createTunnel(
      track([
        { kind: 'hurdle', x: 200 },
        { kind: 'hurdle', x: 500 },
      ]),
      1,
    );
    world.directive = 'guard';
    const events = rideTo(world, 600);
    expect(events).toContainEqual({ type: 'shield' });
    expect(world.matt.hp).toBe(100 - CRASH_DAMAGE);
  });

  it('takes orders with the same button', () => {
    const world = createTunnel(track([]), 1);
    const events = ride(world, 1, input({ order: true }));
    expect(world.directive).toBe('focus');
    expect(events).toContainEqual({ type: 'order', directive: 'focus' });
  });
});

describe('Stage 2 track', () => {
  it('has hurdles, walls, and gets faster toward the end', () => {
    const kinds = new Set(TUNNEL_1.hazards.map((h) => h.kind));
    expect(kinds).toEqual(new Set(['hurdle', 'wall']));
    const speeds = TUNNEL_1.sections.map((s) => s.speed);
    expect(speeds).toEqual([...speeds].sort((a, b) => a - b));
    expect(new Set(speeds).size).toBe(speeds.length);
  });

  it('never blocks every lane with walls at one spot', () => {
    for (const h of TUNNEL_1.hazards) {
      if (h.kind === 'wall') expect(h.lanes?.length ?? 0).toBeLessThan(LANES.length);
    }
  });
});
