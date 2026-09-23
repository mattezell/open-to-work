import bank from './barks.json';
import type { Directive } from '../sim/sidekick';
import type { Call, TunnelEvent } from '../sim/tunnel';
import type { SimEvent } from '../sim/world';

/** What the HUD calls each order. */
export const DIRECTIVE_LABELS: Readonly<Record<Directive, string>> = {
  wild: 'GO WILD',
  focus: 'FOCUS',
  guard: 'GUARD',
};

/**
 * TOKEN's lines per moment, generated ahead of time by the local model
 * (`tools/genbarks.py`, spec in `tools/barks.yaml`) and reviewed before
 * commit. The hand-written seeds lead each list.
 */
const LINES = bank.lines;

export interface Bark {
  text: string;
  /** Orders the player gave always show; chatter waits its turn. */
  urgent: boolean;
}

/**
 * The line TOKEN says for a sim event, if any. `pick` varies the line; the
 * view passes the tick so repeats rotate without touching the sim's RNG.
 */
export function barkFor(event: SimEvent, tokenId: number | undefined, pick: number): Bark | null {
  const choose = (lines: readonly string[]): string => lines[pick % lines.length] ?? '';
  switch (event.type) {
    case 'order':
      return { text: choose(LINES[event.directive]), urgent: true };
    case 'intercept':
    case 'whiff':
    case 'reboot':
    case 'rebooted':
      return { text: choose(LINES[event.type]), urgent: false };
    case 'pickup':
      return { text: choose(LINES.pickup), urgent: false };
    case 'reinforcements':
      return { text: choose(LINES.reinforcements), urgent: true };
    case 'hit':
      return null;
    case 'ko':
      return event.by === tokenId ? { text: choose(LINES.ko), urgent: false } : null;
    case 'ghosted':
      return { text: choose(LINES.ghosted), urgent: false };
    case 'panel':
      return { text: choose(event.last ? LINES.finalRound : LINES.panel), urgent: true };
    case 'hired':
      return { text: choose(LINES.hired), urgent: true };
  }
}

/** TOKEN calls every hazard the same way, right or wrong. */
const CALL_SHOUTS: Readonly<Record<Call, string>> = {
  jump: 'JUMP!',
  high: 'GO HIGH!',
  middle: 'MIDDLE!',
  low: 'GO LOW!',
};

/** The line TOKEN says for a tunnel event, if any. Calls cut in over everything. */
export function tunnelBarkFor(event: TunnelEvent, pick: number): Bark | null {
  const choose = (lines: readonly string[]): string => lines[pick % lines.length] ?? '';
  switch (event.type) {
    case 'call':
      return { text: CALL_SHOUTS[event.call], urgent: true };
    case 'order':
      return { text: choose(LINES[event.directive]), urgent: true };
    case 'shield':
    case 'retry':
      return { text: choose(LINES[event.type]), urgent: true };
    case 'crash':
    case 'checkpoint':
      return { text: choose(LINES[event.type]), urgent: false };
    case 'cleared-hazard':
    case 'cleared':
      return null;
  }
}
