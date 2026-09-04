/** Monotonic sequence + elapsed-time helpers, kept deterministic and dependency-free. */

export function createSequenceCounter(): () => number {
  let next = 0;
  return () => {
    next += 1;
    return next;
  };
}

export function elapsedSince(startedAtMs: number, nowMs: number): number {
  return Math.max(0, nowMs - startedAtMs);
}
