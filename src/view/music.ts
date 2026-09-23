import type { SimEvent } from '../sim/world';
import type { TunnelEvent } from '../sim/tunnel';

/**
 * The score and the sound map, kept free of WebAudio so they are testable.
 * Every track is two bars of sixteenth-note steps written as note names, so
 * a riff reads like a tracker pattern.
 */
export type TrackId = 'street' | 'tunnel' | 'tower' | 'ending';

export interface Track {
  bpm: number;
  /** How far the off-beat sixteenths lag, as a share of a step: the funk. */
  swing: number;
  /** MIDI note per step, or null for a rest. */
  bass: readonly (number | null)[];
  lead: readonly (number | null)[];
  kick: readonly boolean[];
  snare: readonly boolean[];
  hat: readonly boolean[];
}

export const STEPS = 32;

const NOTE_OFFSETS: Readonly<Record<string, number>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/** MIDI number of a note name such as `A4` or `F#2`; A4 is 69. */
export function midi(name: string): number {
  const match = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  const offset = match?.[1] === undefined ? undefined : NOTE_OFFSETS[match[1]];
  if (!match || offset === undefined) throw new Error(`not a note: ${name}`);
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  return 12 * (Number(match[3]) + 1) + offset + accidental;
}

export function hz(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

/** A pattern of whitespace-separated steps; `.` rests, `|` is a bar line for the reader. */
export function notes(pattern: string): (number | null)[] {
  return tokens(pattern).map((t) => (t === '.' ? null : midi(t)));
}

/** A drum line: `x` hits, `.` rests. */
export function hits(pattern: string): boolean[] {
  return tokens(pattern).map((t) => t === 'x');
}

function tokens(pattern: string): string[] {
  return pattern.split(/\s+/).filter((t) => t !== '' && t !== '|');
}

const FUNK_KICK = hits('x . . . . . x . x . . . . . . . | x . . . . . x . x . . x . . . .');
const FUNK_SNARE = hits('. . . . x . . . . . . . x . . x | . . . . x . . . . . . . x . x .');
const FUNK_HAT = hits('x . x . x . x . x . x . x . x . | x . x . x . x . x . x . x . x x');

export const TRACKS: Readonly<Record<TrackId, Track>> = {
  // The street: a ToeJam-and-Earl bass line in E, laid back.
  street: {
    bpm: 104,
    swing: 0.18,
    bass: notes(
      'E2 . E3 E2 . . G2 . A2 . . A2 B2 . D3 . | E2 . E3 E2 . . G2 . A2 . G2 . E2 . D2 .',
    ),
    lead: notes('. . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .'),
    kick: FUNK_KICK,
    snare: FUNK_SNARE,
    hat: FUNK_HAT,
  },
  // The tunnel: straight eighths and four on the floor; the tempo rides the scroll speed.
  tunnel: {
    bpm: 128,
    swing: 0,
    bass: notes(
      'A1 . A2 . A1 . A2 . A1 . A2 . G2 . E2 . | F1 . F2 . F1 . F2 . G1 . G2 . B1 . G2 .',
    ),
    lead: notes('. . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .'),
    kick: hits('x . . . x . . . x . . . x . . . | x . . . x . . . x . . . x . . .'),
    snare: hits('. . . . x . . . . . . . x . . . | . . . . x . . . . . . . x . x x'),
    hat: hits('x x x x x x x x x x x x x x x x | x x x x x x x x x x x x x x x x'),
  },
  // The tower: D minor, tighter, with a lead line that climbs like an elevator.
  tower: {
    bpm: 112,
    swing: 0.1,
    bass: notes('D2 . . D2 . . F2 . D2 . . D2 C3 . A2 . | D2 . . D2 . . F2 . G2 . . G2 F2 . E2 .'),
    lead: notes('D4 . . . F4 . . . A4 . . . G4 . F4 . | D4 . . . F4 . . . C5 . . . A4 . E4 .'),
    kick: hits('x . . x . . x . . . x . . . . . | x . . x . . x . . . x . . x . .'),
    snare: FUNK_SNARE,
    hat: hits('x . x . x . x . x . x . x . x x | x . x . x . x . x . x . x . x x'),
  },
  // The ending: C major, the same groove, finally in a good mood.
  ending: {
    bpm: 100,
    swing: 0.18,
    bass: notes('C2 . C3 . G2 . C3 . F2 . F3 . G2 . G3 . | A2 . A3 . E2 . E3 . F2 . G2 . C3 . . .'),
    lead: notes('E4 . G4 . C5 . . . A4 . G4 . . . E4 . | F4 . A4 . G4 . E4 . D4 . . . C4 . . .'),
    kick: FUNK_KICK,
    snare: FUNK_SNARE,
    hat: FUNK_HAT,
  },
};

export function secondsPerStep(bpm: number): number {
  return 60 / bpm / 4;
}

/** When a step sounds relative to its grid slot: odd sixteenths lag by the swing. */
export function swingDelay(step: number, stepSeconds: number, swing: number): number {
  return step % 2 === 1 ? stepSeconds * swing : 0;
}

/** The first tunnel section's speed; the music speeds up with the scroll from there. */
const TUNNEL_BASE_SPEED = 2.2;
const TUNNEL_MAX_TEMPO = 1.35;

export function tunnelTempo(speed: number): number {
  return Math.min(TUNNEL_MAX_TEMPO, Math.max(1, speed / TUNNEL_BASE_SPEED));
}

export type Sfx =
  | 'hit'
  | 'heavy'
  | 'ko'
  | 'whiff'
  | 'order'
  | 'pickup'
  | 'reboot'
  | 'rebooted'
  | 'intercept'
  | 'alarm'
  | 'poof'
  | 'sting'
  | 'fanfare'
  | 'crash'
  | 'shield'
  | 'checkpoint'
  | 'retry'
  | 'call';

export function sfxForSim(event: SimEvent): Sfx | null {
  switch (event.type) {
    case 'hit':
      return event.heavy ? 'heavy' : 'hit';
    case 'ko':
      return 'ko';
    case 'whiff':
      return 'whiff';
    case 'order':
      return 'order';
    case 'pickup':
      return 'pickup';
    case 'reboot':
      return 'reboot';
    case 'rebooted':
      return 'rebooted';
    case 'intercept':
      return 'intercept';
    case 'reinforcements':
      return 'alarm';
    case 'ghosted':
      return 'poof';
    case 'panel':
      return 'sting';
    case 'hired':
      return 'fanfare';
  }
}

export function sfxForTunnel(event: TunnelEvent): Sfx | null {
  switch (event.type) {
    case 'crash':
      return 'crash';
    case 'shield':
      return 'shield';
    case 'call':
      return 'call';
    case 'checkpoint':
      return 'checkpoint';
    case 'retry':
      return 'retry';
    case 'order':
      return 'order';
    case 'cleared':
      return 'fanfare';
    case 'cleared-hazard':
      return null;
  }
}
