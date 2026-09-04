import { attachConsoleCapture } from '../events/console.js';
import { attachDragAndDropCapture } from '../events/dragdrop.js';
import { attachFormCapture } from '../events/forms.js';
import { attachKeyboardCapture } from '../events/keyboard.js';
import { attachMouseCapture } from '../events/mouse.js';
import { attachNavigationCapture } from '../events/navigation.js';
import { attachNetworkCapture } from '../events/network.js';
import { attachRuntimeCapture } from '../events/runtime.js';
import { attachScrollCapture } from '../events/scroll.js';
import { attachSelectionCapture } from '../events/selection.js';
import { attachWindowCapture } from '../events/window.js';
import { buildExport } from '../exporters/build-export.js';
import { downloadExport } from '../exporters/download.js';
import { captureScreenshot } from '../utils/screenshot.js';
import { createRecorderStore, type RecorderStore } from './store.js';
import type { BrowserDebugRecorderConfig, RecordingTimeline } from '../types/index.js';

let store: RecorderStore | null = null;
let disposers: readonly (() => void)[] = [];

function isDevelopmentByDefault(): boolean {
  return typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';
}

/**
 * Attaches every capturer and returns the recorder's store. Idempotent —
 * calling this more than once (e.g. across Fast Refresh reloads) reuses the
 * existing store instead of double-attaching listeners.
 *
 * Callers MUST still gate this behind their own environment/dynamic-import
 * check (see IMPLEMENT_BROWSER_DEBUG_RECORDER.md's "Environment
 * Restrictions") — the `enabled` default here is a second line of defense,
 * not the primary one, since this module can still be reached at runtime if
 * a caller forgets that guard.
 */
export function initializeBrowserDebugRecorder(
  config: BrowserDebugRecorderConfig = {}
): RecorderStore | null {
  const enabled = config.enabled ?? isDevelopmentByDefault();
  if (!enabled) return null;
  if (store) return store;

  const newStore = createRecorderStore({
    captureScreenshot,
    ...config
  });
  disposers = [
    attachNavigationCapture(newStore),
    attachMouseCapture(newStore),
    attachKeyboardCapture(newStore),
    attachFormCapture(newStore),
    attachSelectionCapture(newStore),
    attachDragAndDropCapture(newStore),
    attachScrollCapture(newStore),
    attachWindowCapture(newStore),
    attachConsoleCapture(newStore),
    attachNetworkCapture(newStore),
    attachRuntimeCapture(newStore)
  ];
  store = newStore;
  return store;
}

/** The active store, or `null` if `initializeBrowserDebugRecorder` hasn't run (or was disabled). */
export function getStore(): RecorderStore | null {
  return store;
}

export function startRecording(): void {
  store?.start();
}

export function pauseRecording(): void {
  store?.pause();
}

export function resumeRecording(): void {
  store?.resume();
}

export function stopRecording(): void {
  store?.stop();
}

export function clearRecording(): void {
  store?.clear();
}

export function isRecording(): boolean {
  return store?.getStatus() === 'recording';
}

export function getTimeline(): RecordingTimeline | null {
  return store?.getTimeline() ?? null;
}

/**
 * A generic, application-supplied semantic action — e.g. "page resized" or
 * "edit mode toggled". This is how a consuming app records anything the
 * recorder's own DOM-level categories can't know about, without the
 * recorder needing to know anything about that app's domain.
 */
export function recordAction(name: string, detail: Record<string, unknown> = {}): void {
  store?.push({ category: 'action', detail: { name, detail } });
}

export async function exportRecording(): Promise<void> {
  if (!store) return;
  // Never export while a screenshot is still mid-capture — see
  // "Screenshot Capture" in the spec.
  await store.waitForPendingScreenshots();
  const timeline = store.getTimeline();
  await downloadExport(buildExport(timeline));
}

/** Detaches every listener and drops the store. Call on app teardown (e.g. HMR dispose) to avoid leaks. */
export function disposeRecorder(): void {
  for (const dispose of disposers) dispose();
  disposers = [];
  store = null;
}
