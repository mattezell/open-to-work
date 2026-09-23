import type { FighterKind } from './fighters';

export interface SpawnDef {
  kind: FighterKind;
  side: 'left' | 'right';
  z: number;
  /** Ticks after the wave starts before this enemy enters. */
  delay: number;
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
