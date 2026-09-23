import { GRAVITY } from './constants';
import { JUMP_VELOCITY } from './fighters';
import { NO_INPUT, type InputFrame } from './input';
import { randomInt } from './rng';
import { nextDirective, type Directive } from './sidekick';

/**
 * Stage 2, the Take-Home Tunnel: an autoscrolling hover-board run. Its own
 * world and step, because it shares almost nothing with the belt brawler.
 * See DESIGN.md, "Stage 2 as built".
 */

/** Lane centres across the tunnel, back (up on screen) to front. */
export const LANES = [10, 28, 46] as const;
export type LaneIndex = 0 | 1 | 2;
const Z_MIN = LANES[0] - 8;
const Z_MAX = LANES[2] + 8;
/** A lane blocks a rider whose depth is within this of its centre. */
const WALL_REACH = 12;
const STEER_SPEED = 1.5;
export const HURDLE_HEIGHT = 16;

export const CRASH_DAMAGE = 15;
/** Ticks Matt cannot steer or jump after a crash. */
export const CRASH_TICKS = 30;
/** Ticks after a crash during which hazards pass through him. */
const CRASH_INVULN = 60;
export const RETRY_HP = 60;
const RETRY_INVULN = 90;

const HAZARD_SCORE = 200;
const CLEAR_BONUS = 5000;
const RETRY_PENALTY = 1000;

/** TOKEN calls a hazard when it is this far ahead of Matt. */
export const CALL_AHEAD = 130;
/** On Go wild, this share of TOKEN's calls are confidently wrong. */
const WILD_WRONG_PERCENT = 25;

export type HazardKind = 'hurdle' | 'wall';

export interface HazardDef {
  kind: HazardKind;
  /** Track position of the hazard's leading edge. */
  x: number;
  /** Walls only: the lanes it blocks. Hurdles span every lane. */
  lanes?: LaneIndex[];
}

export interface SectionDef {
  /** Where the section starts; also its checkpoint. */
  x: number;
  /** Scroll speed in px per tick. */
  speed: number;
}

export interface TrackDef {
  id: string;
  length: number;
  /** In track order; the first starts at 0. */
  sections: SectionDef[];
  /** In track order. */
  hazards: HazardDef[];
}

export type Call = 'jump' | 'high' | 'middle' | 'low';
const LANE_CALLS: readonly Call[] = ['high', 'middle', 'low'];

export type TunnelEvent =
  | { type: 'crash'; kind: HazardKind }
  | { type: 'cleared-hazard'; kind: HazardKind }
  | { type: 'shield' }
  | { type: 'call'; call: Call; correct: boolean }
  | { type: 'checkpoint'; x: number }
  | { type: 'retry'; checkpoint: number }
  | { type: 'order'; directive: Directive }
  | { type: 'cleared'; retries: number };

export interface Rider {
  z: number;
  /** Height above the tunnel floor. */
  y: number;
  vy: number;
  hp: number;
  /** Ticks left of the wipeout; no control while > 0. */
  crash: number;
  invuln: number;
}

export interface TunnelWorld {
  tick: number;
  rng: number;
  track: TrackDef;
  /** Matt's position along the track. */
  distance: number;
  matt: Rider;
  /** TOKEN rides behind Matt; it only drifts after him and has no health here. */
  tokenZ: number;
  directive: Directive;
  /** Index of the section whose Guard shield has been spent, or -1. */
  shieldSpent: number;
  /** Next hazard Matt has not passed yet. */
  nextHazard: number;
  /** Next hazard TOKEN has not called yet. */
  nextCall: number;
  retries: number;
  score: number;
  status: 'playing' | 'cleared';
  prevInput: InputFrame;
  events: TunnelEvent[];
}

export interface TunnelStart {
  hp?: number;
  score?: number;
  directive?: Directive;
}

export function createTunnel(track: TrackDef, seed: number, start: TunnelStart = {}): TunnelWorld {
  return {
    tick: 0,
    rng: seed >>> 0,
    track,
    distance: 0,
    matt: { z: LANES[1], y: 0, vy: 0, hp: start.hp ?? 100, crash: 0, invuln: 0 },
    tokenZ: LANES[1],
    directive: start.directive ?? 'wild',
    shieldSpent: -1,
    nextHazard: 0,
    nextCall: 0,
    retries: 0,
    score: start.score ?? 0,
    status: 'playing',
    prevInput: NO_INPUT,
    events: [],
  };
}

export function sectionIndex(track: TrackDef, distance: number): number {
  let index = 0;
  track.sections.forEach((s, i) => {
    if (s.x <= distance) index = i;
  });
  return index;
}

export function currentSpeed(world: TunnelWorld): number {
  return world.track.sections[sectionIndex(world.track, world.distance)]?.speed ?? 0;
}

/** Whether a wall's blocked lanes reach a rider at depth `z`. */
export function wallBlocks(hazard: HazardDef, z: number): boolean {
  return (hazard.lanes ?? []).some((lane) => Math.abs(z - LANES[lane]) < WALL_REACH);
}

function nearestOpenLane(hazard: HazardDef, z: number): LaneIndex {
  const open = ([0, 1, 2] as const).filter((lane) => !hazard.lanes?.includes(lane));
  return open.reduce((best, lane) =>
    Math.abs(LANES[lane] - z) < Math.abs(LANES[best] - z) ? lane : best,
  );
}

export function correctCall(hazard: HazardDef, z: number): Call {
  if (hazard.kind === 'hurdle') return 'jump';
  return LANE_CALLS[nearestOpenLane(hazard, z)] ?? 'middle';
}

export function stepTunnel(world: TunnelWorld, frame: InputFrame): void {
  if (world.status !== 'playing') return;
  world.tick++;
  world.events = [];
  const before = world.prevInput;
  world.prevInput = { ...frame };

  if (frame.order && !before.order) {
    world.directive = nextDirective(world.directive);
    world.events.push({ type: 'order', directive: world.directive });
  }

  steer(world.matt, frame, before);
  world.tokenZ += Math.max(-1, Math.min(1, world.matt.z - world.tokenZ));

  const sectionBefore = sectionIndex(world.track, world.distance);
  world.distance += currentSpeed(world);
  const sectionNow = sectionIndex(world.track, world.distance);
  if (sectionNow !== sectionBefore) {
    world.events.push({ type: 'checkpoint', x: world.track.sections[sectionNow]?.x ?? 0 });
  }

  callHazards(world);
  passHazards(world);

  if (world.distance >= world.track.length) {
    world.status = 'cleared';
    world.score += Math.max(0, CLEAR_BONUS - RETRY_PENALTY * world.retries);
    world.events.push({ type: 'cleared', retries: world.retries });
  }
}

function steer(matt: Rider, frame: InputFrame, before: InputFrame): void {
  if (matt.invuln > 0) matt.invuln--;
  if (matt.crash > 0) {
    matt.crash--;
  } else {
    if (frame.up) matt.z -= STEER_SPEED;
    if (frame.down) matt.z += STEER_SPEED;
    matt.z = Math.min(Z_MAX, Math.max(Z_MIN, matt.z));
    if (frame.jump && !before.jump && matt.y === 0) matt.vy = JUMP_VELOCITY;
  }
  matt.y += matt.vy;
  matt.vy -= GRAVITY;
  if (matt.y <= 0) {
    matt.y = 0;
    matt.vy = 0;
  }
}

function callHazards(world: TunnelWorld): void {
  const hazards = world.track.hazards;
  for (let h = hazards[world.nextCall]; h && h.x - CALL_AHEAD <= world.distance;) {
    const right = correctCall(h, world.matt.z);
    let call = right;
    if (world.directive === 'wild' && randomInt(world, 0, 99) < WILD_WRONG_PERCENT) {
      const others = (['jump', ...LANE_CALLS] as Call[]).filter((c) => c !== right);
      call = others[randomInt(world, 0, others.length - 1)] ?? right;
    }
    world.events.push({ type: 'call', call, correct: call === right });
    world.nextCall++;
    h = hazards[world.nextCall];
  }
}

function passHazards(world: TunnelWorld): void {
  const hazards = world.track.hazards;
  for (let h = hazards[world.nextHazard]; h && h.x <= world.distance;) {
    world.nextHazard++;
    const hit = h.kind === 'hurdle' ? world.matt.y < HURDLE_HEIGHT : wallBlocks(h, world.matt.z);
    if (!hit) {
      world.score += HAZARD_SCORE;
      world.events.push({ type: 'cleared-hazard', kind: h.kind });
    } else if (world.matt.invuln === 0) {
      crash(world, h.kind);
      if (world.matt.hp <= 0) {
        retry(world);
        return;
      }
    }
    h = hazards[world.nextHazard];
  }
}

function crash(world: TunnelWorld, kind: HazardKind): void {
  const matt = world.matt;
  matt.crash = CRASH_TICKS;
  matt.invuln = CRASH_INVULN;
  matt.vy = 0;
  const section = sectionIndex(world.track, world.distance);
  if (world.directive === 'guard' && world.shieldSpent !== section) {
    world.shieldSpent = section;
    world.events.push({ type: 'shield' });
    return;
  }
  matt.hp = Math.max(0, matt.hp - CRASH_DAMAGE);
  world.events.push({ type: 'crash', kind });
}

/** Back to the start of the section, patched up. The tunnel never ends the game. */
function retry(world: TunnelWorld): void {
  const checkpoint = world.track.sections[sectionIndex(world.track, world.distance)]?.x ?? 0;
  world.distance = checkpoint;
  const firstAhead = world.track.hazards.findIndex((h) => h.x > checkpoint);
  world.nextHazard = firstAhead === -1 ? world.track.hazards.length : firstAhead;
  world.nextCall = world.nextHazard;
  world.retries++;
  Object.assign(world.matt, {
    z: LANES[1],
    y: 0,
    vy: 0,
    hp: RETRY_HP,
    crash: 0,
    invuln: RETRY_INVULN,
  });
  world.events.push({ type: 'retry', checkpoint });
}

const hurdle = (x: number): HazardDef => ({ kind: 'hurdle', x });
const wall = (x: number, ...lanes: LaneIndex[]): HazardDef => ({ kind: 'wall', x, lanes });

/**
 * Stage 2. Section one teaches each hazard alone, section two closes two
 * lanes at a time, section three swaps the open lane edge to edge at speed.
 */
export const TUNNEL_1: TrackDef = {
  id: 'take-home-tunnel',
  length: 6100,
  sections: [
    { x: 0, speed: 2.2 },
    { x: 1900, speed: 2.8 },
    { x: 3900, speed: 3.6 },
  ],
  hazards: [
    hurdle(400),
    hurdle(700),
    wall(1000, 1),
    wall(1250, 0),
    wall(1500, 2),
    hurdle(1700),

    wall(2150, 0, 1),
    wall(2400, 1, 2),
    hurdle(2650),
    wall(2850, 0, 2),
    wall(3100, 0, 1),
    hurdle(3250),
    wall(3500, 1, 2),
    hurdle(3650),

    wall(4150, 1, 2),
    wall(4320, 0, 1),
    wall(4490, 1, 2),
    hurdle(4640),
    wall(4820, 0, 2),
    wall(4990, 0, 1),
    hurdle(5120),
    wall(5300, 1, 2),
    wall(5470, 0, 1),
    wall(5640, 1, 2),
    hurdle(5800),
  ],
};
