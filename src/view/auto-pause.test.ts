import { describe, expect, it } from 'vitest';
import { shouldAutoPause } from './auto-pause';

describe('shouldAutoPause', () => {
  it('pauses when the window loses focus on a keyboard, so alt-tab costs nothing', () => {
    expect(shouldAutoPause('blur', false)).toBe(true);
  });

  it('ignores a lost focus while playing by touch, which in-app browsers send mid-drag', () => {
    expect(shouldAutoPause('blur', true)).toBe(false);
  });

  it('pauses when the page is hidden, whatever the input', () => {
    expect(shouldAutoPause('hidden', false)).toBe(true);
    expect(shouldAutoPause('hidden', true)).toBe(true);
  });
});
