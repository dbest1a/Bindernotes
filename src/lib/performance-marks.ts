export function markDevPerformance(name: string) {
  if (!import.meta.env.DEV || typeof performance === "undefined" || !performance.mark) {
    return;
  }

  performance.mark(`bindernotes:${name}`);
}

export function measureDevPerformance<T>(name: string, work: () => T): T {
  if (!import.meta.env.DEV || typeof performance === "undefined" || !performance.mark || !performance.measure) {
    return work();
  }

  const startMark = `bindernotes:${name}:start`;
  const endMark = `bindernotes:${name}:end`;
  performance.mark(startMark);
  const result = work();
  performance.mark(endMark);
  performance.measure(`bindernotes:${name}`, startMark, endMark);
  return result;
}
