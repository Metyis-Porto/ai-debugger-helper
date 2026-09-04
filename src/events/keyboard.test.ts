import { afterEach, describe, expect, it } from 'vitest';

import { attachKeyboardCapture } from './keyboard.js';
import { createRecorderStore } from '../runtime/store.js';

describe('attachKeyboardCapture', () => {
  let detach: (() => void) | null = null;

  afterEach(() => {
    detach?.();
    detach = null;
    document.body.innerHTML = '';
  });

  it('records a keydown with the pressed key and target reference', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachKeyboardCapture(store);

    const input = document.createElement('input');
    input.id = 'search';
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));

    const [event] = store.getTimeline().events;
    expect(event?.category).toBe('keyboard');
    expect(event?.detail).toMatchObject({
      kind: 'keydown',
      key: 'a',
      isShortcut: false,
      target: { selector: '#search' }
    });
  });

  it('records a keyup under its own kind', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachKeyboardCapture(store);

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true }));

    const [event] = store.getTimeline().events;
    expect(event?.detail).toMatchObject({ kind: 'keyup' });
  });

  it('flags a modifier combination as a shortcut', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachKeyboardCapture(store);

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true })
    );

    const [event] = store.getTimeline().events;
    expect(event?.detail).toMatchObject({ isShortcut: true });
  });

  it('does not treat holding Control by itself as a shortcut', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachKeyboardCapture(store);

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true, bubbles: true })
    );

    const [event] = store.getTimeline().events;
    expect(event?.detail).toMatchObject({ isShortcut: false });
  });

  it('redacts the key for a sensitive input instead of recording it verbatim', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachKeyboardCapture(store);

    const password = document.createElement('input');
    password.type = 'password';
    document.body.appendChild(password);
    password.dispatchEvent(new KeyboardEvent('keydown', { key: '7', bubbles: true }));

    const [event] = store.getTimeline().events;
    expect(event?.detail).toMatchObject({ key: '[redacted]' });
  });

  it('ignores a non-KeyboardEvent dispatched as "keydown" (defensive instanceof guard)', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachKeyboardCapture(store);

    document.body.dispatchEvent(new Event('keydown', { bubbles: true }));

    expect(store.getTimeline().events).toHaveLength(0);
  });

  it('stops recording once detached', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachKeyboardCapture(store);
    detach();
    detach = null;

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));

    expect(store.getTimeline().events).toHaveLength(0);
  });
});
