export type ListenerSpec = {
  readonly target: EventTarget;
  readonly type: string;
  readonly listener: EventListener;
  readonly options?: AddEventListenerOptions;
};

/**
 * Registers every spec and returns one closure that removes them all — the
 * shared shape every DOM-listener-based `attach*Capture` was hand-rolling
 * (register N listeners, return a cleanup that reverses them).
 */
export function attachListeners(specs: readonly ListenerSpec[]): () => void {
  for (const { target, type, listener, options } of specs)
    target.addEventListener(type, listener, options);
  return () => {
    for (const { target, type, listener, options } of specs)
      target.removeEventListener(type, listener, options);
  };
}
