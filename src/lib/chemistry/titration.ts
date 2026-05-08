import { calculateStrongAcidStrongBasePh } from "@/lib/chemistry/titration-lab";

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
  const equivalenceVolume = (input.acidMolarity * input.acidVolumeMl) / input.baseMolarity;
  const points: TitrationCurvePoint[] = [];

  for (let volume = 0; volume <= maxVolume + 1e-9; volume += step) {
    const ph = calculateStrongAcidStrongBasePh({
      acidMolarity: input.acidMolarity,
      acidVolumeMl: input.acidVolumeMl,
      baseMolarity: input.baseMolarity,
      baseVolumeMl: volume,
    });
    points.push({
      volumeMl: Number(volume.toFixed(2)),
      ph: Number(ph.toFixed(2)),
      equivalence: Math.abs(volume - equivalenceVolume) <= step / 2,
    });
  }

  if (!points.some((point) => point.equivalence)) {
    const ph = calculateStrongAcidStrongBasePh({
      acidMolarity: input.acidMolarity,
      acidVolumeMl: input.acidVolumeMl,
      baseMolarity: input.baseMolarity,
      baseVolumeMl: equivalenceVolume,
    });
    points.push({ volumeMl: Number(equivalenceVolume.toFixed(2)), ph: Number(ph.toFixed(2)), equivalence: true });
  }

  return points.sort((a, b) => a.volumeMl - b.volumeMl);
}
