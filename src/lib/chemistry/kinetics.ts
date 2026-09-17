export type KineticsOrder = 0 | 1 | 2;

export type KineticsPoint = {
  timeS: number;
  concentrationM: number;
  linearized: number;
};

export function generateKineticsDataset(input: {
  order: KineticsOrder;
  initialConcentrationM: number;
  rateConstant: number;
  points?: number;
  durationS?: number;
}): KineticsPoint[] {
  const count = input.points ?? 12;
  const duration = input.durationS ?? 120;
  if (![0, 1, 2].includes(input.order)) throw new RangeError("Reaction order must be zero, one, or two.");
  if (!Number.isInteger(count) || count < 2 || count > 10000) throw new RangeError("Use between 2 and 10000 data points.");
  positive(duration, "Duration");
  const initial = positive(input.initialConcentrationM, "Initial concentration");
  const k = nonnegative(input.rateConstant, "Rate constant");

  return Array.from({ length: count }, (_, index) => {
    const timeS = (duration / (count - 1)) * index;
    const decay = finite(k * timeS, "Rate-time product");
    let concentrationM = initial;
    if (input.order === 0) {
      concentrationM = Math.max(0, initial - decay);
    } else if (input.order === 1) {
      concentrationM = positive(initial * Math.exp(-decay), "Calculated concentration");
    } else {
      concentrationM = positive(1 / (1 / initial + decay), "Calculated concentration");
    }

    const linearized =
      input.order === 0 ? concentrationM : input.order === 1 ? Math.log(initial) - decay : 1 / initial + decay;

    return {
      timeS,
      concentrationM,
      linearized: finite(linearized, "Linearized concentration"),
    };
  });
}
import { finite, nonnegative, positive } from "@/lib/chemistry/calculation-validation";
