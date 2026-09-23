import { describe, expect, it } from 'vitest';
import { SCREEN_W } from '../sim/constants';
import bank from './barks.json';
import {
  CELL_H,
  CELL_W,
  CHARSET,
  GLYPH_H,
  GLYPH_W,
  glyphCell,
  glyphRows,
  hasGlyph,
  splitBanner,
  TEXTURE_H,
  TEXTURE_W,
  textWidth,
  TITLE_SCALE,
} from './pixel-font';
import { BOSS_NAMES, clearedBanner, panelBanner, TOWER_INTRO } from './stage-view';
import { TUNNEL_CLEARED, TUNNEL_INTRO } from './tunnel-view';

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

const BANNERS = [
  TOWER_INTRO,
  TUNNEL_INTRO,
  `${TUNNEL_CLEARED}\n\npress enter`,
  clearedBanner('street', 'press enter'),
  clearedBanner('tower', 'press enter'),
  panelBanner('screener', false),
  panelBanner('techlead', false),
  panelBanner('manager', true),
  'POSITION FILLED\n\npress enter',
  'REWIND\n\nback to the checkpoint',
];

describe('the glyph table', () => {
  it('draws every printable ASCII character on an 8 by 5 grid of ink and paper', () => {
    expect(CHARSET).toHaveLength(95);
    for (const char of CHARSET) {
      expect(hasGlyph(char), char).toBe(true);
      const rows = glyphRows(char);
      expect(rows, char).toHaveLength(GLYPH_H);
      for (const row of rows) expect(row, char).toMatch(new RegExp(`^[#.]{${GLYPH_W}}$`));
    }
  });

  it('gives every character its own shape, so no glyph was pasted twice', () => {
    const shapes = new Map<string, string>();
    for (const char of CHARSET) {
      const shape = glyphRows(char).join('');
      expect(shapes.get(shape), `${char} repeats ${shapes.get(shape) ?? ''}`).toBeUndefined();
      shapes.set(shape, char);
    }
  });

  it('keeps the descender row for letters that hang below the line', () => {
    for (const char of 'gjpqy') expect(glyphRows(char)[7], char).toContain('#');
    for (const char of 'ABCabc019') expect(glyphRows(char)[7], char).toBe('.....');
  });

  it('covers every character TOKEN can say', () => {
    const missing = new Set(
      strings(bank)
        .flatMap((line) => [...line])
        .filter((char) => !hasGlyph(char)),
    );
    expect([...missing]).toEqual([]);
  });

  it('draws unknown characters as a blank rather than failing', () => {
    const accented = String.fromCharCode(0xe9);
    expect(hasGlyph(accented)).toBe(false);
    expect(glyphRows(accented)).toEqual(glyphRows(' '));
  });
});

describe('the font texture', () => {
  it('lays the charset out sixteen cells to a row', () => {
    expect(glyphCell(' ')).toEqual({ x: 0, y: 0 });
    expect(glyphCell('0')).toEqual({ x: 0, y: CELL_H });
    expect(glyphCell('A')).toEqual({ x: CELL_W, y: 2 * CELL_H });
    expect(glyphCell('~')).toEqual({ x: 14 * CELL_W, y: 5 * CELL_H });
    expect(TEXTURE_W).toBe(16 * CELL_W);
    expect(TEXTURE_H).toBe(6 * CELL_H);
  });
});

describe('text layout', () => {
  it('measures the longest line in whole pixels', () => {
    expect(textWidth('')).toBe(0);
    expect(textWidth('A')).toBe(GLYPH_W);
    expect(textWidth('AB\nABCD')).toBe(4 * CELL_W - 1);
    expect(textWidth('AB', 2)).toBe(2 * (2 * CELL_W - 1));
  });

  it('splits a banner into a title and the body under the blank line', () => {
    expect(splitBanner('ROUND 1\n\nTHE SCREENER')).toEqual({
      title: 'ROUND 1',
      body: 'THE SCREENER',
    });
    expect(splitBanner('CHECKPOINT')).toEqual({ title: 'CHECKPOINT', body: '' });
    expect(splitBanner('')).toEqual({ title: '', body: '' });
  });

  it('fits every banner on screen with a margin', () => {
    for (const banner of BANNERS) {
      const { title, body } = splitBanner(banner);
      expect(textWidth(title, TITLE_SCALE), title).toBeLessThanOrEqual(SCREEN_W - 16);
      expect(textWidth(body), body).toBeLessThanOrEqual(SCREEN_W - 16);
    }
  });

  it('fits every boss name beside its bar', () => {
    for (const name of Object.values(BOSS_NAMES)) {
      expect(textWidth(name), name).toBeLessThanOrEqual(SCREEN_W / 2);
    }
  });

  it('fits every bark in a bubble between the screen edges', () => {
    for (const line of strings(bank)) {
      expect(textWidth(line), line).toBeLessThanOrEqual(SCREEN_W - 8);
    }
  });
});
