import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../sim/input';
import { STICK_RADIUS, stickDirection, TouchState } from './touch-state';

describe('stickDirection', () => {
  it('is centred inside the dead zone', () => {
    expect(stickDirection(5, -5)).toEqual({ left: false, right: false, up: false, down: false });
  });

  it('snaps a slightly off-axis push to the axis', () => {
    expect(stickDirection(40, 12)).toEqual({ left: false, right: true, up: false, down: false });
    expect(stickDirection(-8, -40)).toEqual({ left: false, right: false, up: true, down: false });
  });

  it('gives a diagonal only for a deliberate diagonal', () => {
    expect(stickDirection(30, 30)).toEqual({ left: false, right: true, up: false, down: true });
    expect(stickDirection(-30, -30)).toEqual({ left: true, right: false, up: true, down: false });
  });

  it('covers all 8 sectors exactly once around the circle', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      seen.add(JSON.stringify(stickDirection(Math.cos(angle) * 40, Math.sin(angle) * 40)));
    }
    expect(seen.size).toBe(8);
  });
});

describe('TouchState', () => {
  it('moves with one thumb and attacks with the other', () => {
    const touch = new TouchState();
    touch.stickStart(1, 100, 300);
    touch.stickMove(1, 150, 300);
    touch.buttonDown(2, 'attack');
    expect(touch.snapshot()).toMatchObject({ right: true, attack: true });
    touch.release(2);
    expect(touch.snapshot()).toMatchObject({ right: true, attack: false });
    touch.release(1);
    expect(touch.snapshot()).toEqual(NO_INPUT);
  });

  it('latches a button tap released before the next snapshot, for one snapshot', () => {
    const touch = new TouchState();
    touch.buttonDown(3, 'jump');
    touch.release(3);
    expect(touch.snapshot().jump).toBe(true);
    expect(touch.snapshot().jump).toBe(false);
  });

  it('ignores moves from a pointer that does not own the stick', () => {
    const touch = new TouchState();
    touch.stickStart(1, 0, 0);
    touch.stickMove(9, 100, 0);
    expect(touch.snapshot().right).toBe(false);
  });

  it('clamps the drawn knob to the stick radius', () => {
    const touch = new TouchState();
    touch.stickStart(1, 0, 0);
    touch.stickMove(1, 300, 0);
    expect(touch.stickVisual()).toEqual({ x: 0, y: 0, knobX: STICK_RADIUS, knobY: 0 });
  });

  it('latches an order tap like any other button', () => {
    const touch = new TouchState();
    touch.buttonDown(4, 'order');
    touch.release(4);
    expect(touch.snapshot().order).toBe(true);
    expect(touch.snapshot().order).toBe(false);
  });

  it('forgets everything on releaseAll', () => {
    const touch = new TouchState();
    touch.stickStart(1, 0, 0);
    touch.stickMove(1, 0, 60);
    touch.buttonDown(2, 'special');
    touch.releaseAll();
    expect(touch.snapshot()).toEqual(NO_INPUT);
  });
});
