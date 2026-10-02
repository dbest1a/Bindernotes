const prefix = "bindernotes:canvas:v1:";
export type PersonalCanvasMetadata = { layout: string; description: string };
export function encodePersonalCanvasDescription(metadata: PersonalCanvasMetadata) {
  return prefix + JSON.stringify(metadata);
}
export function readPersonalCanvasDescription(description: string | null | undefined): PersonalCanvasMetadata | null {
  if (!description?.startsWith(prefix)) return null;
  try {
    const value = JSON.parse(description.slice(prefix.length));
    return typeof value.layout === "string" && typeof value.description === "string" ? value : null;
  } catch { return null; }
}
