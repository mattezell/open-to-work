import { describe, expect, it } from 'vitest';
import { nextRandom, randomInt } from './rng';

describe('rng', () => {
  it('is reproducible from the same seed', () => {
    const a = { rng: 42 };
    const b = { rng: 42 };
    const seqA = Array.from({ length: 5 }, () => nextRandom(a));
    const seqB = Array.from({ length: 5 }, () => nextRandom(b));
    expect(seqA).toEqual(seqB);
  });

  it('keeps randomInt within its inclusive bounds', () => {
    const state = { rng: 7 };
    const values = Array.from({ length: 500 }, () => randomInt(state, 3, 5));
    expect(Math.min(...values)).toBe(3);
    expect(Math.max(...values)).toBe(5);
  });
});
