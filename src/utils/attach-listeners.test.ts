import { describe, expect, it, vi } from 'vitest';

import { attachListeners } from './attach-listeners.js';

function fakeTarget(): EventTarget {
  return document.createElement('div');
}

describe('attachListeners', () => {
  it('registers every spec on its target', () => {
    const target = fakeTarget();
    const addSpy = vi.spyOn(target, 'addEventListener');
    const listener = vi.fn();

    attachListeners([{ target, type: 'click', listener, options: { capture: true } }]);

    expect(addSpy).toHaveBeenCalledWith('click', listener, { capture: true });
  });

  it('returns a closure that removes every registered listener', () => {
    const target = fakeTarget();
    const removeSpy = vi.spyOn(target, 'removeEventListener');
    const listenerA = vi.fn();
    const listenerB = vi.fn();

    const detach = attachListeners([
      { target, type: 'click', listener: listenerA },
      { target, type: 'keydown', listener: listenerB, options: { capture: true } }
    ]);
    detach();

    expect(removeSpy).toHaveBeenCalledWith('click', listenerA, undefined);
    expect(removeSpy).toHaveBeenCalledWith('keydown', listenerB, { capture: true });
  });

  it('supports mixed targets in a single call', () => {
    const targetA = fakeTarget();
    const targetB = fakeTarget();
    const removeA = vi.spyOn(targetA, 'removeEventListener');
    const removeB = vi.spyOn(targetB, 'removeEventListener');

    const detach = attachListeners([
      { target: targetA, type: 'focus', listener: vi.fn() },
      { target: targetB, type: 'blur', listener: vi.fn() }
    ]);
    detach();

    expect(removeA).toHaveBeenCalledTimes(1);
    expect(removeB).toHaveBeenCalledTimes(1);
  });
});
