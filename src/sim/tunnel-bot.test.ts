import { describe, expect, it } from 'vitest';
import { createTunnelBot, TUNNEL_CASUAL, TUNNEL_SHARP, type TunnelBotSkill } from './tunnel-bot';
import { createTunnel, stepTunnel, TUNNEL_1, type TunnelWorld } from './tunnel';
import type { Directive } from './sidekick';

const BUDGET_TICKS = 60 * 60;

function play(skill: TunnelBotSkill, seed: number, directive: Directive = 'wild'): TunnelWorld {
  const world = createTunnel(TUNNEL_1, seed, { directive });
  const bot = createTunnelBot(skill, seed);
  while (world.status === 'playing' && world.tick < BUDGET_TICKS) stepTunnel(world, bot(world));
  return world;
}

describe('tunnel beatability', () => {
  it.each([1, 2, 3, 4, 5])('the sharp bot clears the tunnel without a crash (seed %i)', (seed) => {
    const world = play(TUNNEL_SHARP, seed);
    expect(world.status).toBe('cleared');
    expect(world.retries).toBe(0);
    expect(world.matt.hp).toBe(100);
  });

  it.each([1, 2, 3, 4, 5])(
    'the casual bot clears it with at most two retries (seed %i)',
    (seed) => {
      const world = play(TUNNEL_CASUAL, seed);
      expect(world.status).toBe('cleared');
      expect(world.retries).toBeLessThanOrEqual(2);
    },
  );

  it('is not trivial: the casual bot crashes at least once across seeds', () => {
    const crashed = [1, 2, 3, 4, 5].some((seed) => {
      const world = play(TUNNEL_CASUAL, seed);
      return world.matt.hp < 100 || world.retries > 0;
    });
    expect(crashed).toBe(true);
  });

  it('Guard softens a casual run', () => {
    const hp = (d: Directive): number =>
      [1, 2, 3, 4, 5].reduce((sum, seed) => {
        const world = play(TUNNEL_CASUAL, seed, d);
        return sum + world.matt.hp - world.retries * 100;
      }, 0);
    expect(hp('guard')).toBeGreaterThanOrEqual(hp('wild'));
  });
});
