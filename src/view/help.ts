import { SCREEN_H, SCREEN_W } from '../sim/constants';
import type { FighterKind } from '../sim/fighters';
import { HELP_CODES, KEY_BINDINGS, PAUSE_CODES } from './controls';
import { CELL_H, CELL_W } from './pixel-font';
import { BOSS_NAMES } from './stage-view';

/**
 * What the pause overlay says: the controls, TOKEN's orders and who is who on
 * each stage, laid out in whole game pixels. Kept free of Phaser so the copy
 * and the layout are testable; the title screen's roster reuses `ROSTER`.
 */
export interface HelpRow {
  head: string;
  text: string;
  /** Set on the rows that introduce an enemy. */
  kind?: FighterKind;
}

export interface HelpPage {
  tab: string;
  /** Columns put the text beside a short head; stacked puts it under a long one. */
  layout: 'columns' | 'stacked';
  rows: readonly HelpRow[];
}

export interface PlacedLine {
  x: number;
  y: number;
  text: string;
  head: boolean;
}

export const HEAD_X = 12;
const RIGHT_MARGIN = 12;
const COLUMN_TEXT_X = 84;
const STACKED_TEXT_X = 20;
/** Low enough that the touch pills along the top edge never cover the title. */
export const TITLE_Y = 22;
export const TABS_Y = 42;
export const BODY_TOP = 56;
export const FOOTER_Y = SCREEN_H - 14;
/** The lowest pixel a page's body may reach. */
export const BODY_BOTTOM = FOOTER_Y - 4;
/** Space between one row and the next, on top of the line height. */
const ROW_GAP = 3;
const TAB_GAP = 2;

/** How a KeyboardEvent.code reads on screen: `KeyJ` is J, `ArrowUp` is UP, `Slash` is ?. */
export function keyLabel(code: string): string {
  const named: Readonly<Record<string, string>> = {
    Escape: 'ESC',
    Slash: '?',
    Space: 'SPACE',
    Tab: 'TAB',
    Enter: 'ENTER',
  };
  return named[code] ?? code.replace(/^Key|^Arrow/, '').toUpperCase();
}

/** `A`, `A or B`, `A, B or C`. */
function either(codes: readonly string[]): string {
  const labels = codes.map(keyLabel);
  const last = labels.pop() ?? '';
  return labels.length === 0 ? last : `${labels.join(', ')} or ${last}`;
}

const WASD = (['up', 'left', 'down', 'right'] as const)
  .map((action) => keyLabel(KEY_BINDINGS[action][1] ?? ''))
  .join('');

const KEYBOARD_CONTROLS: readonly HelpRow[] = [
  { head: 'MOVE', text: `ARROWS or ${WASD}. Up and down walk into the screen.` },
  { head: 'ATTACK', text: `${either(KEY_BINDINGS.attack)}. Tap three times: jab, jab, haymaker.` },
  { head: 'JUMP', text: `${either(KEY_BINDINGS.jump)}. Attack in the air to jump kick.` },
  {
    head: 'SPECIAL',
    text: `${either(KEY_BINDINGS.special)}. A spinning clear; costs a little hp.`,
  },
  { head: 'ORDER', text: `${either(KEY_BINDINGS.order)}. Gives TOKEN its next order.` },
  { head: 'PAUSE', text: either(PAUSE_CODES) },
  { head: 'HELP', text: either(HELP_CODES) },
  { head: 'SOUND', text: 'M' },
];

const TOUCH_CONTROLS: readonly HelpRow[] = [
  { head: 'MOVE', text: 'The stick: put a thumb down anywhere on the left half.' },
  { head: 'B', text: 'Attack. Tap three times: jab, jab, haymaker.' },
  { head: 'C', text: 'Jump. B in the air to jump kick.' },
  { head: 'A', text: 'Special. A spinning clear; costs a little hp.' },
  { head: 'ORDER', text: 'The cyan pill gives TOKEN its next order.' },
  { head: 'PAUSE', text: 'The PAUSE pill at the top.' },
  { head: 'SOUND', text: 'The SOUND pill at the top.' },
];

const ORDERS: HelpPage = {
  tab: 'ORDERS',
  layout: 'columns',
  rows: [
    {
      head: 'GO WILD',
      text: 'Big hits on the biggest crowd; sometimes swings at an enemy that left. Tunnel: one call in four is wrong.',
    },
    {
      head: 'FOCUS',
      text: 'Double damage on the enemy you last hit. Tunnel: every call is right.',
    },
    {
      head: 'GUARD',
      text: 'Stays by you and takes your hits at half damage. Tunnel: takes the first crash of each section.',
    },
    {
      head: 'REBOOT',
      text: 'Knocked out, TOKEN is back in five seconds at half hp. Losing TOKEN never ends the run.',
    },
  ],
};

const name = (kind: FighterKind): string => BOSS_NAMES[kind] ?? kind;

const STREET: HelpPage = {
  tab: 'STREET',
  layout: 'stacked',
  rows: [
    {
      head: 'ATS BOT',
      kind: 'ats',
      text: 'Walks up and shreds your resume. Hit it first: it winds up before it swings.',
    },
    {
      head: 'SPAM RECRUITER',
      kind: 'spam',
      text: 'Keeps its distance and throws business cards along its line. Step off the line or jump.',
    },
    {
      head: name('takehome'),
      kind: 'takehome',
      text: 'The boss. Its slam knocks you down: hit it between slams. Low on hp it calls in scope creep.',
    },
    { head: 'COFFEE', text: 'Heals 30 when Matt is hurt.' },
  ],
};

const TUNNEL: HelpPage = {
  tab: 'TUNNEL',
  layout: 'stacked',
  rows: [
    { head: 'STEER', text: 'Up and down change lane. Jump clears the hurdles.' },
    { head: 'WALLS', text: 'Steer round them: the red floor shows which lanes a wall closes.' },
    {
      head: "TOKEN'S CALLS",
      text: 'TOKEN calls the next hazard. On Go wild it is sometimes wrong.',
    },
    {
      head: 'CRASHES',
      text: 'Cost 15 hp. At 0 hp the run rewinds to the last checkpoint; retries come off the bonus.',
    },
  ],
};

const TOWER: HelpPage = {
  tab: 'TOWER',
  layout: 'stacked',
  rows: [
    {
      head: 'LEETCODE GOLEM',
      kind: 'golem',
      text: 'Jabs barely chip it. Only the haymaker, the jump kick or the special really hurt.',
    },
    {
      head: 'GHOSTER',
      kind: 'ghoster',
      text: 'Takes a hit, vanishes and comes back behind you. It flickers just before.',
    },
    {
      head: name('screener'),
      kind: 'screener',
      text: 'One interviewer at a time. Throws forms along its line: step off it.',
    },
    {
      head: name('techlead'),
      kind: 'techlead',
      text: 'Sends a wall of sticky notes across the whole floor: jump it.',
    },
    {
      head: name('manager'),
      kind: 'manager',
      text: 'Delegates fast folders. Close the deal for the offer.',
    },
  ],
};

/** The pages in order; the first one shows the controls for the device in use. */
export function helpPages(touch: boolean): readonly HelpPage[] {
  const controls: HelpPage = {
    tab: 'CONTROLS',
    layout: 'columns',
    rows: touch ? TOUCH_CONTROLS : KEYBOARD_CONTROLS,
  };
  return [controls, ORDERS, STREET, TUNNEL, TOWER];
}

/** Every enemy, in the order the run meets them. */
export const ROSTER: readonly (HelpRow & { kind: FighterKind })[] = [STREET, TOWER].flatMap(
  (page) => page.rows.flatMap((row) => (row.kind ? [{ ...row, kind: row.kind }] : [])),
);

/** The page `delta` steps on from `index`, wrapping round both ends. */
export function turnPage(index: number, delta: number, count: number): number {
  return (((index + delta) % count) + count) % count;
}

export function pauseFooter(touch: boolean): string {
  return touch ? 'tap: next page   PAUSE: resume' : '< > page   H next   ESC resume';
}

/** Greedy word wrap to `width` characters; a word longer than a line gets a line of its own. */
export function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter((w) => w !== '')) {
    if (line === '') line = word;
    else if (line.length + 1 + word.length <= width) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

function charsFrom(x: number): number {
  return Math.floor((SCREEN_W - RIGHT_MARGIN - x + 1) / CELL_W);
}

/** Where every line of a page's body sits on screen. */
export function layoutPage(page: HelpPage): PlacedLine[] {
  const placed: PlacedLine[] = [];
  let y = BODY_TOP;
  for (const row of page.rows) {
    placed.push({ x: HEAD_X, y, text: row.head, head: true });
    const textX = page.layout === 'columns' ? COLUMN_TEXT_X : STACKED_TEXT_X;
    if (page.layout === 'stacked') y += CELL_H;
    for (const line of wrap(row.text, charsFrom(textX))) {
      placed.push({ x: textX, y, text: line, head: false });
      y += CELL_H;
    }
    y += ROW_GAP;
  }
  return placed;
}

/** The tab strip: each tab's left edge, spaced evenly and centred. */
export function layoutTabs(tabs: readonly string[]): { x: number; text: string }[] {
  const widths = tabs.map((tab) => tab.length * CELL_W - 1);
  const gap = TAB_GAP * CELL_W;
  const total = widths.reduce((sum, w) => sum + w, 0) + gap * (tabs.length - 1);
  let x = Math.round((SCREEN_W - total) / 2);
  return tabs.map((text, i) => {
    const placed = { x, text };
    x += (widths[i] ?? 0) + gap;
    return placed;
  });
}
