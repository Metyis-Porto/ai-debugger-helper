import { dataUrlToBlob } from '../utils/data-url.js';
import type { ExportBundle } from '../types/index.js';

const EXPORT_FOLDER_NAME = 'browser-debug-session';

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandleLike>;
};

type FileSystemDirectoryHandleLike = {
  getDirectoryHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<FileSystemDirectoryHandleLike>;
  getFileHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<{ createWritable: () => Promise<FileSystemWritableFileStreamLike> }>;
};

type FileSystemWritableFileStreamLike = {
  write: (data: string | Blob) => Promise<void>;
  close: () => Promise<void>;
};

async function writeFile(
  session: FileSystemDirectoryHandleLike,
  relativePath: string,
  content: string | Blob
): Promise<void> {
  const segments = relativePath.split('/');
  const fileName = segments.pop()!;
  let directory = session;
  for (const segment of segments)
    directory = await directory.getDirectoryHandle(segment, { create: true });
  const fileHandle = await directory.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

async function writeViaFileSystemAccess(
  root: FileSystemDirectoryHandleLike,
  bundle: ExportBundle
): Promise<void> {
  const session = await root.getDirectoryHandle(EXPORT_FOLDER_NAME, { create: true });
  for (const [relativePath, content] of Object.entries(bundle.files))
    await writeFile(session, relativePath, content);
  for (const [relativePath, dataUrl] of Object.entries(bundle.binaryFiles))
    await writeFile(session, relativePath, dataUrlToBlob(dataUrl));
}

/**
 * The anchor must be attached to the document for `.click()` to reliably
 * trigger a download in every browser, and the object URL must outlive the
 * click — revoking it synchronously right after can race the browser's own
 * (asynchronous) handling of the navigation and silently drop the download.
 */
function downloadFile(relativePath: string, href: string, revoke: boolean): void {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = `${EXPORT_FOLDER_NAME}__${relativePath.replaceAll('/', '__')}`;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    document.body.removeChild(anchor);
    if (revoke) URL.revokeObjectURL(href);
  }, 1000);
}

function downloadViaAnchor(bundle: ExportBundle): void {
  for (const [relativePath, content] of Object.entries(bundle.files)) {
    const blob = new Blob([content], { type: 'text/plain' });
    downloadFile(relativePath, URL.createObjectURL(blob), true);
  }
  // A data: URL can be the anchor's href directly — no Blob/object URL needed.
  for (const [relativePath, dataUrl] of Object.entries(bundle.binaryFiles))
    downloadFile(relativePath, dataUrl, false);
}

function isUserCancellation(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * Saves the export bundle to disk. Prefers the File System Access API (a
 * real `browser-debug-session/` folder, matching the documented Export
 * Format exactly); falls back to individual file downloads — flattened,
 * prefixed filenames — in browsers that don't support it, or when the
 * primary path fails for a reason other than the user deliberately
 * cancelling the folder picker (e.g. an environment where the API exists
 * but isn't actually usable).
 */
export async function downloadExport(bundle: ExportBundle): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('downloadExport can only run in a browser environment.');
  }
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (typeof picker === 'function') {
    try {
      const root = await picker.call(window);
      await writeViaFileSystemAccess(root, bundle);
      return;
    } catch (error) {
      if (isUserCancellation(error)) return;
      // Fall through to the anchor-download fallback below.
    }
  }
  downloadViaAnchor(bundle);
}
