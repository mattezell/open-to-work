import {
  CAMERA_LEAD,
  DEPTH,
  GO_PROMPT_TICKS,
  INPUT_BUFFER_TICKS,
  SCREEN_MARGIN,
  SCREEN_W,
} from './constants';
import { KINDS, type AttackId, type FighterKind, type ProjectileKind, type Team } from './fighters';
import { NO_INPUT, type InputFrame } from './input';
import type { PickupKind, StageDef } from './stage';
import { stepFighter } from './fighter-step';
import { resolveHits } from './combat';
import { launchProjectiles, stepProjectiles } from './projectiles';
import { collectPickups } from './pickups';
import { callReinforcements } from './boss';
import { updateGhosters } from './ghoster';
import { updatePanel } from './panel';
import { enemyIntent } from './ai';
import { nextDirective, sidekickIntent, updateSidekick, type Directive } from './sidekick';
import type { Carry } from './campaign';

export type FighterState =
  'idle' | 'walk' | 'jump' | 'attack' | 'hurt' | 'knockdown' | 'getup' | 'dead';

/** Who drives a fighter: a human's controls, or the sim's own AI. */
export type Pilot = 'human' | 'ai';

export interface Fighter {
  id: number;
  kind: FighterKind;
  team: Team;
  pilot: Pilot;
  /** Belt position. */
  x: number;
  /** Depth, 0 (back) to DEPTH (front). */
  z: number;
  /** Height above the ground; > 0 while airborne. */
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  hp: number;
  state: FighterState;
  /** Ticks spent in the current state. */
  stateTick: number;
  attack: AttackId | null;
  /** Ticks since the current attack started. */
  attackTick: number;
  /** Ids already struck by the current attack, so one swing hits each target once. */
  attackHits: number[];
  /** Index into CHAIN of the next ground attack. */
  chain: number;
  chainTimer: number;
  attackBuffer: number;
  invuln: number;
  /** AI-only: ticks until it may start another attack. */
  cooldown: number;
  score: number;
  /** Id of the last fighter this one hit, so TOKEN can focus on Matt's target. */
  lastTarget: number | null;
  /** Bosses only: how many times it has called for reinforcements. */
  summons: number;
  /**
   * Ticks left out of play: nothing can hit it and nobody targets it. A
   * Ghoster that has faded out, or a panelist waiting for its turn.
   */
  ghost: number;
  /** Ghosters only: it was hit, so it fades out as soon as it recovers. */
  ghostDue: boolean;
}

export interface Projectile {
  id: number;
  kind: ProjectileKind;
  /** The fighter that threw it, who gets the score. May be gone by the time it lands. */
  ownerId: number;
  team: Team;
  x: number;
  z: number;
  vx: number;
}

export interface Pickup {
  id: number;
  kind: PickupKind;
  x: number;
  z: number;
}

/** Things that happened this tick, for the view to show and play. Cleared every step. */
export type SimEvent =
  | { type: 'order'; directive: Directive }
  | { type: 'ko'; id: number; by: number }
  | { type: 'intercept' }
  | { type: 'whiff' }
  | { type: 'reboot' }
  | { type: 'rebooted' }
  | { type: 'pickup'; kind: PickupKind; by: number }
  | { type: 'reinforcements'; by: number }
  | { type: 'ghosted'; id: number }
  /** A panelist takes the hot seat; `last` when it is the final one. */
  | { type: 'panel'; kind: FighterKind; last: boolean }
  /** The last panelist is satisfied: the offer. */
  | { type: 'hired' };

/** Where TOKEN thinks an enemy still is after it has gone: the Go wild hallucination. */
export interface Phantom {
  x: number;
  z: number;
  /** Give up on the phantom after this many more ticks. */
  ticks: number;
}

export type WorldStatus = 'playing' | 'cleared' | 'gameover';

export interface World {
  tick: number;
  rng: number;
  stage: StageDef;
  fighters: Fighter[];
  projectiles: Projectile[];
  pickups: Pickup[];
  nextId: number;
  /** Left edge of the visible screen in belt coordinates. */
  cameraX: number;
  /** Index of the wave currently holding the camera, or -1. */
  activeWave: number;
  /** Ticks since the active wave began. */
  waveTick: number;
  /** Spawns of the active wave that have not entered yet. */
  pendingSpawns: number[];
  wavesCleared: number;
  hitstop: number;
  goPrompt: number;
  status: WorldStatus;
  prevInputs: InputFrame[];
  directive: Directive;
  phantom: Phantom | null;
  events: SimEvent[];
}

export interface WorldOptions {
  /** Spawn TOKEN beside Matt. Off in duel tests that need Matt alone. */
  sidekick?: boolean;
  /** Where the last stage left Matt and TOKEN's order. */
  carry?: Carry;
}

export function spawnFighter(
  world: World,
  kind: FighterKind,
  x: number,
  z: number,
  pilot: Pilot = kind === 'matt' ? 'human' : 'ai',
): Fighter {
  const stats = KINDS[kind];
  const fighter: Fighter = {
    id: world.nextId++,
    kind,
    team: stats.team,
    pilot,
    x,
    z,
    y: 0,
    vx: 0,
    vy: 0,
    facing: stats.team === 'player' ? 1 : -1,
    hp: stats.maxHp,
    state: 'idle',
    stateTick: 0,
    attack: null,
    attackTick: 0,
    attackHits: [],
    chain: 0,
    chainTimer: 0,
    attackBuffer: 0,
    invuln: 0,
    cooldown: 60,
    score: 0,
    lastTarget: null,
    summons: 0,
    // A panelist sits out of play until its turn comes round.
    ghost: stats.seated ? 1 : 0,
    ghostDue: false,
  };
  world.fighters.push(fighter);
  return fighter;
}

export function createWorld(stage: StageDef, seed: number, options: WorldOptions = {}): World {
  const world: World = {
    tick: 0,
    rng: seed >>> 0,
    stage,
    fighters: [],
    projectiles: [],
    pickups: [],
    nextId: 1,
    cameraX: 0,
    activeWave: -1,
    waveTick: 0,
    pendingSpawns: [],
    wavesCleared: 0,
    hitstop: 0,
    goPrompt: 0,
    status: 'playing',
    prevInputs: [],
    directive: 'wild',
    phantom: null,
    events: [],
  };
  const matt = spawnFighter(world, 'matt', 60, DEPTH / 2);
  if (options.carry) {
    matt.hp = options.carry.hp;
    matt.score = options.carry.score;
    world.directive = options.carry.directive;
  }
  if (options.sidekick ?? true) spawnFighter(world, 'token', 20, DEPTH / 2 - 12);
  for (const pickup of stage.pickups ?? []) world.pickups.push({ id: world.nextId++, ...pickup });
  return world;
}

/** Human-piloted fighters, in input order: `inputs[i]` drives `players(world)[i]`. */
export function players(world: World): Fighter[] {
  return world.fighters.filter((f) => f.pilot === 'human');
}

export function sidekick(world: World): Fighter | undefined {
  return world.fighters.find((f) => f.kind === 'token');
}

export function livingEnemies(world: World): Fighter[] {
  return world.fighters.filter((f) => f.team === 'enemy' && f.state !== 'dead');
}

/** Advance the world one tick. `inputs[i]` drives player i. Mutates in place. */
export function step(world: World, inputs: readonly InputFrame[]): void {
  if (world.status !== 'playing') return;
  world.tick++;
  world.events = [];

  const humans = players(world);
  humans.forEach((p, i) => {
    const now = inputs[i] ?? NO_INPUT;
    const before = world.prevInputs[i] ?? NO_INPUT;
    if (now.attack && !before.attack) p.attackBuffer = INPUT_BUFFER_TICKS;
    else if (p.attackBuffer > 0) p.attackBuffer--;
    if (now.order && !before.order) {
      world.directive = nextDirective(world.directive);
      world.events.push({ type: 'order', directive: world.directive });
    }
  });

  // Hit-stop freezes everything except input buffering, the SoR feel.
  if (world.hitstop > 0) {
    world.hitstop--;
    world.prevInputs = inputs.map((i) => ({ ...i }));
    return;
  }

  humans.forEach((p, i) => {
    const now = inputs[i] ?? NO_INPUT;
    const before = world.prevInputs[i] ?? NO_INPUT;
    stepFighter(p, now, before);
  });
  for (const ally of world.fighters.filter((f) => f.team === 'player' && f.pilot === 'ai')) {
    updateSidekick(world, ally);
    stepFighter(ally, sidekickIntent(world, ally), NO_INPUT);
  }
  // Dead enemies still step so their corpse timer runs and they get removed.
  for (const enemy of world.fighters.filter((f) => f.team === 'enemy')) {
    const intent = enemyIntent(world, enemy);
    stepFighter(enemy, intent, NO_INPUT);
  }
  updateGhosters(world);
  world.prevInputs = inputs.map((i) => ({ ...i }));

  launchProjectiles(world);
  resolveHits(world);
  stepProjectiles(world);
  updatePanel(world);
  callReinforcements(world);
  collectPickups(world);
  clampToScreen(world);
  updateWaves(world);
  updateCamera(world);
  if (world.goPrompt > 0) world.goPrompt--;
  // A beaten panelist stays in its seat; everyone else is cleared away.
  world.fighters = world.fighters.filter(
    (f) => !(f.state === 'dead' && f.team === 'enemy' && f.stateTick > 60 && !KINDS[f.kind].seated),
  );

  const allWavesCleared = world.wavesCleared === world.stage.waves.length;
  if (humans.every((p) => p.state === 'dead')) world.status = 'gameover';
  else if (
    allWavesCleared &&
    (world.stage.endsOnLastWave ||
      humans.some((p) => p.x >= world.stage.length - SCREEN_MARGIN - 20))
  ) {
    world.status = 'cleared';
  }
}

function clampToScreen(world: World): void {
  for (const f of world.fighters) {
    f.z = Math.min(DEPTH, Math.max(0, f.z));
    if (f.team === 'player') {
      const right = Math.min(world.cameraX + SCREEN_W, world.stage.length);
      f.x = Math.min(right - SCREEN_MARGIN, Math.max(world.cameraX + SCREEN_MARGIN, f.x));
    }
  }
}

function leadX(world: World): number {
  return Math.max(...players(world).map((p) => p.x));
}

function updateWaves(world: World): void {
  const waves = world.stage.waves;
  if (world.activeWave === -1) {
    const next = waves[world.wavesCleared];
    if (next && leadX(world) >= next.triggerX) {
      world.activeWave = world.wavesCleared;
      world.waveTick = 0;
      world.pendingSpawns = next.spawns.map((_, i) => i);
    }
    return;
  }

  const wave = waves[world.activeWave];
  if (!wave) return;
  world.waveTick++;
  world.pendingSpawns = world.pendingSpawns.filter((index) => {
    const spawn = wave.spawns[index];
    if (!spawn || world.waveTick < spawn.delay) return true;
    const x =
      spawn.inset !== undefined
        ? world.cameraX + SCREEN_W - spawn.inset
        : spawn.side === 'right'
          ? world.cameraX + SCREEN_W + 24
          : world.cameraX - 24;
    spawnFighter(world, spawn.kind, x, spawn.z);
    return false;
  });

  if (world.pendingSpawns.length === 0 && livingEnemies(world).length === 0) {
    world.activeWave = -1;
    world.wavesCleared++;
    world.goPrompt = GO_PROMPT_TICKS;
  }
}

function updateCamera(world: World): void {
  if (world.activeWave !== -1) return;
  const maxCamera = world.stage.length - SCREEN_W;
  const target = Math.min(maxCamera, leadX(world) - CAMERA_LEAD);
  // The camera only ever moves forward, like the genre.
  if (target > world.cameraX) world.cameraX = Math.min(target, world.cameraX + 2.5);
}
