import { calculateStrongAcidStrongBasePh } from "@/lib/chemistry/titration-lab";
import { nonnegative, positive } from "@/lib/chemistry/calculation-validation";

export type TitrationCurvePoint = {
  volumeMl: number;
  ph: number;
  equivalence: boolean;
};

export function generateStrongAcidStrongBaseCurve(input: {
  acidMolarity: number;
  acidVolumeMl: number;
  baseMolarity: number;
  maxBaseVolumeMl?: number;
  stepMl?: number;
}): TitrationCurvePoint[] {
  const step = input.stepMl ?? 2.5;
  const maxVolume = input.maxBaseVolumeMl ?? 50;
  positive(step, "Titration step");
  nonnegative(maxVolume, "Maximum base volume");
  positive(input.acidMolarity, "Acid molarity");
  positive(input.baseMolarity, "Base molarity");
  positive(input.acidVolumeMl, "Initial acid volume");
  const count = Math.floor(maxVolume / step) + 1;
  if (!Number.isSafeInteger(count) || count > 10000) throw new RangeError("Use at most 10000 titration samples.");
  const equivalenceVolume = positive((input.acidMolarity / input.baseMolarity) * input.acidVolumeMl, "Equivalence volume");
  const volumes = Array.from({ length: count }, (_, index) => index * step);
  if (equivalenceVolume <= maxVolume && !volumes.includes(equivalenceVolume)) volumes.push(equivalenceVolume);

  return volumes.sort((a, b) => a - b).map((volume) => {
    const ph = calculateStrongAcidStrongBasePh({
      acidMolarity: input.acidMolarity,
      acidVolumeMl: input.acidVolumeMl,
      baseMolarity: input.baseMolarity,
      baseVolumeMl: volume,
    });
    return {
      volumeMl: volume,
      ph: Number(ph.toFixed(2)),
      equivalence: volume === equivalenceVolume,
    };
  });
}
