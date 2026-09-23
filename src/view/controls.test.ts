import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../sim/input';
import { HeldKeys, keysToInput } from './controls';

describe('keysToInput', () => {
  it('maps nothing held to no input', () => {
    expect(keysToInput(new Set())).toEqual(NO_INPUT);
  });

  it('accepts either binding for an action', () => {
    expect(keysToInput(new Set(['KeyA', 'KeyZ']))).toMatchObject({ left: true, attack: true });
    expect(keysToInput(new Set(['ArrowLeft', 'KeyJ']))).toMatchObject({ left: true, attack: true });
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
