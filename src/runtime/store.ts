import { createSequenceCounter, elapsedSince } from '../utils/id.js';
import {
  SCREENSHOT_CATEGORIES,
  type BrowserDebugRecorderConfig,
  type EnvironmentInfo,
  type RecorderStatus,
  type RecordedEvent,
  type RecordingTimeline
} from '../types/index.js';

const DEFAULT_MAX_EVENTS = 5000;
/** A capture that hasn't settled by this point is assumed stuck — export must never hang on it. */
const SCREENSHOT_WAIT_TIMEOUT_MS = 5000;

export type NewEvent = Omit<RecordedEvent, 'sequence' | 'timestamp' | 'elapsedMs'>;

export type RecorderStore = {
  readonly start: () => void;
  readonly pause: () => void;
  readonly resume: () => void;
  readonly stop: () => void;
  readonly clear: () => void;
  /** No-ops when the store isn't in the `recording` state (Idle/Paused/Stopped never accumulate events). */
  readonly push: (event: NewEvent) => RecordedEvent | null;
  readonly getStatus: () => RecorderStatus;
  readonly getTimeline: () => RecordingTimeline;
  /** The most recently recorded event's sequence number, for correlating a runtime error to what triggered it. */
  readonly getLastSequence: () => number | null;
  readonly subscribe: (listener: (status: RecorderStatus) => void) => () => void;
  /** Resolves once every in-flight screenshot capture has settled (or after a timeout) — call before exporting. */
  readonly waitForPendingScreenshots: () => Promise<void>;
};

function readEnvironment(): EnvironmentInfo {
  const hasWindow = typeof window !== 'undefined';
  return {
    userAgent: hasWindow ? window.navigator.userAgent : 'unknown',
    viewport: {
      width: hasWindow ? window.innerWidth : 0,
      height: hasWindow ? window.innerHeight : 0
    },
    url: hasWindow ? window.location.href : '',
    recordedAt: new Date().toISOString()
  };
}

export function createRecorderStore(
  config: BrowserDebugRecorderConfig = {}
): RecorderStore {
  const maxEvents = config.maxEvents ?? DEFAULT_MAX_EVENTS;
  const nextSequence = createSequenceCounter();
  const listeners = new Set<(status: RecorderStatus) => void>();

  let status: RecorderStatus = 'idle';
  let events: RecordedEvent[] = [];
  let startedAtMs = 0;
  let startedAtIso: string | null = null;
  let stoppedAtIso: string | null = null;
  let environment: EnvironmentInfo = readEnvironment();
  const pendingScreenshots = new Set<Promise<void>>();

  function setStatus(next: RecorderStatus) {
    status = next;
    for (const listener of listeners) listener(status);
  }

  /** Replaces the event by sequence (immutable update) — a no-op if it was since evicted or cleared. */
  function attachScreenshot(sequence: number, screenshot: string) {
    const index = events.findIndex((event) => event.sequence === sequence);
    if (index === -1) return;
    events[index] = { ...events[index]!, screenshot };
  }

  function captureScreenshotFor(recorded: RecordedEvent) {
    if (!config.captureScreenshot || !SCREENSHOT_CATEGORIES.has(recorded.category))
      return;
    const promise = config
      .captureScreenshot()
      .then((screenshot) => attachScreenshot(recorded.sequence, screenshot))
      .catch(() => {
        // Best-effort: a failed capture just leaves this event without a
        // screenshot rather than breaking the recording.
      })
      .finally(() => pendingScreenshots.delete(promise));
    pendingScreenshots.add(promise);
  }

  return {
    start() {
      if (status === 'recording') return;
      events = [];
      environment = readEnvironment();
      startedAtMs = Date.now();
      startedAtIso = new Date(startedAtMs).toISOString();
      stoppedAtIso = null;
      setStatus('recording');
    },
    pause() {
      if (status !== 'recording') return;
      setStatus('paused');
    },
    resume() {
      if (status !== 'paused') return;
      setStatus('recording');
    },
    stop() {
      if (status !== 'recording' && status !== 'paused') return;
      stoppedAtIso = new Date().toISOString();
      setStatus('stopped');
    },
    clear() {
      events = [];
      startedAtIso = null;
      stoppedAtIso = null;
      setStatus('idle');
    },
    push(event) {
      if (status !== 'recording') return null;
      const now = Date.now();
      const recorded = {
        ...event,
        sequence: nextSequence(),
        timestamp: now,
        elapsedMs: elapsedSince(startedAtMs, now)
      } as RecordedEvent;
      events.push(recorded);
      if (events.length > maxEvents) events.shift();
      captureScreenshotFor(recorded);
      return recorded;
    },
    getStatus: () => status,
    getLastSequence: () => (events.length ? events[events.length - 1]!.sequence : null),
    getTimeline: () => ({
      events: [...events],
      environment,
      metadata: {
        startedAt: startedAtIso ?? environment.recordedAt,
        stoppedAt: stoppedAtIso,
        durationMs: events.length
          ? events[events.length - 1]!.elapsedMs
          : elapsedSince(startedAtMs, Date.now()),
        eventCount: events.length
      }
    }),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async waitForPendingScreenshots() {
      if (!pendingScreenshots.size) return;
      const timeout = new Promise<void>((resolve) =>
        setTimeout(resolve, SCREENSHOT_WAIT_TIMEOUT_MS)
      );
      await Promise.race([Promise.allSettled([...pendingScreenshots]), timeout]);
    }
  };
}
