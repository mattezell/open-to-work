import { describe, expect, it } from 'vitest';
import { LANES } from '../sim/tunnel';
import { CLEAR_COLOR, CRASH_COLOR, hazardAlpha, PASSING_HAZARD_ALPHA, popFor } from './tunnel-view';

describe('hazard feedback in the tunnel', () => {
  it('tells a clean clear from a crash', () => {
    const clear = popFor({ type: 'cleared-hazard', kind: 'hurdle' });
    const crash = popFor({ type: 'crash', kind: 'hurdle' });
    expect(clear?.text).toMatch(/^CLEAR/);
    expect(clear?.color).toBe(CLEAR_COLOR);
    expect(crash?.text).toMatch(/^CRASH/);
    expect(crash?.color).toBe(CRASH_COLOR);
  });

  it("names TOKEN's airbag, and leaves other events to the banner and bubble", () => {
    expect(popFor({ type: 'shield' })?.text).toBe('BLOCKED');
    expect(popFor({ type: 'checkpoint', x: 900 })).toBeNull();
    expect(popFor({ type: 'call', call: 'jump', correct: true })).toBeNull();
  });

  it('fades the hurdles in front of Matt while he passes them, and only those', () => {
    const [back, middle, front] = LANES;
    expect(hazardAlpha(front, middle, 0)).toBe(PASSING_HAZARD_ALPHA);
    expect(hazardAlpha(back, middle, 0)).toBe(1);
    expect(hazardAlpha(middle, middle, 0)).toBe(1);
    expect(hazardAlpha(front, middle, 120)).toBe(1);
  });
});
