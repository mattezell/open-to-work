import { describe, expect, it } from 'vitest';
import { TICK_HZ } from '../sim/constants';
import { botInput } from '../sim/bot';
import { STAGE_1, STAGE_3 } from '../sim/stage';
import { createWorld, step } from '../sim/world';
import { input } from '../sim/input';
import { duel, run, tapAttack } from '../sim/test-helpers';
import { poseFor, SHEETS } from './animation';

function frameCount(kind: keyof typeof SHEETS, sheet: string): number | undefined {
  const sheets: Record<string, { frames: number }> = SHEETS[kind];
  return sheets[sheet]?.frames;
}

describe('poseFor', () => {
  it.each([STAGE_1, STAGE_3])(
    'only ever names a sheet and frame that exist ($id bot runs)',
    (stage) => {
      for (const seed of [1, 2, 3]) {
        const world = createWorld(stage, seed);
        while (world.status === 'playing' && world.tick < 180 * TICK_HZ) {
          step(world, [botInput(world)]);
          for (const f of world.fighters) {
            const pose = poseFor(f);
            const frames = frameCount(f.kind, pose.sheet);
            expect(frames, `${f.kind} has no ${pose.sheet} sheet`).toBeDefined();
            expect(pose.frame).toBeGreaterThanOrEqual(0);
            expect(pose.frame).toBeLessThan(frames ?? 0);
          }
        }
      }
    },
  );

  it('alternates hands through the jab chain', () => {
    const { world, matt } = duel();
    tapAttack(world);
    run(world, 2);
    expect(poseFor(matt)).toEqual({ sheet: 'jab', frame: 1 });
    run(world, 6);
    tapAttack(world);
    run(world, 3);
    expect(matt.attack).toBe('jab2');
    expect(poseFor(matt)).toEqual({ sheet: 'jab', frame: 3 });
  });

  it('shows the flying frame while knocked into the air and the lying frame once grounded', () => {
    const { world, matt } = duel();
    matt.state = 'knockdown';
    matt.stateTick = 0;
    matt.y = 10;
    matt.vy = 1;
    expect(poseFor(matt).frame).toBe(0);
    run(world, 40);
    expect(matt.y).toBe(0);
    expect(poseFor(matt)).toEqual({ sheet: 'knockdown', frame: 1 });
  });

  it('shows the kick frame for a jump kick', () => {
    const { world, matt } = duel();
    step(world, [input({ jump: true })]);
    run(world, 6);
    tapAttack(world);
    expect(poseFor(matt)).toEqual({ sheet: 'jump', frame: 3 });
  });
});
