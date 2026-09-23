import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../sim/world';
import type { TunnelEvent } from '../sim/tunnel';
import { barkFor, DIRECTIVE_LABELS, tunnelBarkFor } from './barks';

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
  { type: 'ghosted', id: 5 },
  { type: 'panel', kind: 'techlead', last: false },
  { type: 'panel', kind: 'manager', last: true },
  { type: 'hired' },
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

  it('cheers the final round differently from the others', () => {
    const round = barkFor({ type: 'panel', kind: 'techlead', last: false }, TOKEN_ID, 0);
    const final = barkFor({ type: 'panel', kind: 'manager', last: true }, TOKEN_ID, 0);
    expect(final?.text).not.toBe(round?.text);
  });

  it('labels every order', () => {
    expect(Object.values(DIRECTIVE_LABELS)).toEqual(['GO WILD', 'FOCUS', 'GUARD']);
  });
});

describe('tunnelBarkFor', () => {
  it('shouts each call as a short command', () => {
    const shout = (call: 'jump' | 'high' | 'middle' | 'low'): string | undefined =>
      tunnelBarkFor({ type: 'call', call, correct: true }, 0)?.text;
    expect(shout('jump')).toBe('JUMP!');
    expect(shout('high')).toBe('GO HIGH!');
    expect(shout('middle')).toBe('MIDDLE!');
    expect(shout('low')).toBe('GO LOW!');
  });

  it('says a wrong call just as confidently as a right one', () => {
    const wrong = tunnelBarkFor({ type: 'call', call: 'low', correct: false }, 0);
    const right = tunnelBarkFor({ type: 'call', call: 'low', correct: true }, 0);
    expect(wrong).toEqual(right);
    expect(wrong?.urgent).toBe(true);
  });

  it('has a short line for every tunnel event TOKEN reacts to', () => {
    const events: TunnelEvent[] = [
      { type: 'order', directive: 'guard' },
      { type: 'shield' },
      { type: 'crash', kind: 'wall' },
      { type: 'crash', kind: 'hurdle' },
      { type: 'retry', checkpoint: 0 },
      { type: 'checkpoint', x: 100 },
    ];
    for (const event of events) {
      for (let pick = 0; pick < 6; pick++) {
        const text = tunnelBarkFor(event, pick)?.text ?? '';
        expect(text.length).toBeGreaterThan(0);
        expect(text.length).toBeLessThanOrEqual(MAX_BARK_CHARS);
      }
    }
  });

  it('keeps quiet about clean passes and the finish line', () => {
    expect(tunnelBarkFor({ type: 'cleared-hazard', kind: 'wall' }, 0)).toBeNull();
    expect(tunnelBarkFor({ type: 'cleared', retries: 0 }, 0)).toBeNull();
  });
});
