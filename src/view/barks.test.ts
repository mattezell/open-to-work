import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../sim/world';
import { barkFor, DIRECTIVE_LABELS } from './barks';

const TOKEN_ID = 2;
/** Widest bubble that still fits between the screen edges at 8px monospace. */
const MAX_BARK_CHARS = 40;

const EVENTS: SimEvent[] = [
  { type: 'order', directive: 'wild' },
  { type: 'order', directive: 'focus' },
  { type: 'order', directive: 'guard' },
  { type: 'intercept' },
  { type: 'whiff' },
  { type: 'reboot' },
  { type: 'rebooted' },
  { type: 'ko', id: 9, by: TOKEN_ID },
  { type: 'pickup', kind: 'coffee', by: 1 },
  { type: 'reinforcements', by: 7 },
];

describe('barkFor', () => {
  it('has a short line for every event TOKEN reacts to, whichever variant is picked', () => {
    for (const event of EVENTS) {
      for (let pick = 0; pick < 6; pick++) {
        const bark = barkFor(event, TOKEN_ID, pick);
        expect(bark?.text.length ?? 0).toBeGreaterThan(0);
        expect(bark?.text.length ?? 0).toBeLessThanOrEqual(MAX_BARK_CHARS);
      }
    }
  });

  it('rotates lines as the pick changes', () => {
    const lines = new Set(
      [0, 1, 2].map((pick) => barkFor({ type: 'whiff' }, TOKEN_ID, pick)?.text),
    );
    expect(lines.size).toBe(3);
  });

  it("only brags about TOKEN's own KOs", () => {
    expect(barkFor({ type: 'ko', id: 9, by: 1 }, TOKEN_ID, 0)).toBeNull();
  });

  it('always shows a reply to an order, and lets chatter wait', () => {
    expect(barkFor({ type: 'order', directive: 'focus' }, TOKEN_ID, 0)?.urgent).toBe(true);
    expect(barkFor({ type: 'whiff' }, TOKEN_ID, 0)?.urgent).toBe(false);
  });

  it('labels every order', () => {
    expect(Object.values(DIRECTIVE_LABELS)).toEqual(['GO WILD', 'FOCUS', 'GUARD']);
  });
});
