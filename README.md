# @metyis-porto/ai-debugger-helper

A development-only browser interaction recorder. It captures a complete
user session — navigation, mouse/keyboard/form/selection/drag-and-drop
interactions, scroll, window state, console output, network requests, and
runtime errors, with a screenshot attached to each navigation, runtime
error, and application action — and exports a deterministic reproduction
bundle for AI-assisted debugging.

It exists to answer one question: **what exactly happened before the bug
occurred?** It is not an analytics system, not a telemetry system, and not
a monitoring platform — nothing it captures is sent anywhere on its own;
export is always an explicit, user-triggered action.

Framework-agnostic beyond React (its only peer dependency): no
assumptions about routing, state management, or your application's
domain.

> **Status.** Extracted from `command-center-fe`'s
> `packages/browser-debug-recorder` and verified standalone (build,
> typecheck, and its full test suite all pass here). Not yet published —
> see [Install](#install). The full behavioral spec (recorded event
> shapes, timing/correlation rules, exact export format) still lives at
> `docs/implementation/IMPLEMENT_BROWSER_DEBUG_RECORDER.md` in
> `command-center-fe` and should be ported here before this package is
> published externally. No license is set yet either — decide before
> publishing.

## Contents

- [Requirements](#requirements)
- [Install](#install)
- [Quick start](#quick-start)
  1. [Mount it once, near the root of your app](#1-mount-it-once-near-the-root-of-your-app)
  2. [Record a session](#2-record-a-session)
  3. [Export what you recorded](#3-export-what-you-recorded)
  4. [Tear it down (optional)](#4-tear-it-down-optional)
- [Configuration](#configuration)
- [Full API](#full-api)
- [Technical overview](#technical-overview)
- [Excluding it from production](#excluding-it-from-production)
- [Development](#development)
- [License](#license)

## Requirements

- React `^19.2.0` (peer dependency — bring your own; no other framework
  assumptions)
- Node `>=22` to build/test this package itself
- A browser. Every capturer no-ops outside one (SSR-safe), but the point
  of the package is client-side recording. The File System Access API
  (Chromium browsers) gives a real on-disk export folder; every other
  browser falls back to individual file downloads — same content, more
  clicks.

## Install

This package is published to **GitHub Packages**, not the public npm
registry. In the installing project's `.npmrc`:

```
@metyis-porto:registry=https://npm.pkg.github.com
```

Then set `NODE_AUTH_TOKEN` to a GitHub personal access token with at
least `read:packages` scope (works the same with npm, pnpm, or yarn):

```bash
npm install @metyis-porto/ai-debugger-helper
```

## Quick start

### 1. Mount it once, near the root of your app

```tsx
'use client';

import {
  exportRecording,
  initializeBrowserDebugRecorder,
  RecorderErrorBoundary,
  RecorderToolbar,
  type RecorderStore
} from '@metyis-porto/ai-debugger-helper';
import { useEffect, useState, type ReactNode } from 'react';

export function DebugRecorderPanel({ children }: { children?: ReactNode }) {
  const [store, setStore] = useState<RecorderStore | null>(null);

  useEffect(() => {
    setStore(initializeBrowserDebugRecorder());
  }, []);

  if (!store) return children ?? null;

  return (
    <RecorderErrorBoundary store={store}>
      {children}
      <RecorderToolbar store={store} onExport={exportRecording} />
    </RecorderErrorBoundary>
  );
}
```

(The `'use client'` directive is only needed under Next.js App Router —
drop it in any other React setup.)

`initializeBrowserDebugRecorder()` attaches every event listener and
returns the store; it's idempotent, so calling it again (e.g. across a
Fast Refresh reload) reuses the existing store instead of double-attaching
listeners. Render `<DebugRecorderPanel>` once, wrapping your app's normal
children.

**Gate it to development.** This package's own `enabled` default
(`process.env.NODE_ENV === 'development'`) is a second line of defense,
not the primary one — wrap the whole component in your own dev-only check
too, e.g. behind `next/dynamic` with `ssr: false` plus a
`NODE_ENV === 'development'` branch, so bundlers that trace dynamic
imports statically (Turbopack does) don't pull it into a production
bundle even on a dead branch. See
[Excluding it from production](#excluding-it-from-production) for the
bundler-level guarantee.

### 2. Record a session

`<RecorderToolbar>` renders a small floating panel with the recording
controls, driven by the store's own lifecycle:

| State               | What you see          | What it does                            |
| -------------------- | ---------------------- | ---------------------------------------- |
| `idle` / `stopped`   | **Start**              | begins capturing every event             |
| `recording`          | **Pause**, **Stop**    | capture continues, or ends the session   |
| `paused`             | **Resume**, **Stop**   | capture resumes, or ends the session     |
| `stopped`            | **Export**             | see step 3                               |

**Clear** wipes the current timeline; **Hide** collapses the toolbar to a
small status dot (click it to reopen) — both available in any state.

Reproduce the bug while `recording`, then click **Stop**.

To record something the recorder's own DOM-level categories can't know
about — an application-specific moment like "edit mode toggled" — call
this from anywhere in your app while a session is active. `recordAction`
doesn't watch for anything or match on any condition — it just records
whatever is true *right now*, at the exact line where you call it:

```ts
import { recordAction } from '@metyis-porto/ai-debugger-helper';

function toggleEditMode() {
  setEditMode(true);

  // `currentBreakpoint` is something *your app* already tracks
  // (e.g. from a useBreakpoint() hook). recordAction doesn't read
  // it, compute it, or react to it — it just logs the value your
  // code hands it, at the moment your code decided to call it.
  recordAction('edit-layout-on', { breakpoint: currentBreakpoint });
}
```

`recordAction(name, detail?)` takes two positional arguments, no options
object:

- `name` (`string`, required) — a label identifying the action, e.g.
  `'edit-layout-on'`. Shows up as-is in `report.md` and `actions.json`.
- `detail` (`Record<string, unknown>`, optional, defaults to `{}`) —
  arbitrary extra data to attach, e.g. `{ breakpoint: 'lg' }`. This is
  descriptive metadata only — the package never inspects, validates, or
  reacts to what's inside it. **Your app** decides both *when* to call
  `recordAction` and *what* to put in `detail`; keep the latter
  JSON-serializable, since it's written verbatim to `actions.json` on
  export.

It's a no-op if called while the recorder is `idle`, `paused`, or
`stopped` (same as every other capturer — see `push(event)` in the
[Technical overview](#the-store-runtimestorets)).

### 3. Export what you recorded

Click **Export** (or call `exportRecording()` directly). It saves a
`browser-debug-session/` folder — via the File System Access API where
supported, falling back to individual file downloads otherwise:

```text
browser-debug-session/
├── report.md         # human-readable summary
├── session.json      # the full timeline, every event
├── actions.json      # just your recordAction() calls
├── console.json      # console.{log,info,warn,error} calls
├── network.json      # fetch/XHR requests
├── runtime.json      # uncaught exceptions, rejections, React errors
├── environment.json  # user agent, viewport, URL, recorded-at
├── metadata.json     # start/stop time, duration, event count
└── screenshots/       # one PNG per navigation/runtime/action event
```

Hand that folder to whoever (or whatever — this is the point) needs to
reproduce the bug.

### 4. Tear it down (optional)

```ts
import { disposeRecorder } from '@metyis-porto/ai-debugger-helper';

disposeRecorder();
```

Detaches every listener and drops the store. Call it on app teardown
(e.g. HMR dispose) to avoid leaking listeners across reloads.

## Configuration

Pass a config object to `initializeBrowserDebugRecorder`:

```ts
type BrowserDebugRecorderConfig = {
  /** Defaults to `process.env.NODE_ENV === 'development'`. */
  enabled?: boolean;
  /** Max events retained in memory before the oldest are dropped. Defaults to 5000. */
  maxEvents?: number;
  /** Screenshot provider for navigation/runtime/action events. Omit to disable screenshots. */
  captureScreenshot?: () => Promise<string>;
};
```

## Full API

- `initializeBrowserDebugRecorder(config?)`, `getStore()`,
  `disposeRecorder()` — setup/teardown (steps 1 and 4).
- `startRecording()`, `pauseRecording()`, `resumeRecording()`,
  `stopRecording()`, `clearRecording()`, `isRecording()`, `getTimeline()`
  — the same lifecycle the toolbar's buttons call directly on the store;
  useful if you're driving the recorder programmatically instead of
  through `<RecorderToolbar>`.
- `recordAction(name: string, detail?: Record<string, unknown>)` — step 2.
- `exportRecording()` — step 3.
- `<RecorderToolbar store onExport />` — the floating panel from step 2.
- `<RecorderErrorBoundary store fallback?>` — a real error boundary:
  catches a React rendering error from its children, records it as a
  `runtime` event, and renders `fallback` (defaults to `null`) in place
  of the crashed subtree.
- Every type used above (`RecorderStore`, `RecordingTimeline`,
  `ExportBundle`, `DomReference`, event/category shapes, …) is exported
  from the package root too — see `src/types/index.ts` for the full set.

## Technical overview

How the pieces underneath the public API actually fit together.

### The store (`runtime/store.ts`)

Everything lives behind one closure-based state machine —
`idle → recording ⇄ paused → stopped`, transitions self-guard (e.g.
`pause()` is a no-op unless `status === 'recording'`). `push(event)` is
the single entry point every capturer calls; it's a no-op whenever the
store isn't `recording`, so nothing accumulates while idle, paused, or
stopped. A pushed event gets its `sequence`/`timestamp`/`elapsedMs`
stamped on the way in, and the in-memory array is a ring buffer — past
`maxEvents` (default 5000), the oldest event is dropped. `subscribe()` is
how `<RecorderToolbar>` reflects status changes without polling; it also
polls `getTimeline().metadata.eventCount` on a 500ms interval for the
live counter, since individual pushes aren't themselves broadcast.

### Capturers (`events/*.ts`)

Every `attach*Capture(store)` returns a cleanup closure and follows one of
two shapes:

- **DOM listener registration** — `mouse`, `keyboard`, `scroll`, `forms`,
  `selection`, `window`, `runtime`, and half of `navigation` build an
  array of `{ target, type, listener, options }` and hand it to
  `attachListeners()` (`utils/attach-listeners.ts`), which registers
  everything and returns the matching batch of `removeEventListener`
  calls as the cleanup.
- **Monkey-patching a global** — `console` (wraps
  `console.{log,info,warn,error}`), `network` (wraps `window.fetch` and
  `XMLHttpRequest`), and the other half of `navigation` (wraps
  `history.pushState`/`replaceState`) capture things that aren't real DOM
  events; each saves the original, patches it, and the cleanup restores
  the original.

Every capturer no-ops safely outside a browser (`typeof window ===
'undefined'`/`typeof document === 'undefined'` guards), so attaching them
during SSR is inert rather than throwing.

### Screenshots

`captureScreenshot` (`utils/screenshot.ts`, html2canvas-based) is
_injected_ into the store as a config callback rather than called
directly — this keeps the store testable without a real rendering engine,
and lets a consumer swap in their own capture strategy. On every `push()`,
the store checks `SCREENSHOT_CATEGORIES` (`navigation`/`runtime`/`action`
only) and, if the event qualifies, kicks off the capture _asynchronously_
and attaches the resulting data URL to that event once it resolves —
never blocking the push itself. A failed capture is swallowed (an event
just ends up without a screenshot rather than breaking the recording),
and `waitForPendingScreenshots()` — called by `exportRecording()` before
building the bundle — races every in-flight capture against a 5s timeout
so export can never hang on a stuck one.

### Sanitization (`serializers/sanitize.ts`)

Redaction happens at **capture time**, not export time — a sensitive
value never enters the in-memory timeline in the first place.
`isSensitiveInputElement`/`isSensitiveFieldName` (pattern-matched against
field name/id/autocomplete: password, token, card number, etc.) gate what
`keyboard.ts`/`forms.ts` actually record — a keystroke into a flagged
field is stored as a fixed `[redacted]` string, and a form field's value
is never stored at all, only its `valueLength`. `console.ts` runs the
same field-name pattern over object keys before stringifying console
arguments.

### DOM references (`utils/dom-reference.ts`)

Every event that targets an element records a `DomReference` (`selector`,
optional `testId`/`role`/`text`, `tag`) instead of a raw DOM node or a
brittle full CSS path — built once at capture time from whatever
selector/role/text signals are actually present on that element.

### Export (`exporters/build-export.ts`, `exporters/download.ts`)

`buildExport(timeline)` is a pure transform: the in-memory
`RecordingTimeline` becomes an `ExportBundle` — a flat map of text files
(`report.md`, `session.json`, `actions.json`, `console.json`,
`network.json`, `runtime.json`, `environment.json`, `metadata.json`,
generated by filtering `events` per category) plus a separate map of
binary files (`screenshots/*.png`, kept apart from the text map since
they need to be written as blobs, not strings). `downloadExport(bundle)`
then writes it to disk: it prefers the File System Access API (a real
`browser-debug-session/` folder on disk, matching the file tree in step
3 exactly) and falls back to individual anchor-tag downloads —
flattened, prefixed filenames — in browsers without that API, or if the
user cancels the folder picker.

### UI layer (`ui/Toolbar.tsx`, `ui/RecorderErrorBoundary.tsx`)

Both are thin — neither holds recording state of its own. `Toolbar`
mirrors `store.getStatus()`/`store.subscribe()` and calls
`store.start()`/`pause()`/`resume()`/`stop()`/`clear()` directly; its only
local state is whether it's collapsed (persisted to `localStorage`,
best-effort). `RecorderErrorBoundary` is a real, self-contained
class-component error boundary — `getDerivedStateFromError` catches it,
`componentDidCatch` records it via `captureReactError` (the same
`runtime`-event shape `events/runtime.ts` uses for uncaught exceptions),
and `render` then shows its own `fallback` prop (defaults to `null`)
instead of the crashed subtree. It does not defer to an outer boundary —
nest it inside your own if you need your app's regular fallback UI to
still apply to this subtree.

## Excluding it from production

Gating the mount call site behind a development check (step 1) keeps the
recorder from _running_ in production, but as noted there, a bundler that
traces dynamic imports statically can still put this package's code into
a production bundle on the dead branch. If that matters for your build,
alias the package to `@metyis-porto/ai-debugger-helper/noop` for
production builds instead — e.g. in Next.js, `next.config.ts`'s
`turbopack.resolveAlias`:

```ts
turbopack: process.env.NODE_ENV === 'production'
  ? {
      resolveAlias: {
        '@metyis-porto/ai-debugger-helper': '@metyis-porto/ai-debugger-helper/noop'
      }
    }
  : {};
```

`./noop` (`src/noop.ts`) is a real, shipped entry point — not a stub you
write yourself: it mirrors every function and component in the main entry
point with a same-name, same-type no-op, type-checked against the real
implementation in this package's own CI. Aliasing your bundler's
production resolution to it, instead of hand-rolling a local mirror,
means an API change here is a type error in this package, not a silent
drift discovered after your build ships one.

## Development

Working on the package itself, rather than consuming it:

```bash
pnpm install       # or npm install
pnpm test          # vitest, jsdom environment
pnpm test:coverage # same, with coverage
pnpm typecheck     # tsc --noEmit
pnpm build         # tsc -p tsconfig.json → dist/
```

There's no bundler step beyond `tsc` — the package ships plain compiled
ES modules with declaration files, matched by the `exports` map in
`package.json` (`.` for the main entry, `./noop` for the production-safe
mirror described [above](#excluding-it-from-production)). Every source
file under `src/` outside `types/` has a sibling `*.test.ts(x)`; keep that
pairing when adding new modules.

## License

Not yet set — decide before publishing externally.
