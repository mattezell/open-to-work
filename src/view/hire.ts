import { SCREEN_W } from '../sim/constants';
import { CELL_W } from './pixel-font';

/**
 * The real Matt's CV and contact page, offered on the HIRED card, on the
 * title screen and in help, so hiring him is never gated behind beating
 * the game. Phaser-free so the copy and the menus are tested.
 */
export const CV_URL = 'https://immatt.com/cv/';
export const CONTACT_URL = 'https://immatt.com/contact/';
/**
 * Whether immatt.com/cv/ is the CV. Until that page was deployed the site
 * answered /cv/ with its home page (200, not 404), so the card offered the
 * contact page alone. Live since 2026-09-23 (its own body, "CV" title);
 * recheck against the home page before every deploy.
 */
export const CV_LIVE = true;

export type HireAction = { kind: 'link'; url: string } | { kind: 'play' };

export interface HireOption {
  label: string;
  action: HireAction;
}

/** CV (once it is live) then contact. */
export function hireLinks(cvLive: boolean): HireOption[] {
  return [
    ...(cvLive ? [{ label: 'CV', action: { kind: 'link', url: CV_URL } } as const] : []),
    { label: 'CONTACT', action: { kind: 'link', url: CONTACT_URL } },
  ];
}

/** The menu under "Hire the real Matt", the hire links first so they are the default. */
export function hireOptions(cvLive: boolean): HireOption[] {
  return [...hireLinks(cvLive), { label: 'PLAY AGAIN', action: { kind: 'play' } }];
}

/** The title screen's menu: START first, so start still just starts. */
export function titleOptions(cvLive: boolean): HireOption[] {
  return [{ label: 'START', action: { kind: 'play' } }, ...hireLinks(cvLive)];
}

/** A menu slot: the chosen option between arrows, the rest padded to the same width. */
export function optionText(label: string, selected: boolean): string {
  return selected ? `> ${label} <` : `  ${label}  `;
}

/**
 * Where each slot of a one-row menu starts, the row centred on screen with a
 * cell of air between slots. Slots keep their width chosen or not, so
 * nothing shifts as the cursor moves.
 */
export function menuSlotXs(labels: readonly string[]): number[] {
  const texts = labels.map((label) => optionText(label, false));
  let x = Math.round((SCREEN_W - (texts.join(' ').length * CELL_W - 1)) / 2);
  return texts.map((text) => {
    const left = x;
    x += (text.length + 1) * CELL_W;
    return left;
  });
}

/** Move the menu cursor `step` places, wrapping round at either end. */
export function cycle(index: number, step: number, count: number): number {
  return (((index + step) % count) + count) % count;
}

/** The line under the menu: where a link goes, or what playing again does. */
export function optionHint(action: HireAction): string {
  if (action.kind === 'play') return 'back to the street';
  return `opens ${displayUrl(action.url)} in a new tab`;
}

/** A link as it reads on screen: `https://immatt.com/cv/` is immatt.com/cv. */
export function displayUrl(url: string): string {
  return url.replace(/^https:\/\//, '').replace(/\/$/, '');
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Calendar days from the first commit to the last, counting both ends. */
export function builtInDays(firstCommit: string, lastCommit: string): number {
  const days = (Date.parse(lastCommit) - Date.parse(firstCommit)) / DAY_MS;
  if (!Number.isInteger(days) || days < 0) {
    throw new Error(`bad commit dates: ${firstCommit} to ${lastCommit}`);
  }
  return days + 1;
}

/** The credit, with the build's length when the build knew its commit dates. */
export function creditLine(days: number | null): string {
  if (days === null) return 'Built by Matt Ezell + Claude';
  return `Built in ${days} ${days === 1 ? 'day' : 'days'} by Matt Ezell + Claude`;
}
