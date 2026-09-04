export { RecorderToolbar, type RecorderToolbarProps } from './ui/Toolbar.js';
export {
  RecorderErrorBoundary,
  type RecorderErrorBoundaryProps
} from './ui/RecorderErrorBoundary.js';
export type { RecorderStore } from './runtime/store.js';
export {
  clearRecording,
  disposeRecorder,
  exportRecording,
  getStore,
  getTimeline,
  initializeBrowserDebugRecorder,
  isRecording,
  pauseRecording,
  recordAction,
  resumeRecording,
  startRecording,
  stopRecording
} from './runtime/lifecycle.js';
export * from './types/index.js';
