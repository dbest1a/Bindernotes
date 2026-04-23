import { DependencyList, useEffect } from "react";

export function useDebouncedEffect(
  callback: () => void,
  dependencies: DependencyList,
  delay = 700,
) {
  useEffect(() => {
    const timeout = window.setTimeout(callback, delay);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, delay]);
}
