import type { ReactNode } from 'react';

import type { RecorderStore } from './runtime/store.js';
import type { RecorderErrorBoundaryProps } from './ui/RecorderErrorBoundary.js';
import type { RecorderToolbarProps } from './ui/Toolbar.js';
import type { BrowserDebugRecorderConfig, RecordingTimeline } from './types/index.js';

/**
 * No-op mirror of `./index.ts`'s public API, for consumers that need a
 * build-time exclusion stronger than a dead `NODE_ENV` branch (see the
 * package README's "Excluding it from production"). Every export here has
 * the same name and type shape as the real one — imported as types, not
 * runtime values, so this file pulls in none of the real implementation
 * (no html2canvas, no DOM listeners) — which means aliasing a bundler's
 * production resolution to this module instead of `./index.js` can never
 * silently drift from the real API: a signature change over there is a
 * type error here, not a runtime surprise after publish.
 */

export function initializeBrowserDebugRecorder(
  _config: BrowserDebugRecorderConfig = {}
): RecorderStore | null {
  return null;
}

export function getStore(): RecorderStore | null {
  return null;
}

export function startRecording(): void {}

export function pauseRecording(): void {}

export function resumeRecording(): void {}

export function stopRecording(): void {}

export function clearRecording(): void {}

export function isRecording(): boolean {
  return false;
}

export function getTimeline(): RecordingTimeline | null {
  return null;
}

export function recordAction(
  _name: string,
  _detail: Record<string, unknown> = {}
): void {}

export function exportRecording(): Promise<void> {
  return Promise.resolve();
}

export function disposeRecorder(): void {}

export function RecorderErrorBoundary({
  children
}: RecorderErrorBoundaryProps): ReactNode {
  return children ?? null;
}

export function RecorderToolbar(_props: RecorderToolbarProps): null {
  return null;
}

export type { RecorderStore };
