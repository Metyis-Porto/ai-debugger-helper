import type { DomReference } from '../types/index.js';

const MAX_TEXT_LENGTH = 60;

function visibleText(element: Element): string | undefined {
  const text = element.textContent?.trim().replace(/\s+/g, ' ');
  if (!text) return undefined;
  return text.length > MAX_TEXT_LENGTH ? `${text.slice(0, MAX_TEXT_LENGTH)}…` : text;
}

/**
 * A short, human-readable path used only as a last-resort selector — favors
 * tag + nth-of-type over id/class chains, which break the moment styling
 * changes. Capped at 4 ancestors so it stays readable in an export.
 */
function structuralSelector(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  for (let depth = 0; current && depth < 4; depth += 1) {
    const parent: Element | null = current.parentElement;
    const tag = current.tagName.toLowerCase();
    if (!parent) {
      parts.unshift(tag);
      break;
    }
    const siblings = [...parent.children].filter(
      (sibling) => sibling.tagName === current!.tagName
    );
    const index = siblings.indexOf(current);
    parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${index + 1})` : tag);
    current = parent;
  }
  return parts.join(' > ');
}

/**
 * Builds a stable, non-brittle reference to an element: `data-testid` first,
 * then `id`, then falls back to a short structural path. Never relies on
 * CSS class names, which are the most likely thing to change between the
 * moment a bug is recorded and the moment it's reproduced.
 */
export function buildDomReference(element: Element): DomReference {
  const testId = element.getAttribute('data-testid') ?? undefined;
  const id = element.id || undefined;
  const role = element.getAttribute('role') ?? undefined;
  const tag = element.tagName.toLowerCase();
  const text = visibleText(element);

  const selector = testId
    ? `[data-testid="${testId}"]`
    : id
      ? `#${id}`
      : structuralSelector(element);

  return { selector, testId, role, text, tag };
}
