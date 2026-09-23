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

export interface StageDef {
  id: string;
  length: number;
  waves: WaveDef[];
}

/** Stage 1, The Job Board. M1 blockout: ATS Bots only. */
export const STAGE_1: StageDef = {
  id: 'job-board',
  length: 1600,
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
        { kind: 'ats', side: 'left', z: 40, delay: 30 },
        { kind: 'ats', side: 'right', z: 50, delay: 90 },
      ],
    },
    {
      triggerX: 1240,
      spawns: [
        { kind: 'ats', side: 'left', z: 16, delay: 0 },
        { kind: 'ats', side: 'right', z: 30, delay: 0 },
        { kind: 'ats', side: 'right', z: 52, delay: 60 },
        { kind: 'ats', side: 'left', z: 44, delay: 120 },
      ],
    },
  ],
};
