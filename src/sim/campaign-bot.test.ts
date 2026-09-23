import { describe, expect, it } from 'vitest';
import { TICK_HZ } from './constants';
import { CASUAL, createBot, SHARP, type BotSkill } from './bot';
import { carryFromStreet, carryFromTunnel, tunnelStart, type Carry } from './campaign';
import { STAGE_1, STAGE_3, type StageDef } from './stage';
import { createTunnel, stepTunnel, TUNNEL_1 } from './tunnel';
import { createTunnelBot, TUNNEL_CASUAL, TUNNEL_SHARP, type TunnelBotSkill } from './tunnel-bot';
import { createWorld, step } from './world';

const BRAWL_BUDGET = 180 * TICK_HZ;
const TUNNEL_BUDGET = 60 * 60;

interface Leg {
  cleared: boolean;
  carry: Carry;
}

/** A brawl stage; `carryFromStreet` reads any brawl world, the tower's too. */
function brawl(stage: StageDef, skill: BotSkill, seed: number, carry?: Carry): Leg {
  const world = createWorld(stage, seed, { carry });
  const bot = createBot(skill);
  while (world.status === 'playing' && world.tick < BRAWL_BUDGET) step(world, [bot(world)]);
  return { cleared: world.status === 'cleared', carry: carryFromStreet(world) };
}

function tunnel(skill: TunnelBotSkill, seed: number, carry: Carry): Leg {
  const world = createTunnel(TUNNEL_1, seed, tunnelStart(carry));
  const bot = createTunnelBot(skill, seed);
  while (world.status === 'playing' && world.tick < TUNNEL_BUDGET) stepTunnel(world, bot(world));
  return { cleared: world.status === 'cleared', carry: carryFromTunnel(world) };
}

function campaign(brawler: BotSkill, rider: TunnelBotSkill, seed: number): Leg[] {
  const street = brawl(STAGE_1, brawler, seed);
  if (!street.cleared) return [street];
  const ride = tunnel(rider, seed, street.carry);
  if (!ride.cleared) return [street, ride];
  return [street, ride, brawl(STAGE_3, brawler, seed, ride.carry)];
}

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function cleared(legs: Leg[]): boolean {
  return legs.length === 3 && legs.every((leg) => leg.cleared);
}

/**
 * The whole run, one attempt per stage, each stage starting from what the
 * last one left through the same carry functions the scenes use. Measured
 * 2026-09-23: both bots clear all ten seeds; the casual one reaches the
 * offer with 1 to 50 HP left (JOURNAL, M6 entry).
 */
describe('campaign beatability', () => {
  it.each(SEEDS)('the sharp bot plays the street, tunnel and tower through (seed %i)', (seed) => {
    expect(cleared(campaign(SHARP, TUNNEL_SHARP, seed))).toBe(true);
  });

  it('a casual player gets the offer on nearly every seed', () => {
    const runs = SEEDS.map((seed) => campaign(CASUAL, TUNNEL_CASUAL, seed));
    expect(runs.filter(cleared).length).toBeGreaterThanOrEqual(8);
  });

  it('but the tower still bites: a casual run that gets the offer ends it hurt', () => {
    const wins = SEEDS.map((seed) => campaign(CASUAL, TUNNEL_CASUAL, seed)).filter(cleared);
    const towerHp = wins.map((legs) => legs[2]?.carry.hp ?? 0);
    expect(towerHp.length).toBeGreaterThan(0);
    expect(Math.max(...towerHp)).toBeLessThan(80);
  });

  it('carries the score through every stage', () => {
    const legs = campaign(SHARP, TUNNEL_SHARP, 1);
    const scores = legs.map((leg) => leg.carry.score);
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
    expect(new Set(scores).size).toBe(3);
  });
});
