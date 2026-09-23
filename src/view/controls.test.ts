import { describe, expect, it } from 'vitest';
import { input, NO_INPUT } from '../sim/input';
import { HeldKeys, keysToInput, mergeInputs } from './controls';

describe('keysToInput', () => {
  it('maps nothing held to no input', () => {
    expect(keysToInput(new Set())).toEqual(NO_INPUT);
  });

  it('accepts either binding for an action', () => {
    expect(keysToInput(new Set(['KeyA', 'KeyZ']))).toMatchObject({ left: true, attack: true });
    expect(keysToInput(new Set(['ArrowLeft', 'KeyJ']))).toMatchObject({ left: true, attack: true });
  });

  it('gives TOKEN orders on Q or Tab', () => {
    expect(keysToInput(new Set(['KeyQ'])).order).toBe(true);
    expect(keysToInput(new Set(['Tab'])).order).toBe(true);
    expect(mergeInputs(NO_INPUT, input({ order: true })).order).toBe(true);
  });

  it('cancels opposite directions', () => {
    const frame = keysToInput(new Set(['ArrowLeft', 'KeyD', 'ArrowUp']));
    expect(frame).toMatchObject({ left: false, right: false, up: true });
  });
});

describe('HeldKeys', () => {
  function fakeWindow() {
    const listeners = new Map<string, (e: KeyboardEvent) => void>();
    const target = {
      addEventListener: (type: string, fn: (e: KeyboardEvent) => void) => listeners.set(type, fn),
    } as unknown as Pick<Window, 'addEventListener'>;
    const fire = (type: string, code = ''): void =>
      listeners.get(type)?.({ code, preventDefault: () => undefined } as KeyboardEvent);
    return { target, fire };
  }

  it('keeps a tap released before the next snapshot for exactly one snapshot', () => {
    const { target, fire } = fakeWindow();
    const keys = new HeldKeys(target);
    fire('keydown', 'KeyJ');
    fire('keyup', 'KeyJ');
    expect(keys.snapshot().attack).toBe(true);
    expect(keys.snapshot().attack).toBe(false);
  });

  it('reports a held key until it is released, and nothing after blur', () => {
    const { target, fire } = fakeWindow();
    const keys = new HeldKeys(target);
    fire('keydown', 'ArrowRight');
    expect(keys.snapshot().right).toBe(true);
    expect(keys.snapshot().right).toBe(true);
    fire('blur');
    expect(keys.snapshot().right).toBe(false);
  });
});

describe('mergeInputs', () => {
  it('ORs buttons and directions across devices', () => {
    const merged = mergeInputs(input({ right: true }), input({ attack: true }));
    expect(merged).toEqual(input({ right: true, attack: true }));
  });

  it('cancels opposite directions coming from different devices', () => {
    expect(mergeInputs(input({ left: true, up: true }), input({ right: true }))).toEqual(
      input({ up: true }),
    );
  });

  it('is no input with no sources', () => {
    expect(mergeInputs()).toEqual(NO_INPUT);
  });
});
