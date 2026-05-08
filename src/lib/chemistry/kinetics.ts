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
  const initial = Math.max(input.initialConcentrationM, 0.001);
  const k = Math.max(input.rateConstant, 0);

  return Array.from({ length: count }, (_, index) => {
    const timeS = (duration / Math.max(count - 1, 1)) * index;
    let concentrationM = initial;
    if (input.order === 0) {
      concentrationM = Math.max(0, initial - k * timeS);
    } else if (input.order === 1) {
      concentrationM = initial * Math.exp(-k * timeS);
    } else {
      concentrationM = 1 / (1 / initial + k * timeS);
    }

    const linearized =
      input.order === 0 ? concentrationM : input.order === 1 ? Math.log(Math.max(concentrationM, 1e-9)) : 1 / Math.max(concentrationM, 1e-9);

    return {
      timeS: Number(timeS.toFixed(1)),
      concentrationM: Number(concentrationM.toFixed(4)),
      linearized: Number(linearized.toFixed(4)),
    };
  });
}
