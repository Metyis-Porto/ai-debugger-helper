import { useEffect, useState, type CSSProperties } from 'react';

import type { RecorderStore } from '../runtime/store.js';
import type { RecorderStatus } from '../types/index.js';

export type RecorderToolbarProps = {
  readonly store: RecorderStore;
  readonly onExport: () => void | Promise<void>;
};

// `left`, not `right` — chat widgets, feedback launchers, and other
// floating chrome overwhelmingly dock bottom-right, and this panel would
// otherwise end up sitting on top of one in the host app.
const panelStyle: CSSProperties = {
  position: 'fixed',
  bottom: 16,
  left: 16,
  zIndex: 2147483647,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  borderRadius: 8,
  background: '#1a1a1a',
  color: '#f5f5f5',
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  fontSize: 12,
  boxShadow: '0 4px 16px rgba(0,0,0,0.35)'
};

const buttonStyle: CSSProperties = {
  cursor: 'pointer',
  border: '1px solid #3a3a3a',
  background: '#2a2a2a',
  color: '#f5f5f5',
  borderRadius: 4,
  padding: '4px 8px',
  fontSize: 12
};

/** Same corner as `panelStyle`, so reopening doesn't jump the pointer elsewhere. */
const reopenStyle: CSSProperties = {
  position: 'fixed',
  bottom: 16,
  left: 16,
  zIndex: 2147483647,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  borderRadius: '50%',
  cursor: 'pointer',
  border: '1px solid #3a3a3a',
  background: '#1a1a1a',
  boxShadow: '0 4px 16px rgba(0,0,0,0.35)'
};

const dotColor: Record<RecorderStatus, string> = {
  idle: '#6b7280',
  recording: '#ef4444',
  paused: '#f59e0b',
  stopped: '#3b82f6'
};

function StatusDot({ status }: { readonly status: RecorderStatus }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: dotColor[status],
        display: 'inline-block'
      }}
    />
  );
}

const HIDDEN_STORAGE_KEY = 'browser-debug-recorder.hidden';

/** Whether the toolbar was dismissed on a previous visit. Best-effort: a full or unavailable `localStorage` just means the preference doesn't survive reload, not a broken toolbar. */
function readHidden(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(HIDDEN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeHidden(hidden: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (hidden) window.localStorage.setItem(HIDDEN_STORAGE_KEY, '1');
    else window.localStorage.removeItem(HIDDEN_STORAGE_KEY);
  } catch {
    // See `readHidden`.
  }
}

/** Never rendered in production — the caller is responsible for that gate (see `initializeBrowserDebugRecorder`). */
export function RecorderToolbar({ store, onExport }: RecorderToolbarProps) {
  const [status, setStatus] = useState<RecorderStatus>(store.getStatus());
  const [eventCount, setEventCount] = useState(store.getTimeline().metadata.eventCount);
  const [hidden, setHidden] = useState(readHidden);

  useEffect(() => {
    const unsubscribe = store.subscribe(setStatus);
    const interval = setInterval(
      () => setEventCount(store.getTimeline().metadata.eventCount),
      500
    );
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [store]);

  function hide() {
    setHidden(true);
    writeHidden(true);
  }

  function show() {
    setHidden(false);
    writeHidden(false);
  }

  if (hidden)
    return (
      <button
        type="button"
        style={reopenStyle}
        onClick={show}
        aria-label="Show debug recorder"
        data-testid="browser-debug-recorder-reopen"
      >
        <StatusDot status={status} />
      </button>
    );

  return (
    <div style={panelStyle} data-testid="browser-debug-recorder-toolbar">
      <StatusDot status={status} />
      <span>
        {status} ({eventCount})
      </span>
      {status === 'idle' || status === 'stopped' ? (
        <button style={buttonStyle} onClick={() => store.start()}>
          Start
        </button>
      ) : null}
      {status === 'recording' ? (
        <button style={buttonStyle} onClick={() => store.pause()}>
          Pause
        </button>
      ) : null}
      {status === 'paused' ? (
        <button style={buttonStyle} onClick={() => store.resume()}>
          Resume
        </button>
      ) : null}
      {status === 'recording' || status === 'paused' ? (
        <button style={buttonStyle} onClick={() => store.stop()}>
          Stop
        </button>
      ) : null}
      {status === 'stopped' ? (
        <button style={buttonStyle} onClick={() => void onExport()}>
          Export
        </button>
      ) : null}
      <button style={buttonStyle} onClick={() => store.clear()}>
        Clear
      </button>
      <button
        type="button"
        style={buttonStyle}
        onClick={hide}
        aria-label="Hide debug recorder"
      >
        Hide
      </button>
    </div>
  );
}
