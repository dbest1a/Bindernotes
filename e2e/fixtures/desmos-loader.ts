import * as actual from "../../src/lib/desmos-loader";
export * from "../../src/lib/desmos-loader";

// Observe the real API in browser checks without changing calculator behavior.
export function getDesmosGraphingConstructor(api: DesmosApi) {
  const create = actual.getDesmosGraphingConstructor(api);
  if (!create) return null;
  return (...args: Parameters<typeof create>) => {
    const calculator = create(...args);
    const diagnostics = { calculator, resizeCalls: 0, setStateCalls: 0, destroyed: false };
    const scope = window as typeof window & { __desmosChecks?: typeof diagnostics[] };
    (scope.__desmosChecks ??= []).push(diagnostics);
    const resize = calculator.resize.bind(calculator);
    calculator.resize = () => { diagnostics.resizeCalls++; resize(); };
    const setState = calculator.setState.bind(calculator);
    calculator.setState = (...parameters) => { diagnostics.setStateCalls++; setState(...parameters); };
    const destroy = calculator.destroy.bind(calculator);
    calculator.destroy = () => { diagnostics.destroyed = true; destroy(); };
    return calculator;
  };
}
