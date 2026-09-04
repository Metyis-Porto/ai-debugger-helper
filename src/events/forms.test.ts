import { afterEach, describe, expect, it } from 'vitest';

import { attachFormCapture } from './forms.js';
import { createRecorderStore } from '../runtime/store.js';

describe('attachFormCapture', () => {
  let detach: (() => void) | null = null;

  afterEach(() => {
    detach?.();
    detach = null;
    document.body.innerHTML = '';
  });

  it('records an input event on a text field with its field id/name and value length', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachFormCapture(store);

    const input = document.createElement('input');
    input.id = 'email';
    input.name = 'email';
    input.value = 'a@b.com';
    document.body.appendChild(input);
    input.dispatchEvent(new Event('input', { bubbles: true }));

    const [event] = store.getTimeline().events;
    expect(event?.category).toBe('form');
    expect(event?.detail).toMatchObject({
      fieldId: 'email',
      fieldName: 'email',
      valueLength: 7,
      validationResult: 'valid'
    });
  });

  it('records a change event on a textarea', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachFormCapture(store);

    const textarea = document.createElement('textarea');
    textarea.value = 'notes';
    document.body.appendChild(textarea);
    textarea.dispatchEvent(new Event('change', { bubbles: true }));

    const [event] = store.getTimeline().events;
    expect(event?.detail).toMatchObject({ valueLength: 5 });
  });

  it('falls back to "(no id)"/"(no name)" placeholders when neither is set', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachFormCapture(store);

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(new Event('input', { bubbles: true }));

    const [event] = store.getTimeline().events;
    expect(event?.detail).toMatchObject({ fieldId: '(no id)', fieldName: '(no name)' });
  });

  it('forces valueLength to 0 for a sensitive input regardless of its real length', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachFormCapture(store);

    const input = document.createElement('input');
    input.type = 'password';
    input.value = 'super-secret';
    document.body.appendChild(input);
    input.dispatchEvent(new Event('input', { bubbles: true }));

    const [event] = store.getTimeline().events;
    expect(event?.detail).toMatchObject({ valueLength: 0 });
  });

  it('reports "unknown" validity when the element has no checkValidity function', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachFormCapture(store);

    const input = document.createElement('input');
    Object.defineProperty(input, 'checkValidity', { value: undefined });
    document.body.appendChild(input);
    input.dispatchEvent(new Event('input', { bubbles: true }));

    const [event] = store.getTimeline().events;
    expect(event?.detail).toMatchObject({ validationResult: 'unknown' });
  });

  it('reports "invalid" for a field that fails its own constraint validation', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachFormCapture(store);

    const input = document.createElement('input');
    input.required = true;
    input.value = '';
    document.body.appendChild(input);
    input.dispatchEvent(new Event('input', { bubbles: true }));

    const [event] = store.getTimeline().events;
    expect(event?.detail).toMatchObject({ validationResult: 'invalid' });
  });

  it('ignores selects, radios, and checkboxes — those belong to selection.ts', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachFormCapture(store);

    const select = document.createElement('select');
    const radio = document.createElement('input');
    radio.type = 'radio';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    document.body.append(select, radio, checkbox);

    select.dispatchEvent(new Event('change', { bubbles: true }));
    radio.dispatchEvent(new Event('change', { bubbles: true }));
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));

    expect(store.getTimeline().events).toHaveLength(0);
  });

  it('ignores an event whose target is not a validatable element', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachFormCapture(store);

    const div = document.createElement('div');
    document.body.appendChild(div);
    div.dispatchEvent(new Event('input', { bubbles: true }));

    expect(store.getTimeline().events).toHaveLength(0);
  });

  it('stops recording once detached', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachFormCapture(store);
    detach();
    detach = null;

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(store.getTimeline().events).toHaveLength(0);
  });
});
