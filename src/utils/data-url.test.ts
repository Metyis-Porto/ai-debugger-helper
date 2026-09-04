import { describe, expect, it } from 'vitest';

import { dataUrlToBlob } from './data-url.js';

describe('dataUrlToBlob', () => {
  it('decodes the declared mime type and byte content', async () => {
    // "hi" base64-encoded, with an arbitrary mime type to prove it's read
    // from the header rather than hardcoded.
    const blob = dataUrlToBlob('data:image/png;base64,aGk=');
    expect(blob.type).toBe('image/png');
    const text = await blob.text();
    expect(text).toBe('hi');
  });

  it('falls back to a generic mime type when the header is malformed', () => {
    const blob = dataUrlToBlob('not-a-data-url');
    expect(blob.type).toBe('application/octet-stream');
  });
});
