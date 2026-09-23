/**
 * The call to action on the HIRED card: the real Matt's CV and contact
 * page, and another go. Phaser-free so the copy and the menu are tested.
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

export type HireAction = { kind: 'link'; url: string } | { kind: 'again' };

export interface HireOption {
  label: string;
  action: HireAction;
}

/** The menu under "Hire the real Matt", the hire links first so they are the default. */
export function hireOptions(cvLive: boolean): HireOption[] {
  const links: HireOption[] = [
    ...(cvLive ? [{ label: 'CV', action: { kind: 'link', url: CV_URL } } as const] : []),
    { label: 'CONTACT', action: { kind: 'link', url: CONTACT_URL } },
  ];
  return [...links, { label: 'PLAY AGAIN', action: { kind: 'again' } }];
}

/** A menu slot: the chosen option between arrows, the rest padded to the same width. */
export function optionText(label: string, selected: boolean): string {
  return selected ? `> ${label} <` : `  ${label}  `;
}

/** Move the menu cursor `step` places, wrapping round at either end. */
export function cycle(index: number, step: number, count: number): number {
  return (((index + step) % count) + count) % count;
}

/** The line under the menu: where a link goes, or what playing again does. */
export function optionHint(action: HireAction): string {
  if (action.kind === 'again') return 'back to the street';
  return `opens ${action.url.replace(/^https:\/\//, '').replace(/\/$/, '')} in a new tab`;
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
