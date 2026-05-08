export function calculateHeatTransfer(input: {
  massG: number;
  specificHeatJPerGC: number;
  deltaTemperatureC: number;
}) {
  return input.massG * input.specificHeatJPerGC * input.deltaTemperatureC;
}

export function describeHeatSign(qJ: number) {
  if (qJ > 0) {
    return "endothermic";
  }
  if (qJ < 0) {
    return "exothermic";
  }
  return "no net heat transfer";
}
