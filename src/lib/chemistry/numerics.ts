export const STANDARD_CONCENTRATION = 1000;
export const GAS_CONSTANT = 8.31446261815324;
export const FARADAY_CONSTANT = 96485.33212;

export function finite(value: number, label: string, minimum = -Infinity): number {
  if (!Number.isFinite(value) || value < minimum) {
    throw new Error(`${label} must be a finite number${minimum > -Infinity ? ` of at least ${minimum}` : ""}.`);
  }
  return value;
}

export function positive(value: number, label: string): number {
  finite(value, label, 0);
  if (value === 0) throw new Error(`${label} must be greater than zero.`);
  return value;
}

export function bisectRoot(residual: (value: number) => number, lower: number, upper: number, tolerance = 1e-10): number {
  let left = lower;
  let right = upper;
  let leftValue = residual(left);
  const rightValue = residual(right);
  if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) throw new Error("The equilibrium calculation exceeded its numerical range.");
  if (leftValue === 0) return left;
  if (rightValue === 0) return right;
  if (Math.sign(leftValue) === Math.sign(rightValue)) throw new Error("No equilibrium was bracketed in the supported range. Check amounts, charges and constants.");
  for (let iteration = 0; iteration < 200; iteration += 1) {
    const middle = (left + right) / 2;
    const middleValue = residual(middle);
    if (!Number.isFinite(middleValue)) throw new Error("The equilibrium calculation exceeded its numerical range.");
    if (middleValue === 0 || right - left < tolerance) return middle;
    if (Math.sign(middleValue) === Math.sign(leftValue)) {
      left = middle;
      leftValue = middleValue;
    } else right = middle;
  }
  throw new Error("The equilibrium calculation did not converge.");
}
