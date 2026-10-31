// Writes scripts/stress/boards/qNN.json from the board definitions.
import { writeBoard } from "./lib.mjs";
import { boards as math } from "./gen-math.mjs";
import { boards as chem } from "./gen-chem.mjs";

const all = { ...math, ...chem };
for (const [number, board] of Object.entries(all)) {
  const path = `scripts/stress/boards/q${String(number).padStart(2, "0")}.json`;
  // Board origin lands at screen (20, 76): below the Excalidraw toolbar at 1440×900, zoom 1.
  writeBoard(path, { question: Number(number), ...board, appState: { scrollX: 20, scrollY: 76, zoom: { value: 1 } } });
}
console.log(`wrote ${Object.keys(all).length} boards`);
