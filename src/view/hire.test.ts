import { describe, expect, it } from 'vitest';
import { SCREEN_W } from '../sim/constants';
import {
  builtInDays,
  CONTACT_URL,
  creditLine,
  CV_URL,
  cycle,
  displayUrl,
  hireOptions,
  menuSlotXs,
  menuTouch,
  optionHint,
  optionText,
  titleOptions,
  type HireOption,
} from './hire';
import { CELL_W, hasGlyph, textWidth } from './pixel-font';

/** The options sit on one row with a cell of air between them. */
function menuRow(options: readonly HireOption[], selected: number): string {
  return options.map((option, i) => optionText(option.label, i === selected)).join(' ');
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
      { kind: 'play' },
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
    expect(optionHint({ kind: 'play' })).toBe('back to the street');
  });

  it('fits every line of the card on screen in the pixel font', () => {
    for (const cvLive of [true, false]) {
      for (const options of [hireOptions(cvLive), titleOptions(cvLive)]) {
        for (let i = 0; i < options.length; i++) fits(menuRow(options, i));
      }
      for (const { action } of hireOptions(cvLive)) fits(optionHint(action));
    }
    fits(creditLine(30));
  });
});

describe('the title menu', () => {
  it('puts START first so start still just starts, then the same links as the HIRED card', () => {
    for (const cvLive of [true, false]) {
      const [start, ...links] = titleOptions(cvLive);
      expect(start).toEqual({ label: 'START', action: { kind: 'play' } });
      expect(links).toEqual(hireOptions(cvLive).filter((o) => o.action.kind === 'link'));
    }
  });
});

describe('a menu row', () => {
  const labels = titleOptions(true).map((o) => o.label);

  it('is centred on screen', () => {
    const xs = menuSlotXs(labels);
    const last = labels.length - 1;
    const right = (xs[last] ?? 0) + textWidth(optionText(labels[last] ?? '', false));
    expect(Math.abs((xs[0] ?? 0) - (SCREEN_W - right))).toBeLessThanOrEqual(1);
  });

  it('starts each slot one cell after the one before it ends', () => {
    const xs = menuSlotXs(labels);
    for (let i = 1; i < labels.length; i++) {
      const before = optionText(labels[i - 1] ?? '', false);
      expect((xs[i] ?? 0) - (xs[i - 1] ?? 0)).toBe((before.length + 1) * CELL_W);
    }
  });
});

describe('a touch on a menu', () => {
  it('picks the chosen option from any action button, wherever the option is', () => {
    for (const button of ['attack', 'jump', 'special']) {
      expect(menuTouch(button, false)).toBe('pick');
      expect(menuTouch(button, true)).toBe('pick');
    }
  });

  it('picks the option under it, even inside the stick zone', () => {
    expect(menuTouch(undefined, true)).toBe('slot');
    expect(menuTouch('stick', true)).toBe('slot');
  });

  it('leaves the stick and the order pill to the pad, so the stick can move the cursor', () => {
    expect(menuTouch('stick', false)).toBe('pad');
    expect(menuTouch('order', false)).toBe('pad');
  });

  it('counts anywhere else as a tap on the screen', () => {
    expect(menuTouch(undefined, false)).toBe('screen');
  });
});

describe('a link on screen', () => {
  it('drops the scheme and the trailing slash', () => {
    expect(displayUrl(CV_URL)).toBe('immatt.com/cv');
    expect(displayUrl(CONTACT_URL)).toBe('immatt.com/contact');
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
