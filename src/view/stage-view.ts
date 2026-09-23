import type { Carry, StageId } from '../sim/campaign';
import { KINDS, type FighterKind } from '../sim/fighters';
import { hotSeat, PANEL_ORDER } from '../sim/panel';
import { STAGE_1, STAGE_3, type StageDef } from '../sim/stage';
import type { Fighter, World } from '../sim/world';

/**
 * What the brawler scene needs to know about each stage it plays, kept free
 * of Phaser so the rules are testable. The tunnel has its own scene.
 */
export type BrawlStage = Exclude<StageId, 'tunnel'>;

export const BRAWL_STAGES: Readonly<Record<BrawlStage, StageDef>> = {
  street: STAGE_1,
  tower: STAGE_3,
};

export const BOSS_NAMES: Partial<Record<FighterKind, string>> = {
  takehome: 'THE UNPAID TAKE HOME',
  screener: 'THE SCREENER',
  techlead: 'THE TECH LEAD',
  manager: 'THE HIRING MANAGER',
};

/** The last interviewer is on the ropes below this share of its health. */
export const CLOSING_SHARE = 0.25;
/** A ghosted enemy is a faint outline until it is about to come back. */
export const GHOST_ALPHA = 0.15;
export const RETURNING_ALPHA = 0.6;
const RETURNING_TICKS = 20;

/** Whose bar runs along the bottom: the hot seat in the tower, else any boss still standing. */
export function bossOf(world: World): Fighter | undefined {
  return hotSeat(world) ?? world.fighters.find((f) => BOSS_NAMES[f.kind] && f.state !== 'dead');
}

export function panelBanner(kind: FighterKind, last: boolean): string {
  const name = BOSS_NAMES[kind] ?? '';
  return last ? `FINAL ROUND\n\n${name}` : `ROUND ${PANEL_ORDER.indexOf(kind) + 1}\n\n${name}`;
}

/** True while the only interviewer left is nearly beaten. */
export function closingTime(world: World): boolean {
  const seat = hotSeat(world);
  if (!seat) return false;
  const waiting = world.fighters.filter((f) => KINDS[f.kind].seated && f.hp > 0).length;
  return waiting === 1 && seat.hp / KINDS[seat.kind].maxHp <= CLOSING_SHARE;
}

/** How opaque to draw a fighter: ghosted enemies fade out, and flicker back just before they return. */
export function fighterAlpha(f: Fighter): number {
  if (f.ghost === 0 || KINDS[f.kind].seated) return 1;
  return f.ghost > RETURNING_TICKS ? GHOST_ALPHA : RETURNING_ALPHA;
}

/** A panelist waiting its turn sits greyed out behind its desk. */
export function isWaitingPanelist(f: Fighter): boolean {
  return KINDS[f.kind].seated === true && f.ghost > 0 && f.hp > 0;
}

/** A loss in the tower retries the tower at full health, keeping what Matt walked in with. */
export function towerRetry(arrival: Carry): Carry {
  return { ...arrival, hp: KINDS.matt.maxHp };
}

export function clearedBanner(stage: BrawlStage, hint: string): string {
  return stage === 'tower'
    ? `OFFER EXTENDED\n\n${hint}`
    : `STAGE CLEAR\n\nnext: the take-home tunnel\n\n${hint}`;
}
