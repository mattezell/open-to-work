import { describe, expect, it } from 'vitest';
import { SCREEN_W } from '../sim/constants';
import type { FighterKind } from '../sim/fighters';
import { EMPTY_STAGE } from '../sim/test-helpers';
import { createWorld, spawnFighter, type World } from '../sim/world';
import { ROSTER } from './help';
import { CARD_TICKS, CARDED, NameCards } from './name-cards';
import { hasGlyph, textWidth } from './pixel-font';

function arena(): World {
  return createWorld(EMPTY_STAGE, 1, { sidekick: false });
}

function stepFor(cards: NameCards, world: World, ticks: number): void {
  for (let i = 0; i < ticks; i++) cards.step(world.fighters, world.cameraX);
}

describe('name cards', () => {
  it('names an enemy once it is fully on screen, then drops the card', () => {
    const world = arena();
    const cards = new NameCards(new Set());
    const ats = spawnFighter(world, 'ats', SCREEN_W + 4, 20);
    cards.step(world.fighters, world.cameraX);
    expect(cards.current).toBeNull();
    ats.x = SCREEN_W - 40;
    cards.step(world.fighters, world.cameraX);
    expect(cards.current).toMatchObject({ id: ats.id, entry: { kind: 'ats' } });
    stepFor(cards, world, CARD_TICKS);
    expect(cards.current).toBeNull();
  });

  it('introduces each kind only once, even across runs sharing the seen set', () => {
    const seen = new Set<FighterKind>();
    const world = arena();
    const cards = new NameCards(seen);
    spawnFighter(world, 'ats', 200, 20);
    stepFor(cards, world, CARD_TICKS + 1);
    spawnFighter(world, 'ats', 240, 30);
    cards.step(world.fighters, world.cameraX);
    expect(cards.current).toBeNull();

    const retry = arena();
    const again = new NameCards(seen);
    spawnFighter(retry, 'ats', 200, 20);
    again.step(retry.fighters, retry.cameraX);
    expect(again.current).toBeNull();
  });

  it('queues newcomers that arrive together and names them in turn', () => {
    const world = arena();
    const cards = new NameCards(new Set());
    spawnFighter(world, 'ats', 200, 20);
    spawnFighter(world, 'spam', 240, 30);
    cards.step(world.fighters, world.cameraX);
    expect(cards.current?.entry.kind).toBe('ats');
    stepFor(cards, world, CARD_TICKS);
    expect(cards.current?.entry.kind).toBe('spam');
  });

  it('drops a card when its enemy goes down, and skips a queued one already down', () => {
    const world = arena();
    const cards = new NameCards(new Set());
    const ats = spawnFighter(world, 'ats', 200, 20);
    const spam = spawnFighter(world, 'spam', 240, 30);
    cards.step(world.fighters, world.cameraX);
    ats.state = 'dead';
    spam.state = 'dead';
    cards.step(world.fighters, world.cameraX);
    expect(cards.current).toBeNull();
  });

  it('leaves the panel to its round banners', () => {
    expect(CARDED.has('screener')).toBe(false);
    expect(CARDED.has('manager')).toBe(false);
    expect([...CARDED.keys()]).toEqual(['ats', 'spam', 'takehome', 'golem', 'ghoster']);
  });

  it('gives every enemy a pitch that fits a card in the pixel font', () => {
    for (const entry of ROSTER) {
      expect(entry.tagline, entry.kind).not.toBe('');
      for (const line of [entry.head, entry.tagline]) {
        expect(textWidth(line), line).toBeLessThanOrEqual(SCREEN_W / 2 + 40);
        expect([...line].every(hasGlyph), line).toBe(true);
      }
    }
  });
});
