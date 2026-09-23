import { describe, expect, it } from 'vitest';
import { SCREEN_W } from '../sim/constants';
import {
  builtInDays,
  CONTACT_URL,
  creditLine,
  CV_URL,
  cycle,
  hireOptions,
  optionHint,
  optionText,
} from './hire';
import { hasGlyph, textWidth } from './pixel-font';

/** The options sit on one row with a cell of air between them. */
function menuRow(cvLive: boolean, selected: number): string {
  return hireOptions(cvLive)
    .map((option, i) => optionText(option.label, i === selected))
    .join(' ');
}

function fits(line: string): void {
  expect(textWidth(line), line).toBeLessThanOrEqual(SCREEN_W - 8);
  expect([...line].every(hasGlyph), line).toBe(true);
}

describe('the hire menu', () => {
  it('offers the CV first once it is live, then contact, then another go', () => {
    expect(hireOptions(true).map((o) => o.action)).toEqual([
      { kind: 'link', url: CV_URL },
      { kind: 'link', url: CONTACT_URL },
      { kind: 'again' },
    ]);
  });

  it('falls back to the contact page alone while the CV is not live', () => {
    expect(hireOptions(false).map((o) => o.label)).toEqual(['CONTACT', 'PLAY AGAIN']);
  });

  it('links only to immatt.com over https', () => {
    for (const url of [CV_URL, CONTACT_URL]) expect(url).toMatch(/^https:\/\/immatt\.com\/\w+\/$/);
  });

  it('keeps every slot the same width whether chosen or not', () => {
    for (const { label } of hireOptions(true)) {
      expect(optionText(label, true)).toHaveLength(optionText(label, false).length);
    }
  });

  it('wraps the cursor round both ends', () => {
    expect(cycle(0, -1, 3)).toBe(2);
    expect(cycle(2, 1, 3)).toBe(0);
    expect(cycle(1, 1, 3)).toBe(2);
  });

  it('says where each option goes', () => {
    expect(optionHint({ kind: 'link', url: CONTACT_URL })).toBe(
      'opens immatt.com/contact in a new tab',
    );
    expect(optionHint({ kind: 'again' })).toBe('back to the street');
  });

  it('fits every line of the card on screen in the pixel font', () => {
    for (const cvLive of [true, false]) {
      for (let i = 0; i < hireOptions(cvLive).length; i++) fits(menuRow(cvLive, i));
      for (const { action } of hireOptions(cvLive)) fits(optionHint(action));
    }
    fits(creditLine(30));
  });
});

describe('the credit', () => {
  it('counts calendar days from the first commit to the last, both ends included', () => {
    expect(builtInDays('2026-09-22', '2026-09-22')).toBe(1);
    expect(builtInDays('2026-09-22', '2026-09-25')).toBe(4);
    expect(builtInDays('2026-09-28', '2026-10-02')).toBe(5);
  });

  it('refuses dates that are not calendar days in order', () => {
    expect(() => builtInDays('2026-09-25', '2026-09-22')).toThrow();
    expect(() => builtInDays('soon', '2026-09-22')).toThrow();
  });

  it('reads naturally for one day or several', () => {
    expect(creditLine(1)).toBe('Built in 1 day by Matt Ezell + Claude');
    expect(creditLine(4)).toBe('Built in 4 days by Matt Ezell + Claude');
    expect(creditLine(null)).toBe('Built by Matt Ezell + Claude');
  });
});
