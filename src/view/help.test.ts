import { describe, expect, it } from 'vitest';
import { SCREEN_W } from '../sim/constants';
import { KINDS, type FighterKind } from '../sim/fighters';
import { DIRECTIVE_LABELS } from './barks';
import { HELP_CODES, KEY_BINDINGS, PAUSE_CODES } from './controls';
import {
  BODY_BOTTOM,
  BODY_TOP,
  helpPages,
  hirePage,
  keyLabel,
  layoutPage,
  layoutTabs,
  pauseFooter,
  ROSTER,
  turnPage,
  wrap,
} from './help';
import { CV_LIVE, displayUrl, hireLinks } from './hire';
import { CELL_H, hasGlyph, textWidth } from './pixel-font';

const EVERY_PAGE = [...helpPages(false), ...helpPages(true)];

describe('key labels', () => {
  it('names keys the way the keycaps do', () => {
    expect(keyLabel('KeyJ')).toBe('J');
    expect(keyLabel('ArrowUp')).toBe('UP');
    expect(keyLabel('Escape')).toBe('ESC');
    expect(keyLabel('Slash')).toBe('?');
    expect(keyLabel('Space')).toBe('SPACE');
  });
});

describe('the controls page', () => {
  it('names every key the game listens to on a keyboard', () => {
    const text =
      helpPages(false)[0]
        ?.rows.map((row) => row.text)
        .join(' ') ?? '';
    const { left, right, up, down, ...buttons } = KEY_BINDINGS;
    const codes = [...Object.values(buttons).flat(), ...PAUSE_CODES, ...HELP_CODES];
    for (const code of codes) {
      expect(text, code).toMatch(new RegExp(`(^|[^A-Z])${keyLabel(code).replace('?', '\\?')}`));
    }
    // Movement reads as one row: the arrows, then the second binding of each direction.
    const wasd = [up, left, down, right].map((keys) => keyLabel(keys[1] ?? '')).join('');
    expect(wasd).toBe('WASD');
    expect(text).toContain('ARROWS or WASD');
  });

  it('shows the pad instead of keys on a touch screen', () => {
    const heads = helpPages(true)[0]?.rows.map((row) => row.head);
    expect(heads).toEqual(expect.arrayContaining(['A', 'B', 'C', 'PAUSE']));
  });
});

describe('the orders page', () => {
  it('explains every order TOKEN can be given, by its HUD name', () => {
    const heads = helpPages(false)
      .find((page) => page.tab === 'ORDERS')
      ?.rows.map((r) => r.head);
    for (const label of Object.values(DIRECTIVE_LABELS)) expect(heads).toContain(label);
  });
});

describe('the roster', () => {
  it('introduces every enemy exactly once', () => {
    const enemies = (Object.keys(KINDS) as FighterKind[]).filter(
      (kind) => kind !== 'matt' && kind !== 'token',
    );
    expect(ROSTER.map((row) => row.kind).sort()).toEqual([...enemies].sort());
  });
});

describe('page layout', () => {
  it('fits every page between the tabs and the footer, inside the screen', () => {
    for (const page of EVERY_PAGE) {
      for (const line of layoutPage(page)) {
        expect(line.y, `${page.tab}: ${line.text}`).toBeGreaterThanOrEqual(BODY_TOP);
        expect(line.y + CELL_H, `${page.tab}: ${line.text}`).toBeLessThanOrEqual(BODY_BOTTOM);
        expect(line.x + textWidth(line.text), `${page.tab}: ${line.text}`).toBeLessThanOrEqual(
          SCREEN_W - 8,
        );
      }
    }
  });

  it('keeps short heads clear of the text beside them', () => {
    for (const page of EVERY_PAGE.filter((p) => p.layout === 'columns')) {
      const placed = layoutPage(page);
      const textX = Math.min(...placed.filter((l) => !l.head).map((l) => l.x));
      for (const head of placed.filter((l) => l.head)) {
        expect(head.x + textWidth(head.text), head.text).toBeLessThan(textX);
      }
    }
  });

  it('uses only characters the pixel font can draw', () => {
    const text = [
      ...EVERY_PAGE.flatMap((page) => [page.tab, ...page.rows.flatMap((r) => [r.head, r.text])]),
      pauseFooter(false),
      pauseFooter(true),
    ].join('');
    expect([...new Set([...text].filter((char) => !hasGlyph(char)))]).toEqual([]);
  });

  it('fits the tab strip and the footers across the screen', () => {
    const tabs = layoutTabs(helpPages(false).map((page) => page.tab));
    const last = tabs[tabs.length - 1];
    expect(tabs[0]?.x).toBeGreaterThanOrEqual(8);
    expect((last?.x ?? 0) + textWidth(last?.text ?? '')).toBeLessThanOrEqual(SCREEN_W - 8);
    for (const footer of [pauseFooter(false), pauseFooter(true)]) {
      expect(textWidth(footer)).toBeLessThanOrEqual(SCREEN_W - 16);
    }
  });
});

describe('the hire page', () => {
  it('is the last page, on keyboards and touch screens alike', () => {
    for (const touch of [false, true]) expect(helpPages(touch).at(-1)).toEqual(hirePage(CV_LIVE));
  });

  it('spells out every link the title and the HIRED card offer', () => {
    for (const cvLive of [true, false]) {
      const text = hirePage(cvLive).rows.map((row) => `${row.head} ${row.text}`);
      for (const { label, action } of hireLinks(cvLive)) {
        if (action.kind === 'link') expect(text).toContain(`${label} ${displayUrl(action.url)}`);
      }
    }
    expect(hirePage(false).rows.map((row) => row.head)).not.toContain('CV');
  });
});

describe('helpers', () => {
  it('wraps on word boundaries without losing words', () => {
    expect(wrap('one two three four', 9)).toEqual(['one two', 'three', 'four']);
    expect(wrap('unbreakableword x', 5)).toEqual(['unbreakableword', 'x']);
    expect(wrap('', 10)).toEqual([]);
  });

  it('turns pages round both ends', () => {
    expect(turnPage(0, 1, 5)).toBe(1);
    expect(turnPage(4, 1, 5)).toBe(0);
    expect(turnPage(0, -1, 5)).toBe(4);
  });
});
