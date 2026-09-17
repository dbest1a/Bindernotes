import { finite, nonnegative, positive } from "@/lib/chemistry/calculation-validation";

export function calculateDilution(input: { stockM: number; targetM: number; targetVolumeMl: number }) {
  positive(input.stockM, "Stock concentration");
  nonnegative(input.targetM, "Target concentration");
  positive(input.targetVolumeMl, "Target volume");
  if (input.targetM > input.stockM) throw new RangeError("Target concentration cannot exceed stock concentration when diluting.");
  const stockVolumeMl = finite((input.targetM / input.stockM) * input.targetVolumeMl, "Stock volume");
  return { stockVolumeMl, targetVolumeMl: input.targetVolumeMl, fractionOfStock: input.targetM / input.stockM };
}
