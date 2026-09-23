import type { Directive } from '../sim/sidekick';
import type { SimEvent } from '../sim/world';

/** What the HUD calls each order. */
export const DIRECTIVE_LABELS: Readonly<Record<Directive, string>> = {
  wild: 'GO WILD',
  focus: 'FOCUS',
  guard: 'GUARD',
};

/**
 * Placeholder lines until the generated bark bank lands (M5). Short enough to
 * fit over TOKEN's head at 8px.
 */
const LINES = {
  wild: ['GOING WILD.', 'No plan. Only vibes.', 'Unleashing chaos mode.'],
  focus: ['Target locked.', 'Focusing. Like a cover letter.', 'On your mark.'],
  guard: ['I got you.', 'Shields up.', 'Nobody touches the candidate.'],
  intercept: ['Not today, ATS.', 'Blocked. Like my resume.', 'Took that one for you.'],
  whiff: ['...where did it go?', 'Hallucinated that one.', 'Confidently wrong.'],
  reboot: ['Rebooting...', 'Turning myself off and on.', 'brb, updating'],
  rebooted: ['Back online.', 'Updates installed.', 'Where were we?'],
  pickup: [
    'Caffeinated. Allegedly.',
    'Hydrate. Caffeinate. Iterate.',
    'Free coffee. Great culture.',
  ],
  reinforcements: [
    'Scope creep incoming!',
    'They added requirements.',
    'Now it is a two-week project.',
  ],
  ko: ['Rejected.', 'Per my last email.', 'Moving forward with other candidates.'],
} as const satisfies Record<string, readonly string[]>;

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
    case 'ko':
      return event.by === tokenId ? { text: choose(LINES.ko), urgent: false } : null;
  }
}
