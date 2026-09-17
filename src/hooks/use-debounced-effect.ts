import { DependencyList, useEffect } from "react";

export function useDebouncedEffect(
  callback: () => void,
  dependencies: DependencyList,
  delay = 700,
) {
  useEffect(() => {
    const timeout = window.setTimeout(callback, delay);
    return () => window.clearTimeout(timeout);
  }, [...dependencies, delay]);
}
