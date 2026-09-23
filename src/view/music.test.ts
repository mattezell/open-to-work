import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../sim/world';
import type { TunnelEvent } from '../sim/tunnel';
import {
  hits,
  hz,
  midi,
  notes,
  secondsPerStep,
  sfxForSim,
  sfxForTunnel,
  STEPS,
  swingDelay,
  TRACKS,
  tunnelTempo,
} from './music';

describe('note helpers', () => {
  it('spells MIDI numbers the usual way', () => {
    expect(midi('A4')).toBe(69);
    expect(midi('C4')).toBe(60);
    expect(midi('F#2')).toBe(42);
    expect(midi('Bb1')).toBe(34);
  });

  it('rejects anything that is not a note', () => {
    expect(() => midi('H2')).toThrow('not a note');
    expect(() => midi('A')).toThrow('not a note');
  });

  it('tunes A4 to 440 Hz and doubles per octave', () => {
    expect(hz(69)).toBeCloseTo(440);
    expect(hz(81)).toBeCloseTo(880);
  });

  it('reads patterns with rests and bar lines', () => {
    expect(notes('A4 . | C4')).toEqual([69, null, 60]);
    expect(hits('x . | x x')).toEqual([true, false, true, true]);
  });
});

describe('the tracks', () => {
  it('are all two bars of sixteenths on every line', () => {
    for (const [id, track] of Object.entries(TRACKS)) {
      for (const line of [track.bass, track.lead, track.kick, track.snare, track.hat]) {
        expect(line.length, id).toBe(STEPS);
      }
    }
  });

  it('open every bar on the kick', () => {
    for (const track of Object.values(TRACKS)) {
      expect(track.kick[0]).toBe(true);
      expect(track.kick[16]).toBe(true);
    }
  });
});

describe('timing', () => {
  it('makes a sixteenth a quarter of a beat', () => {
    expect(secondsPerStep(120)).toBeCloseTo(0.125);
  });

  it('delays only the off-beat sixteenths', () => {
    expect(swingDelay(0, 0.1, 0.2)).toBe(0);
    expect(swingDelay(1, 0.1, 0.2)).toBeCloseTo(0.02);
    expect(swingDelay(2, 0.1, 0.2)).toBe(0);
  });

  it('speeds the tunnel music up with the scroll, within bounds', () => {
    expect(tunnelTempo(2.2)).toBe(1);
    expect(tunnelTempo(2.8)).toBeCloseTo(2.8 / 2.2);
    expect(tunnelTempo(10)).toBe(1.35);
    expect(tunnelTempo(0)).toBe(1);
  });
});

describe('sound effects', () => {
  it('give landed blows a hit or a heavy thump', () => {
    const hit: SimEvent = { type: 'hit', target: 3, damage: 4, heavy: false };
    expect(sfxForSim(hit)).toBe('hit');
    expect(sfxForSim({ ...hit, heavy: true })).toBe('heavy');
  });

  it('sound the big moments', () => {
    expect(sfxForSim({ type: 'reinforcements', by: 7 })).toBe('alarm');
    expect(sfxForSim({ type: 'panel', kind: 'manager', last: true })).toBe('sting');
    expect(sfxForSim({ type: 'hired' })).toBe('fanfare');
  });

  it('chime a clean clear in the tunnel, so it never sounds like a crash', () => {
    const passed: TunnelEvent = { type: 'cleared-hazard', kind: 'hurdle' };
    expect(sfxForTunnel(passed)).toBe('clear');
    expect(sfxForTunnel({ type: 'crash', kind: 'hurdle' })).toBe('crash');
    expect(sfxForTunnel({ type: 'cleared', retries: 0 })).toBe('fanfare');
  });
});
