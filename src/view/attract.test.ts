import { describe, expect, it } from 'vitest';
import { createBot, SHARP } from '../sim/bot';
import { SCREEN_W } from '../sim/constants';
import type { FighterKind } from '../sim/fighters';
import { input, NO_INPUT } from '../sim/input';
import { STAGE_1 } from '../sim/stage';
import { createWorld, players, step } from '../sim/world';
import {
  attractScreen,
  DEMO_SEED,
  DEMO_TICKS,
  ROSTER_ENTRY_TICKS,
  startHint,
  startPressed,
  TITLE_TICKS,
} from './attract';
import { ROSTER } from './help';
import { NameCards } from './name-cards';
import { hasGlyph, textWidth } from './pixel-font';

describe('the attract loop', () => {
  it('shows the title, then each enemy in turn, then the demo', () => {
    expect(attractScreen(0)).toEqual({ screen: 'title' });
    expect(attractScreen(TITLE_TICKS - 1)).toEqual({ screen: 'title' });
    expect(attractScreen(TITLE_TICKS)).toEqual({ screen: 'roster', index: 0 });
    expect(attractScreen(TITLE_TICKS + ROSTER_ENTRY_TICKS)).toEqual({ screen: 'roster', index: 1 });
    const rosterEnd = TITLE_TICKS + ROSTER.length * ROSTER_ENTRY_TICKS;
    expect(attractScreen(rosterEnd - 1)).toEqual({ screen: 'roster', index: ROSTER.length - 1 });
    expect(attractScreen(rosterEnd)).toEqual({ screen: 'demo' });
  });

  it('starts the demo after about twenty seconds of nobody pressing start', () => {
    const idle = TITLE_TICKS + ROSTER.length * ROSTER_ENTRY_TICKS;
    expect(idle / 60).toBeGreaterThanOrEqual(18);
    expect(idle / 60).toBeLessThanOrEqual(24);
  });

  it('starts on a button, not on the stick', () => {
    expect(startPressed(input({ attack: true }))).toBe(true);
    expect(startPressed(input({ jump: true }))).toBe(true);
    expect(startPressed(input({ right: true, up: true }))).toBe(false);
    expect(startPressed(NO_INPUT)).toBe(false);
  });

  it('fits its hints on screen in the pixel font', () => {
    for (const hint of [startHint(false), startHint(true)]) {
      expect(textWidth(hint)).toBeLessThanOrEqual(SCREEN_W - 16);
      expect([...hint].every(hasGlyph)).toBe(true);
    }
  });
});

describe('the demo', () => {
  it('shows the bot surviving the whole demo and meeting the street crew', () => {
    const world = createWorld(STAGE_1, DEMO_SEED);
    const bot = createBot(SHARP);
    const seen = new Set<FighterKind>();
    const cards = new NameCards(seen);
    while (world.tick < DEMO_TICKS && world.status === 'playing') {
      step(world, [bot(world)]);
      cards.step(world.fighters, world.cameraX);
    }
    expect(world.status).toBe('playing');
    expect(players(world)[0]?.hp ?? 0).toBeGreaterThan(0);
    expect([...seen]).toEqual(expect.arrayContaining(['ats', 'spam']));
  });
});
