import { afterEach, describe, expect, it } from 'vitest';

import { attachMouseCapture } from './mouse.js';
import { createRecorderStore } from '../runtime/store.js';

describe('attachMouseCapture', () => {
  let detach: (() => void) | null = null;

  afterEach(() => {
    detach?.();
    detach = null;
  });

  it('records a click with the target DOM reference and coordinates', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachMouseCapture(store);

    const button = document.createElement('button');
    button.id = 'save';
    document.body.appendChild(button);
    button.dispatchEvent(
      new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 20 })
    );

    const [event] = store.getTimeline().events;
    expect(event?.category).toBe('mouse');
    expect(event?.detail).toMatchObject({
      kind: 'click',
      x: 10,
      y: 20,
      target: { selector: '#save' }
    });

    document.body.removeChild(button);
  });

  it('stops recording once detached', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachMouseCapture(store);
    detach();
    detach = null;

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(store.getTimeline().events).toHaveLength(0);
  });
});
