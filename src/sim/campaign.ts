import type { Directive } from './sidekick';
import { RETRY_HP, type TunnelStart, type TunnelWorld } from './tunnel';
import { players, type World } from './world';

/**
 * The run, stage by stage: the street brawl, the Take-Home Tunnel, the
 * Interview Tower. Matt's health, score and TOKEN's standing order carry
 * from each stage into the next.
 */
export type StageId = 'street' | 'tunnel' | 'tower';

export const CAMPAIGN: readonly StageId[] = ['street', 'tunnel', 'tower'];

export interface Carry {
  hp: number;
  score: number;
  directive: Directive;
}

export function nextStage(current: StageId): StageId | null {
  return CAMPAIGN[CAMPAIGN.indexOf(current) + 1] ?? null;
}

export function carryFromStreet(world: World): Carry {
  const matt = players(world)[0];
  return { hp: matt?.hp ?? 0, score: matt?.score ?? 0, directive: world.directive };
}

/** A Matt who limped off the street starts the tunnel patched up to the retry floor. */
export function tunnelStart(carry: Carry): Required<TunnelStart> {
  return { ...carry, hp: Math.max(carry.hp, RETRY_HP) };
}

export function carryFromTunnel(world: TunnelWorld): Carry {
  return { hp: world.matt.hp, score: world.score, directive: world.directive };
}
