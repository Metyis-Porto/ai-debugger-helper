import { describe, expect, it } from 'vitest';

import { buildDomReference } from './dom-reference.js';

describe('buildDomReference', () => {
  it('prefers data-testid over everything else', () => {
    const element = document.createElement('button');
    element.setAttribute('data-testid', 'save-button');
    element.id = 'ignored';
    expect(buildDomReference(element).selector).toBe('[data-testid="save-button"]');
  });

  it('falls back to id when there is no data-testid', () => {
    const element = document.createElement('div');
    element.id = 'panel';
    expect(buildDomReference(element).selector).toBe('#panel');
  });

  it('falls back to a structural path when there is neither', () => {
    const parent = document.createElement('div');
    const child = document.createElement('span');
    parent.appendChild(child);
    expect(buildDomReference(child).selector).not.toMatch(/^\.|^#/);
  });

  it('captures role, tag and truncated visible text', () => {
    const element = document.createElement('button');
    element.setAttribute('role', 'button');
    element.textContent = 'x'.repeat(100);
    const reference = buildDomReference(element);
    expect(reference.role).toBe('button');
    expect(reference.tag).toBe('button');
    expect(reference.text?.length).toBeLessThanOrEqual(61);
  });
});
