/** Decimal/scientific notation only: blank input is never an implicit zero. */
export function parseFiniteDecimal(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return null;
  // Reject nonzero values that underflow to zero rather than awarding zero credit.
  if (parsed === 0 && /[1-9]/.test(text.split(/e/i)[0])) return null;
  return parsed;
}

export function requireFiniteDecimal(value: unknown, label: string): number {
  const parsed = parseFiniteDecimal(value);
  if (parsed === null) throw new RangeError(`${label} must be a finite number.`);
  return parsed;
}

/** Compare decimal values exactly at the advertised inclusive tolerance boundary. */
export function withinDecimalTolerance(actual: number, expected: number, tolerance: number): boolean {
  if (![actual, expected, tolerance].every(Number.isFinite) || tolerance < 0) return false;
  if (tolerance === 0) return actual === expected;
  const parts = [actual, expected, tolerance].map((value) => {
    const [mantissa, exponent = "0"] = value.toString().split("e");
    const decimals = mantissa.split(".")[1]?.length ?? 0;
    return { integer: BigInt(mantissa.replace(".", "")), power: Number(exponent) - decimals };
  });
  const commonPower = Math.min(...parts.map((part) => part.power));
  const [actualInteger, expectedInteger, toleranceInteger] = parts.map(
    (part) => part.integer * 10n ** BigInt(part.power - commonPower),
  );
  const difference = actualInteger - expectedInteger;
  return (difference < 0n ? -difference : difference) <= toleranceInteger;
}
