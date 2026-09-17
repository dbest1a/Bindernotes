import { finite, positive } from "@/lib/chemistry/calculation-validation";

export function calculateHeatTransfer(input: {
  massG: number;
  specificHeatJPerGC: number;
  deltaTemperatureC: number;
}) {
  positive(input.massG, "Mass");
  positive(input.specificHeatJPerGC, "Specific heat capacity");
  finite(input.deltaTemperatureC, "Temperature change");
  return finite(input.massG * input.specificHeatJPerGC * input.deltaTemperatureC, "Calculated heat transfer");
}

export function describeHeatSign(qJ: number) {
  finite(qJ, "Heat transfer");
  if (qJ > 0) {
    return "endothermic";
  }
  if (qJ < 0) {
    return "exothermic";
  }
  return "no net heat transfer";
}
