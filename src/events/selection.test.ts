import { afterEach, describe, expect, it } from 'vitest';

import { attachSelectionCapture } from './selection.js';
import { createRecorderStore } from '../runtime/store.js';

describe('attachSelectionCapture', () => {
  let detach: (() => void) | null = null;

  afterEach(() => {
    detach?.();
    detach = null;
    document.body.innerHTML = '';
  });

  it('records a dropdown selection with its value', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachSelectionCapture(store);

    const select = document.createElement('select');
    const option = document.createElement('option');
    option.value = 'EMEA';
    select.appendChild(option);
    select.value = 'EMEA';
    document.body.appendChild(select);
    select.dispatchEvent(new Event('change', { bubbles: true }));

    const [event] = store.getTimeline().events;
    expect(event?.category).toBe('selection');
    expect(event?.detail).toMatchObject({ kind: 'dropdown', value: 'EMEA' });
  });

  it('records a radio selection with its value', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachSelectionCapture(store);

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.value = 'yes';
    document.body.appendChild(radio);
    radio.dispatchEvent(new Event('change', { bubbles: true }));

    const [event] = store.getTimeline().events;
    expect(event?.detail).toMatchObject({ kind: 'radio', value: 'yes' });
  });

  it('records a checkbox toggle with its checked state as the value', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachSelectionCapture(store);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    document.body.appendChild(checkbox);
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));

    const [event] = store.getTimeline().events;
    expect(event?.detail).toMatchObject({ kind: 'checkbox', value: 'true' });
  });

  it('ignores a change on an element outside those three categories', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachSelectionCapture(store);

    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);
    input.dispatchEvent(new Event('change', { bubbles: true }));

    expect(store.getTimeline().events).toHaveLength(0);
  });

  it('records a click on a tab even when the click target is a descendant of it', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachSelectionCapture(store);

    const tab = document.createElement('div');
    tab.setAttribute('role', 'tab');
    tab.id = 'settings-tab';
    const label = document.createElement('span');
    tab.appendChild(label);
    document.body.appendChild(tab);
    label.dispatchEvent(new Event('click', { bubbles: true }));

    const [event] = store.getTimeline().events;
    expect(event?.detail).toMatchObject({
      kind: 'tab',
      target: { selector: '#settings-tab' }
    });
  });

  it('records a click on a menu item', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachSelectionCapture(store);

    const menuItem = document.createElement('div');
    menuItem.setAttribute('role', 'menuitem');
    document.body.appendChild(menuItem);
    menuItem.dispatchEvent(new Event('click', { bubbles: true }));

    const [event] = store.getTimeline().events;
    expect(event?.detail).toMatchObject({ kind: 'menu' });
  });

  it('ignores a click that matches neither a tab nor a menu item', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachSelectionCapture(store);

    const button = document.createElement('button');
    document.body.appendChild(button);
    button.dispatchEvent(new Event('click', { bubbles: true }));

    expect(store.getTimeline().events).toHaveLength(0);
  });

  it('stops recording once detached', () => {
    const store = createRecorderStore();
    store.start();
    detach = attachSelectionCapture(store);
    detach();
    detach = null;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    document.body.appendChild(checkbox);
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));

    expect(store.getTimeline().events).toHaveLength(0);
  });
});
