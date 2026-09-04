import { stringifyConsoleArgument } from '../serializers/sanitize.js';
import type { RecorderStore } from '../runtime/store.js';
import type { ConsoleEventDetail } from '../types/index.js';

const SEVERITIES: readonly ConsoleEventDetail['severity'][] = [
  'log',
  'info',
  'warn',
  'error'
];

/** Wraps `console.{log,info,warn,error}` and restores the originals on detach. */
export function attachConsoleCapture(store: RecorderStore): () => void {
  if (typeof console === 'undefined') return () => {};

  const originals = SEVERITIES.map((severity) => console[severity].bind(console));

  SEVERITIES.forEach((severity, index) => {
    console[severity] = (...args: unknown[]) => {
      originals[index]!(...args);
      store.push({
        category: 'console',
        detail: {
          severity,
          arguments: args.map(stringifyConsoleArgument),
          stack: severity === 'error' ? new Error('console.error').stack : undefined
        }
      });
    };
  });

  return () => {
    SEVERITIES.forEach((severity, index) => {
      console[severity] = originals[index]!;
    });
  };
}
