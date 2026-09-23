import type { FighterKind } from './fighters';

export interface SpawnDef {
  kind: FighterKind;
  side: 'left' | 'right';
  z: number;
  /** Ticks after the wave starts before this enemy enters. */
  delay: number;
  /** Already on screen, this far in from the right edge, instead of walking in from `side`. */
  inset?: number;
}

export interface WaveDef {
  /** The wave starts when the lead player walks past this x. */
  triggerX: number;
  spawns: SpawnDef[];
}

export type PickupKind = 'coffee';

export interface PickupDef {
  kind: PickupKind;
  x: number;
  z: number;
}

export interface StageDef {
  id: string;
  length: number;
  waves: WaveDef[];
  /** Lying on the street from the start, waiting to be walked over. */
  pickups?: PickupDef[];
  /** Cleared the moment the last wave falls, with no walk to the end: the final boss. */
  endsOnLastWave?: boolean;
}

/**
 * Stage 1, The Job Board. ATS Bots to learn on, Spam Recruiters flinging
 * cards from range, and the Unpaid Take Home waiting at the end of the street.
 */
export const STAGE_1: StageDef = {
  id: 'job-board',
  length: 2200,
  waves: [
    {
      triggerX: 300,
      spawns: [
        { kind: 'ats', side: 'right', z: 20, delay: 0 },
        { kind: 'ats', side: 'right', z: 44, delay: 40 },
      ],
    },
    {
      triggerX: 760,
      spawns: [
        { kind: 'ats', side: 'right', z: 12, delay: 0 },
        { kind: 'spam', side: 'right', z: 50, delay: 30 },
        { kind: 'ats', side: 'left', z: 40, delay: 90 },
      ],
    },
    {
      triggerX: 1240,
      spawns: [
        { kind: 'ats', side: 'left', z: 16, delay: 0 },
        { kind: 'spam', side: 'right', z: 30, delay: 0 },
        { kind: 'ats', side: 'right', z: 52, delay: 60 },
        { kind: 'spam', side: 'left', z: 44, delay: 120 },
      ],
    },
    {
      triggerX: 1800,
      spawns: [{ kind: 'takehome', side: 'right', z: 32, delay: 0 }],
    },
  ],
  pickups: [
    { kind: 'coffee', x: 1100, z: 40 },
    { kind: 'coffee', x: 1700, z: 20 },
  ],
};

/**
 * Stage 3, The Interview Tower. LeetCode Golems that shrug off anything but
 * a knockdown, Ghosters that vanish when engaged, then the Panel at the top.
 * The stage ends the moment the last panelist is satisfied.
 */
export const STAGE_3: StageDef = {
  id: 'interview-tower',
  length: 1900,
  endsOnLastWave: true,
  waves: [
    {
      triggerX: 300,
      spawns: [
        { kind: 'golem', side: 'right', z: 28, delay: 0 },
        { kind: 'ats', side: 'left', z: 12, delay: 90 },
      ],
    },
    {
      triggerX: 700,
      spawns: [
        { kind: 'ghoster', side: 'right', z: 20, delay: 0 },
        { kind: 'ghoster', side: 'left', z: 44, delay: 60 },
      ],
    },
    {
      triggerX: 1100,
      spawns: [
        { kind: 'golem', side: 'right', z: 16, delay: 0 },
        { kind: 'ghoster', side: 'right', z: 44, delay: 40 },
        { kind: 'spam', side: 'left', z: 30, delay: 120 },
      ],
    },
    {
      triggerX: 1500,
      spawns: [
        // A diagonal from the front of the room to the back, one desk per lane and
        // far enough apart that each interviewer reads on its own.
        { kind: 'screener', side: 'right', z: 46, delay: 0, inset: 170 },
        { kind: 'techlead', side: 'right', z: 28, delay: 0, inset: 110 },
        { kind: 'manager', side: 'right', z: 10, delay: 0, inset: 50 },
      ],
    },
  ],
  // The lobby coffee sits on Matt's starting line: a battered arrival from the
  // tunnel gets topped up before the first Golem.
  pickups: [
    { kind: 'coffee', x: 180, z: 28 },
    { kind: 'coffee', x: 1000, z: 40 },
    { kind: 'coffee', x: 1440, z: 20 },
  ],
};
