import { describe, expect, it } from 'vitest';
import { SCREEN_W } from '../sim/constants';
import { BACKDROPS, HIRING_SIGN, layerSpan, signCentres, type BackdropStage } from './backdrops';
import { hasGlyph, textWidth } from './pixel-font';

const manifest = Object.values(
  import.meta.glob<string>('../../tools/assets.yaml', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
)[0];
const stages = Object.keys(BACKDROPS) as BackdropStage[];
const allLayers = stages.flatMap((stage) => BACKDROPS[stage]);

describe('the backdrop layers', () => {
  it('gives every stage at least two layers', () => {
    for (const stage of stages) expect(BACKDROPS[stage].length, stage).toBeGreaterThanOrEqual(2);
  });

  it('draws each stage far to near, the farther layers moving slower', () => {
    for (const stage of stages) {
      const layers = BACKDROPS[stage];
      for (let i = 1; i < layers.length; i++) {
        const [far, near] = [layers[i - 1], layers[i]];
        expect(near?.scroll, stage).toBeGreaterThan(far?.scroll ?? Infinity);
        expect(near?.depth, stage).toBeGreaterThan(far?.depth ?? Infinity);
      }
    }
  });

  it('keeps every layer behind the fighters and scrolling no faster than the floor', () => {
    for (const { key, scroll, depth } of allLayers) {
      expect(depth, key).toBeLessThan(0);
      expect(scroll, key).toBeGreaterThan(0);
      expect(scroll, key).toBeLessThanOrEqual(1);
    }
  });

  it('gives every layer its own texture', () => {
    const keys = allLayers.map((l) => l.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('loads only files the asset manifest generates', () => {
    expect(manifest).toBeTruthy();
    for (const { path } of allLayers) expect(manifest).toContain(`out: public/${path}\n`);
  });
});

describe('a layer span', () => {
  it('is one screen for a layer fixed to the sky', () => {
    expect(layerSpan(2200, 0)).toBe(SCREEN_W);
  });

  it('is the whole stage for a layer that moves with the floor', () => {
    expect(layerSpan(2200, 1)).toBe(2200);
  });

  it('covers the part of the stage a slow layer scrolls past', () => {
    expect(layerSpan(2200, 0.5)).toBe(SCREEN_W + 940);
  });

  it('is never less than a screen, even for a stage that fits on one', () => {
    expect(layerSpan(SCREEN_W, 0.4)).toBe(SCREEN_W);
  });
});

describe('the hiring sign', () => {
  it('is drawn in glyphs the pixel font has', () => {
    for (const line of HIRING_SIGN.lines) expect([...line].every(hasGlyph), line).toBe(true);
  });

  it('hangs on a street layer that moves with the floor', () => {
    const layer = BACKDROPS.street.find((l) => l.key === HIRING_SIGN.layer);
    expect(layer?.scroll).toBe(1);
  });

  it('fits across one shop, well inside a tile', () => {
    const width = Math.max(...HIRING_SIGN.lines.map((line) => textWidth(line)));
    expect(HIRING_SIGN.centreX - width / 2).toBeGreaterThan(-4);
    expect(width).toBeLessThan(100);
  });

  it('repeats once per tile along the whole span', () => {
    expect(signCentres(700, 221, 36)).toEqual([36, 257, 478, 699]);
    expect(signCentres(30, 221, 36)).toEqual([]);
  });
});
