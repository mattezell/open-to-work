import { describe, expect, it } from 'vitest';
import { KINDS } from '../sim/fighters';
import { NO_INPUT } from '../sim/input';
import { EMPTY_STAGE } from '../sim/test-helpers';
import { createWorld, spawnFighter, step, type World } from '../sim/world';
import {
  bossOf,
  clearedBanner,
  closingTime,
  fighterAlpha,
  GHOST_ALPHA,
  isWaitingPanelist,
  panelBanner,
  towerRetry,
} from './stage-view';

function panelWorld(): World {
  const world = createWorld(EMPTY_STAGE, 1, { sidekick: false });
  spawnFighter(world, 'screener', 260, 10);
  spawnFighter(world, 'techlead', 268, 28);
  spawnFighter(world, 'manager', 276, 46);
  step(world, [NO_INPUT]);
  return world;
}

describe('the tower view rules', () => {
  it('puts the hot seat on the boss bar, moving down the panel as each one is beaten', () => {
    const world = panelWorld();
    expect(bossOf(world)?.kind).toBe('screener');
    const screener = world.fighters.find((f) => f.kind === 'screener');
    if (screener) screener.hp = 0;
    expect(bossOf(world)?.kind).toBe('techlead');
  });

  it('still names a street boss where there is no panel', () => {
    const world = createWorld(EMPTY_STAGE, 1, { sidekick: false });
    spawnFighter(world, 'takehome', 200, 20);
    expect(bossOf(world)?.kind).toBe('takehome');
  });

  it('numbers the rounds and calls out the final one', () => {
    expect(panelBanner('screener', false)).toBe('ROUND 1\n\nTHE SCREENER');
    expect(panelBanner('techlead', false)).toBe('ROUND 2\n\nTHE TECH LEAD');
    expect(panelBanner('manager', true)).toBe('FINAL ROUND\n\nTHE HIRING MANAGER');
  });

  it('prompts the close only when the last interviewer is nearly beaten', () => {
    const world = panelWorld();
    const [screener, techlead, manager] = ['screener', 'techlead', 'manager'].map((kind) =>
      world.fighters.find((f) => f.kind === kind),
    );
    if (!screener || !techlead || !manager) throw new Error('panel missing');
    screener.hp = 1;
    expect(closingTime(world)).toBe(false);
    screener.hp = 0;
    techlead.hp = 0;
    expect(closingTime(world)).toBe(false);
    manager.hp = Math.floor(KINDS.manager.maxHp / 4);
    expect(closingTime(world)).toBe(true);
  });

  it('greys out panelists waiting their turn, but never the hot seat or the beaten', () => {
    const world = panelWorld();
    const waiting = world.fighters.filter(isWaitingPanelist).map((f) => f.kind);
    expect(waiting).toEqual(['techlead', 'manager']);
  });

  it('fades a ghosted enemy and flickers it back just before it returns', () => {
    const world = createWorld(EMPTY_STAGE, 1, { sidekick: false });
    const ghoster = spawnFighter(world, 'ghoster', 200, 20);
    expect(fighterAlpha(ghoster)).toBe(1);
    ghoster.ghost = 60;
    expect(fighterAlpha(ghoster)).toBe(GHOST_ALPHA);
    ghoster.ghost = 5;
    expect(fighterAlpha(ghoster)).toBeGreaterThan(GHOST_ALPHA);
    expect(fighterAlpha(ghoster)).toBeLessThan(1);
  });

  it('retries the tower at full health with the score Matt arrived with', () => {
    expect(towerRetry({ hp: 40, score: 12_000, directive: 'guard' })).toEqual({
      hp: KINDS.matt.maxHp,
      score: 12_000,
      directive: 'guard',
    });
  });

  it('extends the offer at the top of the tower, and points at the tunnel from the street', () => {
    expect(clearedBanner('tower', 'press enter')).toMatch(/^OFFER EXTENDED/);
    expect(clearedBanner('street', 'press enter')).toMatch(/take-home tunnel/);
  });
});
