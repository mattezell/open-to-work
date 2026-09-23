import { describe, expect, it } from 'vitest';
import {
  canRequest,
  initialFullscreenState,
  MAX_AUTO_REFUSALS,
  shouldAutoEnter,
  showFullPill,
  type FullscreenState,
} from './fullscreen';

const fresh = (patch: Partial<FullscreenState> = {}): FullscreenState => ({
  ...initialFullscreenState(true),
  ...patch,
});

describe('shouldAutoEnter', () => {
  it('asks on the first touch of a fresh page', () => {
    expect(shouldAutoEnter(fresh())).toBe(true);
  });

  it('keeps asking after a refusal, so one early refusal does not end it', () => {
    expect(shouldAutoEnter(fresh({ refusals: 1 }))).toBe(true);
  });

  it('gives up after repeated refusals', () => {
    expect(shouldAutoEnter(fresh({ refusals: MAX_AUTO_REFUSALS }))).toBe(false);
  });

  it('does not stack a second request on one in flight', () => {
    expect(shouldAutoEnter(fresh({ pending: true }))).toBe(false);
  });

  it('never drags a player back in once they have left fullscreen', () => {
    expect(shouldAutoEnter(fresh({ entered: true, isFullscreen: false }))).toBe(false);
  });

  it('does nothing already fullscreen or without the API', () => {
    expect(shouldAutoEnter(fresh({ isFullscreen: true }))).toBe(false);
    expect(shouldAutoEnter(initialFullscreenState(false))).toBe(false);
  });
});

describe('canRequest', () => {
  it('lets the FULL pill ask after the automatic asks gave up or were left', () => {
    expect(canRequest(fresh({ refusals: MAX_AUTO_REFUSALS }))).toBe(true);
    expect(canRequest(fresh({ entered: true }))).toBe(true);
  });

  it('refuses while fullscreen, while a request is in flight, or without the API', () => {
    expect(canRequest(fresh({ isFullscreen: true }))).toBe(false);
    expect(canRequest(fresh({ pending: true }))).toBe(false);
    expect(canRequest(initialFullscreenState(false))).toBe(false);
  });
});

describe('showFullPill', () => {
  it('shows only where fullscreen exists and the page is windowed', () => {
    expect(showFullPill(fresh())).toBe(true);
    expect(showFullPill(fresh({ isFullscreen: true }))).toBe(false);
    expect(showFullPill(initialFullscreenState(false))).toBe(false);
  });
});
