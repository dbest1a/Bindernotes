import { getFramesBounds, getWhiteboardModuleExportFrame, getWhiteboardModuleText } from "@/lib/whiteboards/whiteboard-navigation";
import { sanitizeWhiteboardForStorage } from "@/lib/whiteboards/whiteboard-serialization";
import type { WhiteboardFrame, WhiteboardViewportTransform } from "@/lib/whiteboards/whiteboard-coordinate-utils";
import type { BinderWhiteboard } from "@/lib/whiteboards/whiteboard-types";

export const WHITEBOARD_EXPORT_SCOPE = "SVG includes drawings and static study-card text. Live graphs and calculators are reference cards. JSON preserves board data, live graph state available on this device, and source links; linked lessons stay in their source.";

export function getWhiteboardCanvasBackground(appState: Record<string, unknown> = {}) {
  // Excalidraw dark mode inverts logical colors; the old dark default produced a pale canvas.
  return !appState.viewBackgroundColor || appState.viewBackgroundColor === "#11131a" ? "#ffffff" : appState.viewBackgroundColor;
}

function escapeXml(value: unknown) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
}

function wrapText(text: string, limit: number) {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (line.length + word.length + 1 > limit) { if (line) lines.push(line); line = ""; }
      for (let offset = 0; offset < word.length; offset += limit) {
        const part = word.slice(offset, offset + limit);
        if (offset) { if (line) lines.push(line); line = part; }
        else line += `${line ? " " : ""}${part}`;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export function composeWhiteboardSvg(board: BinderWhiteboard, viewport: WhiteboardViewportTransform, drawing: { svg: string; frame: WhiteboardFrame } | null, sourceText: Record<string, string> = {}) {
  const cards = [...board.modules].sort((a, b) => a.zIndex - b.zIndex).map((module, index) => {
    const frame = getWhiteboardModuleExportFrame(module, viewport);
    const title = module.title || module.noteTitle || module.moduleId.replaceAll("-", " ");
    const text = getWhiteboardModuleText(module, sourceText[module.id]) + (module.savedGraphId || module.moduleId.includes("calculator") || module.moduleId.includes("graph") ? "\nInteractive tool — open in BinderNotes" : "") + (module.lessonId ? `\nSource lesson: ${module.lessonId}` : "");
    const fontSize = Math.min(16, Math.max(10, frame.width / 30));
    const lines = wrapText(text, Math.max(12, Math.floor((frame.width - 32) / (fontSize * 0.6))));
    const maxLines = Math.max(1, Math.floor((frame.height - 72) / (fontSize * 1.45)));
    const shownLines = lines.slice(0, maxLines);
    if (lines.length > maxLines) shownLines[maxLines - 1] = "… Full text remains in its source";
    const clipId = `card-${index}`;
    return { frame, svg: `<g><title>${escapeXml(title)}</title><desc>${escapeXml(text)}</desc><defs><clipPath id="${clipId}"><rect x="${frame.x + 12}" y="${frame.y + 8}" width="${Math.max(1, frame.width - 24)}" height="${Math.max(1, frame.height - 16)}"/></clipPath></defs><rect x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" rx="12" fill="#181b25" stroke="#667085"/><g clip-path="url(#${clipId})" font-family="Arial, sans-serif" fill="#f8fafc"><text x="${frame.x + 16}" y="${frame.y + 30}" font-size="${fontSize + 2}" font-weight="bold">${escapeXml(title)}</text>${shownLines.map((line, i) => `<text x="${frame.x + 16}" y="${frame.y + 58 + i * fontSize * 1.45}" font-size="${fontSize}">${escapeXml(line)}</text>`).join("")}</g></g>` };
  });
  const bounds = getFramesBounds([...(drawing ? [drawing.frame] : []), ...cards.map((card) => card.frame)]);
  const padding = 40, footer = 40;
  const width = bounds.width + padding * 2, height = bounds.height + padding * 2 + footer;
  const background = getWhiteboardCanvasBackground(board.scene.appState);
  const drawingSvg = drawing ? `<svg x="${drawing.frame.x}" y="${drawing.frame.y}" width="${drawing.frame.width}" height="${drawing.frame.height}" viewBox="0 0 ${drawing.frame.width} ${drawing.frame.height}">${drawing.svg}</svg>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${bounds.x - padding} ${bounds.y - padding} ${width} ${height}"><title>${escapeXml(board.title)}</title><desc>${escapeXml(WHITEBOARD_EXPORT_SCOPE)}</desc><rect x="${bounds.x - padding}" y="${bounds.y - padding}" width="${width}" height="${height}" fill="${escapeXml(background)}" style="filter:invert(93%) hue-rotate(180deg)"/>${drawingSvg}${cards.map((card) => card.svg).join("")}<text x="${bounds.x}" y="${bounds.y + bounds.height + 54}" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="12">BinderNotes · Static board snapshot · Interactive tools remain linked</text></svg>`;
}

export function serializeWhiteboardBackup(board: BinderWhiteboard) {
  const modules = board.modules.map((module) => {
    if (module.moduleId !== "desmos-graph" || typeof window === "undefined") return module;
    try {
      const instanceId = module.graphInstanceId?.trim() || `whiteboard-desmos-${module.id}`;
      const raw = localStorage.getItem(`binder-notes:math-lab:v3:${board.ownerId}:${instanceId}`);
      const graphWorkspace = raw ? JSON.parse(raw) : module.graphWorkspace;
      return graphWorkspace ? { ...module, graphWorkspace } : module;
    } catch { return module; }
  });
  const { ownerId: _ownerId, ...portable } = sanitizeWhiteboardForStorage({ ...board, modules });
  return JSON.stringify({ format: "bindernotes-whiteboard", version: 1, exportedAt: new Date().toISOString(), scope: WHITEBOARD_EXPORT_SCOPE, board: portable }, null, 2);
}

export function downloadWhiteboardFile(title: string, extension: string, contents: string, mime: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").slice(0, 120) || "whiteboard"}.${extension}`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
