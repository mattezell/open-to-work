import { describe, expect, it } from 'vitest';
import { cancelsBrowserGesture } from './browser-gestures';

describe('cancelsBrowserGesture', () => {
  it('cancels a touch on the background in touch play, so a double tap cannot zoom', () => {
    expect(cancelsBrowserGesture(true, false)).toBe(true);
  });

  it('leaves touches on the canvas to Phaser', () => {
    expect(cancelsBrowserGesture(true, true)).toBe(false);
  });

  it('leaves the page alone when not playing by touch', () => {
    expect(cancelsBrowserGesture(false, false)).toBe(false);
    expect(cancelsBrowserGesture(false, true)).toBe(false);
  });
});
