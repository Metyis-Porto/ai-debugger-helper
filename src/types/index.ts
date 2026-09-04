/**
 * Shared types for the Browser Debug Recorder.
 * See docs/implementation/IMPLEMENT_BROWSER_DEBUG_RECORDER.md.
 */

export type RecorderStatus = 'idle' | 'recording' | 'paused' | 'stopped';

export type EventCategory =
  | 'navigation'
  | 'mouse'
  | 'keyboard'
  | 'form'
  | 'selection'
  | 'drag-and-drop'
  | 'scroll'
  | 'window'
  | 'runtime'
  | 'console'
  | 'network'
  | 'action';

/** A stable, non-brittle reference to the DOM element an interaction targeted. */
export type DomReference = {
  readonly selector: string;
  readonly testId?: string;
  readonly role?: string;
  readonly text?: string;
  readonly tag: string;
};

/** The categories significant enough to warrant a screenshot — see "Screenshot Capture" in the spec. */
export const SCREENSHOT_CATEGORIES: ReadonlySet<EventCategory> = new Set([
  'navigation',
  'runtime',
  'action'
]);

export type BaseRecordedEvent = {
  readonly sequence: number;
  readonly timestamp: number;
  readonly elapsedMs: number;
  readonly category: EventCategory;
  /** A PNG data URL, attached asynchronously after the event is pushed — absent until capture resolves (see "Screenshot Capture"). */
  readonly screenshot?: string;
};

export type NavigationEventDetail = {
  readonly url: string;
  readonly kind: 'load' | 'push-state' | 'replace-state' | 'pop-state' | 'hash-change';
};

export type MouseEventDetail = {
  readonly kind: 'click' | 'dblclick' | 'contextmenu' | 'mousedown' | 'mouseup';
  readonly target: DomReference;
  readonly x: number;
  readonly y: number;
};

export type KeyboardEventDetail = {
  readonly kind: 'keydown' | 'keyup';
  readonly key: string;
  readonly target: DomReference;
  readonly isShortcut: boolean;
};

export type FormEventDetail = {
  readonly fieldId: string;
  readonly fieldName: string;
  readonly valueLength: number;
  readonly validationResult: 'valid' | 'invalid' | 'unknown';
};

export type SelectionEventDetail = {
  readonly kind: 'dropdown' | 'radio' | 'checkbox' | 'tab' | 'menu';
  readonly target: DomReference;
  readonly value?: string;
};

export type DragAndDropEventDetail = {
  readonly source: DomReference;
  readonly destination: DomReference | null;
  readonly indexBefore: number | null;
  readonly indexAfter: number | null;
};

export type ScrollEventDetail = {
  readonly container: DomReference;
  readonly direction: 'up' | 'down' | 'left' | 'right';
  readonly position: { readonly x: number; readonly y: number };
};

export type WindowEventDetail = {
  readonly kind: 'resize' | 'focus' | 'blur' | 'visibility-change';
  readonly width?: number;
  readonly height?: number;
  readonly visibilityState?: DocumentVisibilityState;
};

export type RuntimeEventDetail = {
  readonly kind: 'react-error' | 'error-boundary' | 'exception' | 'unhandled-rejection';
  readonly message: string;
  readonly stack?: string;
  /** Sequence number of the interaction believed to have triggered this. */
  readonly triggeredBySequence: number | null;
};

export type ConsoleEventDetail = {
  readonly severity: 'log' | 'info' | 'warn' | 'error';
  readonly arguments: readonly string[];
  readonly stack?: string;
};

export type NetworkEventDetail = {
  readonly method: string;
  readonly url: string;
  readonly startTime: number;
  readonly finishTime: number;
  readonly durationMs: number;
  readonly status: number | null;
  readonly responseSize: number | null;
  readonly failed: boolean;
};

/** A generic, application-supplied semantic action (see `recordAction`). */
export type ActionEventDetail = {
  readonly name: string;
  readonly detail: Readonly<Record<string, unknown>>;
};

export type RecordedEvent = BaseRecordedEvent &
  (
    | { readonly category: 'navigation'; readonly detail: NavigationEventDetail }
    | { readonly category: 'mouse'; readonly detail: MouseEventDetail }
    | { readonly category: 'keyboard'; readonly detail: KeyboardEventDetail }
    | { readonly category: 'form'; readonly detail: FormEventDetail }
    | { readonly category: 'selection'; readonly detail: SelectionEventDetail }
    | { readonly category: 'drag-and-drop'; readonly detail: DragAndDropEventDetail }
    | { readonly category: 'scroll'; readonly detail: ScrollEventDetail }
    | { readonly category: 'window'; readonly detail: WindowEventDetail }
    | { readonly category: 'runtime'; readonly detail: RuntimeEventDetail }
    | { readonly category: 'console'; readonly detail: ConsoleEventDetail }
    | { readonly category: 'network'; readonly detail: NetworkEventDetail }
    | { readonly category: 'action'; readonly detail: ActionEventDetail }
  );

export type EnvironmentInfo = {
  readonly userAgent: string;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly url: string;
  readonly recordedAt: string;
};

export type SessionMetadata = {
  readonly startedAt: string;
  readonly stoppedAt: string | null;
  readonly durationMs: number;
  readonly eventCount: number;
};

/** In-memory representation of a completed recording, ready to export. */
export type RecordingTimeline = {
  readonly events: readonly RecordedEvent[];
  readonly environment: EnvironmentInfo;
  readonly metadata: SessionMetadata;
};

export type ExportBundle = {
  readonly files: Readonly<Record<string, string>>;
  /** path → PNG data URL. Kept separate from `files` since these need binary, not text, handling on write. */
  readonly binaryFiles: Readonly<Record<string, string>>;
};

export type BrowserDebugRecorderConfig = {
  /**
   * Defaults to `process.env.NODE_ENV === 'development'`. Callers should
   * still guard `initializeBrowserDebugRecorder` behind their own
   * environment check — this is a second line of defense, not the primary
   * one (see IMPLEMENT_BROWSER_DEBUG_RECORDER.md's "Environment Restrictions").
   */
  readonly enabled?: boolean;
  /** Maximum events retained in memory before the oldest are dropped. Defaults to 5000. */
  readonly maxEvents?: number;
  /**
   * Renders a screenshot for every `navigation`/`runtime`/`action` event
   * (see `SCREENSHOT_CATEGORIES`). Injected rather than hardwired to
   * html2canvas so the store stays testable without a real DOM-rendering
   * engine; `initializeBrowserDebugRecorder` supplies the real
   * implementation. Omit to disable screenshot capture entirely.
   */
  readonly captureScreenshot?: () => Promise<string>;
};
