import '@testing-library/jest-dom/vitest';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { downloadExport } from './download.js';
import type { ExportBundle } from '../types/index.js';

function bundle(overrides: Partial<ExportBundle> = {}): ExportBundle {
  return {
    files: { 'report.md': '# Report' },
    binaryFiles: {},
    ...overrides
  } as ExportBundle;
}

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: () => Promise<unknown>;
};

describe('downloadExport — anchor fallback (no File System Access API)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    delete (window as DirectoryPickerWindow).showDirectoryPicker;
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('clicks a hidden, prefixed download anchor for each text file', async () => {
    const clicks: string[] = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        clicks.push(this.download);
      });

    await downloadExport(bundle({ files: { 'report.md': '# Report' } }));

    expect(clicks).toEqual(['browser-debug-session__report.md']);
    clickSpy.mockRestore();
  });

  it('flattens a nested relative path into the download filename', async () => {
    const clicks: string[] = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        clicks.push(this.download);
      });

    await downloadExport(bundle({ files: { 'events/console.json': '[]' } }));

    expect(clicks).toEqual(['browser-debug-session__events__console.json']);
    clickSpy.mockRestore();
  });

  it('downloads a binary file directly from its data: URL, with no object-URL revocation', async () => {
    const hrefs: string[] = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        hrefs.push(this.href);
      });
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    await downloadExport(
      bundle({
        files: {},
        binaryFiles: { 'screenshots/1.png': 'data:image/png;base64,AAAA' }
      })
    );

    expect(hrefs).toEqual(['data:image/png;base64,AAAA']);
    vi.advanceTimersByTime(1000);
    expect(revokeSpy).not.toHaveBeenCalled();
    clickSpy.mockRestore();
    revokeSpy.mockRestore();
  });

  it('removes the anchor from the document after the download settles', async () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    await downloadExport(bundle());
    expect(document.querySelector('a[download]')).toBeInTheDocument();
    vi.advanceTimersByTime(1000);
    expect(document.querySelector('a[download]')).toBeNull();

    clickSpy.mockRestore();
  });
});

describe('downloadExport — File System Access API', () => {
  afterEach(() => {
    delete (window as DirectoryPickerWindow).showDirectoryPicker;
    vi.restoreAllMocks();
  });

  function fakeDirectoryHandle() {
    const written: Record<string, string> = {};
    const writable = {
      write: vi.fn(async (content: string | Blob) => {
        written['__last__'] = typeof content === 'string' ? content : '[blob]';
      }),
      close: vi.fn(async () => {})
    };
    const fileHandle = { createWritable: vi.fn(async () => writable) };
    const handle = {
      getDirectoryHandle: vi.fn(async () => handle),
      getFileHandle: vi.fn(async (name: string) => {
        void name;
        return fileHandle;
      })
    };
    return { handle, writable, fileHandle, written };
  }

  it('writes every file and binary file through the picked directory instead of falling back to anchors', async () => {
    const { handle, fileHandle } = fakeDirectoryHandle();
    (window as DirectoryPickerWindow).showDirectoryPicker = vi
      .fn()
      .mockResolvedValue(handle);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    await downloadExport(
      bundle({
        files: { 'report.md': '# Report' },
        binaryFiles: { 'screenshots/1.png': 'data:image/png;base64,AAAA' }
      })
    );

    expect(handle.getDirectoryHandle).toHaveBeenCalledWith('browser-debug-session', {
      create: true
    });
    expect(handle.getFileHandle).toHaveBeenCalledWith('report.md', { create: true });
    expect(handle.getDirectoryHandle).toHaveBeenCalledWith('screenshots', {
      create: true
    });
    expect(fileHandle.createWritable).toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('does not fall back to anchor downloads when the user cancels the directory picker', async () => {
    (window as DirectoryPickerWindow).showDirectoryPicker = vi
      .fn()
      .mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    await downloadExport(bundle());

    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('falls back to anchor downloads when the picker fails for a reason other than cancellation', async () => {
    (window as DirectoryPickerWindow).showDirectoryPicker = vi
      .fn()
      .mockRejectedValue(new Error('not actually usable'));
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    await downloadExport(bundle());

    expect(clickSpy).toHaveBeenCalled();
  });
});
