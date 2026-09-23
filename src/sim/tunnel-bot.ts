import { input, NO_INPUT, type InputFrame } from './input';
import {
  currentSpeed,
  LANES,
  wallBlocks,
  type HazardDef,
  type LaneIndex,
  type TunnelWorld,
} from './tunnel';

/** Ticks before a hurdle that a jump is highest: the middle of the clearance window. */
const JUMP_LEAD_TICKS = 17;
const LANE_SLOP = 0.75;

/** How well a scripted rider plays the tunnel. */
export interface TunnelBotSkill {
  /**
   * Ticks between choosing a lane. Jumps are timed every tick: a hurdle is
   * on screen long before it arrives, so a player anticipates it and what is
   * left is timing error, not reaction lag.
   */
  reactionTicks: number;
  /** How far down the track the bot notices hazards. */
  lookAhead: number;
  /** Largest early-or-late error, in ticks, on the jump it means to make. */
  jumpJitter: number;
}

/** Frame-perfect, sees the whole screen ahead. */
export const TUNNEL_SHARP: TunnelBotSkill = { reactionTicks: 1, lookAhead: 240, jumpJitter: 0 };

/** A first run: a quarter-second slow, eyes on the next thing only, jumps by feel. */
export const TUNNEL_CASUAL: TunnelBotSkill = { reactionTicks: 15, lookAhead: 170, jumpJitter: 13 };

function hazardsAhead(world: TunnelWorld, range: number): HazardDef[] {
  return world.track.hazards
    .slice(world.nextHazard)
    .filter((h) => h.x > world.distance && h.x - world.distance <= range);
}

function openLane(wall: HazardDef, z: number): LaneIndex {
  const lanes = ([0, 1, 2] as const).filter((lane) => !wallBlocks(wall, LANES[lane]));
  return lanes.reduce((best, lane) =>
    Math.abs(LANES[lane] - z) < Math.abs(LANES[best] - z) ? lane : best,
  );
}

/**
 * Timing error for one attempt at one hurdle. It is a hash of the bot seed,
 * the hurdle and the retry count, so a run replays exactly without drawing on
 * the sim's RNG, and a rewind does not replay the same mistake forever.
 */
function jitterFor(
  world: TunnelWorld,
  hurdle: HazardDef,
  skill: TunnelBotSkill,
  seed: number,
): number {
  if (skill.jumpJitter === 0) return 0;
  const key =
    Math.floor(hurdle.x) ^ Math.imul(seed, 0x9e3779b9) ^ Math.imul(world.retries + 1, 0x27d4eb2f);
  const hash = Math.imul(key, 0x85ebca6b) >>> 0;
  return (hash % (2 * skill.jumpJitter + 1)) - skill.jumpJitter;
}

/** The depth the bot means to ride at: the open lane of the next wall it has noticed. */
function chooseLaneZ(world: TunnelWorld, skill: TunnelBotSkill): number {
  const z = world.matt.z;
  const wall = hazardsAhead(world, skill.lookAhead).find((h) => h.kind === 'wall');
  return wall ? LANES[openLane(wall, z)] : z;
}

function wantsJump(world: TunnelWorld, skill: TunnelBotSkill, seed: number): boolean {
  const hurdle = hazardsAhead(world, skill.lookAhead).find((h) => h.kind === 'hurdle');
  if (!hurdle || world.matt.y !== 0) return false;
  const ticksAway = (hurdle.x - world.distance) / currentSpeed(world);
  return ticksAway <= JUMP_LEAD_TICKS + jitterFor(world, hurdle, skill, seed);
}

/**
 * A scripted rider at the given skill. Like the brawler bot, it keeps its
 * last decision between reaction ticks, so each run needs its own instance.
 */
export function createTunnelBot(
  skill: TunnelBotSkill,
  seed = 1,
): (world: TunnelWorld) => InputFrame {
  let targetZ: number = LANES[1];
  return (world) => {
    if (world.status !== 'playing') return NO_INPUT;
    // Slow to pick a lane, but lets go of the stick on arrival.
    if (world.tick % skill.reactionTicks === 0) targetZ = chooseLaneZ(world, skill);
    const dz = targetZ - world.matt.z;
    const steer = dz > LANE_SLOP ? 1 : dz < -LANE_SLOP ? -1 : 0;
    // A jump is one press; holding it would never re-arm.
    const jump = !world.prevInput.jump && wantsJump(world, skill, seed);
    return input({ up: steer === -1, down: steer === 1, jump });
  };
}
