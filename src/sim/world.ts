import {
  CAMERA_LEAD,
  DEPTH,
  GO_PROMPT_TICKS,
  INPUT_BUFFER_TICKS,
  SCREEN_MARGIN,
  SCREEN_W,
} from './constants';
import { KINDS, type AttackId, type FighterKind, type Team } from './fighters';
import { NO_INPUT, type InputFrame } from './input';
import type { StageDef } from './stage';
import { stepFighter } from './fighter-step';
import { resolveHits } from './combat';
import { enemyIntent } from './ai';

export type FighterState =
  'idle' | 'walk' | 'jump' | 'attack' | 'hurt' | 'knockdown' | 'getup' | 'dead';

export interface Fighter {
  id: number;
  kind: FighterKind;
  team: Team;
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
  /** Enemy-only: ticks until it may attack again. */
  cooldown: number;
  score: number;
}

export type WorldStatus = 'playing' | 'cleared' | 'gameover';

export interface World {
  tick: number;
  rng: number;
  stage: StageDef;
  fighters: Fighter[];
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
}

export function spawnFighter(world: World, kind: FighterKind, x: number, z: number): Fighter {
  const stats = KINDS[kind];
  const fighter: Fighter = {
    id: world.nextId++,
    kind,
    team: stats.team,
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
  };
  world.fighters.push(fighter);
  return fighter;
}

export function createWorld(stage: StageDef, seed: number): World {
  const world: World = {
    tick: 0,
    rng: seed >>> 0,
    stage,
    fighters: [],
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
  };
  spawnFighter(world, 'matt', 60, DEPTH / 2);
  return world;
}

export function players(world: World): Fighter[] {
  return world.fighters.filter((f) => f.team === 'player');
}

export function livingEnemies(world: World): Fighter[] {
  return world.fighters.filter((f) => f.team === 'enemy' && f.state !== 'dead');
}

/** Advance the world one tick. `inputs[i]` drives player i. Mutates in place. */
export function step(world: World, inputs: readonly InputFrame[]): void {
  if (world.status !== 'playing') return;
  world.tick++;

  const humans = players(world);
  humans.forEach((p, i) => {
    const now = inputs[i] ?? NO_INPUT;
    const before = world.prevInputs[i] ?? NO_INPUT;
    if (now.attack && !before.attack) p.attackBuffer = INPUT_BUFFER_TICKS;
    else if (p.attackBuffer > 0) p.attackBuffer--;
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
  // Dead enemies still step so their corpse timer runs and they get removed.
  for (const enemy of world.fighters.filter((f) => f.team === 'enemy')) {
    const intent = enemyIntent(world, enemy);
    stepFighter(enemy, intent, NO_INPUT);
  }
  world.prevInputs = inputs.map((i) => ({ ...i }));

  resolveHits(world);
  clampToScreen(world);
  updateWaves(world);
  updateCamera(world);
  if (world.goPrompt > 0) world.goPrompt--;
  world.fighters = world.fighters.filter(
    (f) => !(f.state === 'dead' && f.team === 'enemy' && f.stateTick > 60),
  );

  if (humans.every((p) => p.state === 'dead')) world.status = 'gameover';
  else if (
    world.wavesCleared === world.stage.waves.length &&
    humans.some((p) => p.x >= world.stage.length - SCREEN_MARGIN - 20)
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
    const x = spawn.side === 'right' ? world.cameraX + SCREEN_W + 24 : world.cameraX - 24;
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
