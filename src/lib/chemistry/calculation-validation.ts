export function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite.`);
  return value;
}

export function positive(value: number, label: string): number {
  finite(value, label);
  if (value <= 0) throw new RangeError(`${label} must be greater than zero.`);
  return value;
}

export function nonnegative(value: number, label: string): number {
  finite(value, label);
  if (value < 0) throw new RangeError(`${label} cannot be negative.`);
  return value;
}

export type CalculationResult<T> = { ok: true; value: T } | { ok: false; message: string };

/** Turn expected input/domain failures into inline feedback; surface programming errors. */
export function validateCalculation<T>(calculate: () => T): CalculationResult<T> {
  try {
    return { ok: true, value: calculate() };
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return { ok: false, message: error.message };
  }
}
