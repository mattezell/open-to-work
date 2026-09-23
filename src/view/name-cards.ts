import { SCREEN_W, TICK_HZ } from '../sim/constants';
import { KINDS, type FighterKind } from '../sim/fighters';
import { PANEL_ORDER } from '../sim/panel';
import type { Fighter } from '../sim/world';
import { ROSTER, type RosterEntry } from './help';

/** How long a name card stays up over its enemy. */
export const CARD_TICKS = Math.round(2.5 * TICK_HZ);

/** Enemies introduced by a card as they walk on. The panel gets its round banners instead. */
export const CARDED: ReadonlyMap<FighterKind, RosterEntry> = new Map(
  ROSTER.filter((entry) => !PANEL_ORDER.includes(entry.kind)).map((entry) => [entry.kind, entry]),
);

export interface NameCard {
  entry: RosterEntry;
  /** The fighter the card hangs over. */
  id: number;
  ticks: number;
}

/** Fully inside the screen, so the card never names someone still off the edge. */
function onScreen(f: Fighter, cameraX: number): boolean {
  const half = KINDS[f.kind].halfWidth;
  return f.x - half >= cameraX && f.x + half <= cameraX + SCREEN_W;
}

/**
 * Final Fight's introductions: the first time each kind of enemy walks on,
 * its name and pitch hang over it for a moment. Several newcomers at once
 * queue up and are named one after another. `seen` is shared across runs
 * by the caller, so a retry does not introduce everyone again.
 */
export class NameCards {
  current: NameCard | null = null;
  private readonly queue: { entry: RosterEntry; id: number }[] = [];

  constructor(private readonly seen: Set<FighterKind>) {}

  step(fighters: readonly Fighter[], cameraX: number): void {
    for (const f of fighters) {
      const entry = CARDED.get(f.kind);
      if (!entry || this.seen.has(f.kind) || f.state === 'dead' || !onScreen(f, cameraX)) continue;
      this.seen.add(f.kind);
      this.queue.push({ entry, id: f.id });
    }
    const standing = (id: number): boolean =>
      fighters.some((f) => f.id === id && f.state !== 'dead');
    if (this.current) {
      this.current.ticks--;
      if (this.current.ticks <= 0 || !standing(this.current.id)) this.current = null;
    }
    while (!this.current && this.queue.length > 0) {
      const next = this.queue.shift();
      if (next && standing(next.id)) this.current = { ...next, ticks: CARD_TICKS };
    }
  }
}
