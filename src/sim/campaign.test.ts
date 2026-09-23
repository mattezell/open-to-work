import { describe, expect, it } from 'vitest';
import { carryFromStreet, carryFromTunnel, nextStage, tunnelStart } from './campaign';
import { RETRY_HP, createTunnel, TUNNEL_1 } from './tunnel';
import { EMPTY_STAGE } from './test-helpers';
import { createWorld, players } from './world';

describe('the campaign', () => {
  it('runs the street, then the tunnel, then the tower', () => {
    expect(nextStage('street')).toBe('tunnel');
    expect(nextStage('tunnel')).toBe('tower');
    expect(nextStage('tower')).toBeNull();
  });

  it("carries Matt's health, score and TOKEN's order off the street", () => {
    const world = createWorld(EMPTY_STAGE, 1);
    const matt = players(world)[0];
    if (!matt) throw new Error('no Matt');
    matt.hp = 42;
    matt.score = 1234;
    world.directive = 'guard';
    expect(carryFromStreet(world)).toEqual({ hp: 42, score: 1234, directive: 'guard' });
  });

  it('starts the tunnel with what the street left, but never on fumes', () => {
    expect(tunnelStart({ hp: 90, score: 5, directive: 'focus' })).toEqual({
      hp: 90,
      score: 5,
      directive: 'focus',
    });
    expect(tunnelStart({ hp: 3, score: 5, directive: 'wild' }).hp).toBe(RETRY_HP);
  });

  it('carries the tunnel result into the next brawl', () => {
    const tunnel = createTunnel(TUNNEL_1, 1, { hp: 70, score: 900, directive: 'guard' });
    expect(carryFromTunnel(tunnel)).toEqual({ hp: 70, score: 900, directive: 'guard' });
  });

  it('lets a brawl start from a carry', () => {
    const world = createWorld(EMPTY_STAGE, 1, {
      carry: { hp: 55, score: 800, directive: 'focus' },
    });
    const matt = players(world)[0];
    expect(matt?.hp).toBe(55);
    expect(matt?.score).toBe(800);
    expect(world.directive).toBe('focus');
  });
});
