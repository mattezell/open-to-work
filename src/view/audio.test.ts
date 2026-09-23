import { describe, expect, it } from 'vitest';
import { loadMuted, MUTE_KEY, saveMuted } from './audio';

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  };
}

function refusingStorage(): Storage {
  throw new Error('SecurityError: storage is disabled');
}

describe('the mute setting', () => {
  it('starts with sound on', () => {
    expect(loadMuted(memoryStorage)).toBe(false);
  });

  it('survives a reload', () => {
    const store = memoryStorage();
    expect(saveMuted(() => store, true)).toBe(true);
    expect(store.getItem(MUTE_KEY)).toBe('1');
    expect(loadMuted(() => store)).toBe(true);
    saveMuted(() => store, false);
    expect(loadMuted(() => store)).toBe(false);
  });

  it('falls back to sound on when the browser refuses storage', () => {
    expect(loadMuted(refusingStorage)).toBe(false);
    expect(saveMuted(refusingStorage, true)).toBe(false);
    expect(loadMuted(() => undefined)).toBe(false);
    expect(saveMuted(() => undefined, true)).toBe(false);
  });
});
