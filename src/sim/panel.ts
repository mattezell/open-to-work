import { KINDS, type FighterKind } from './fighters';
import type { Fighter, World } from './world';

/**
 * The Panel at the top of the tower: three interviewers at their desks, who
 * take Matt one at a time. Only the one in the hot seat can be hit; the
 * others wait out of play. Each one beaten stays slumped in its chair, and
 * the last one beaten is the offer.
 */
export const PANEL_ORDER: readonly FighterKind[] = ['screener', 'techlead', 'manager'];
/** Players stop this far short of the nearest desk, so nobody walks round behind the panel. */
export const DESK_GAP = 22;
/** The final hit freezes the room a moment longer than any other. */
const OFFER_HITSTOP = 30;

function panelOf(world: World): Fighter[] {
  return world.fighters
    .filter((f) => KINDS[f.kind].seated)
    .sort((a, b) => PANEL_ORDER.indexOf(a.kind) - PANEL_ORDER.indexOf(b.kind));
}

/** The panelist whose turn it is, if the Panel is sitting. */
export function hotSeat(world: World): Fighter | undefined {
  return panelOf(world).find((f) => f.hp > 0);
}

export function updatePanel(world: World): void {
  const panel = panelOf(world);
  if (panel.length === 0) return;
  const onSpot = panel.find((f) => f.hp > 0);
  for (const f of panel) {
    if (f === onSpot && f.ghost > 0) {
      f.ghost = 0;
      const last = panel.filter((p) => p.hp > 0).length === 1;
      world.events.push({ type: 'panel', kind: f.kind, last });
    } else if (f !== onSpot) {
      f.ghost = f.hp > 0 ? 1 : 0;
    }
  }

  const deskLine = Math.min(...panel.map((f) => f.x)) - DESK_GAP;
  for (const p of world.fighters) {
    if (p.team === 'player') p.x = Math.min(p.x, deskLine);
  }

  const satisfied = world.events.some((e) => e.type === 'ko' && panel.some((f) => f.id === e.id));
  if (satisfied && !onSpot) {
    world.hitstop = Math.max(world.hitstop, OFFER_HITSTOP);
    world.events.push({ type: 'hired' });
  }
}
