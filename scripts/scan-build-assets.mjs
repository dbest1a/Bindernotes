import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";

const distDir = join(process.cwd(), "dist");
const assetsDir = join(distDir, "assets");
const indexHtmlPath = join(distDir, "index.html");
const mainEntryMaxBytes = Number(process.env.BINDERNOTES_MAIN_ENTRY_BUDGET_BYTES ?? 815_000);

const files = collectFiles(assetsDir)
  .filter((file) => /\.(js|css)$/.test(file))
  .map((file) => {
    const source = readFileSync(file);
    return {
      path: file,
      name: relative(distDir, file).replaceAll("\\", "/"),
      bytes: source.length,
      gzipBytes: gzipSync(source).length,
    };
  })
  .sort((a, b) => b.bytes - a.bytes);

const indexHtml = readFileSync(indexHtmlPath, "utf8");
const mainJsName = indexHtml.match(/<script[^>]+src="\/?([^"]+\.js)"/)?.[1] ?? null;
const stylesheetNames = Array.from(
  indexHtml.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="\/?([^"]+\.css)"/g),
  (match) => match[1],
);
const mainCssName =
  stylesheetNames.find((name) => /assets\/index-.*\.css$/.test(name)) ??
  stylesheetNames.at(-1) ??
  null;
const initialAssetNames = Array.from(
  indexHtml.matchAll(/(?:src|href)="\/?(assets\/[^"]+\.(?:js|css))"/g),
  (match) => match[1],
);

const mainEntry = mainJsName ? files.find((file) => file.name === mainJsName) ?? null : null;
const mainCss = mainCssName ? files.find((file) => file.name === mainCssName) ?? null : null;
const whiteboardChunk = findLargestJs(/whiteboard-(engine|module)|excalidraw/i);
const whiteboardCss = findLargestCss(/whiteboard-(engine|module)|excalidraw/i);
const mermaidChunk = findLargestJs(/mermaid|diagram/i);
const richEditorChunk = findLargestJs(/rich-text-editor|tiptap/i);

console.log("Build asset scan");
console.log("================");
console.log(formatHighlight("main entry", mainEntry));
console.log(formatHighlight("main CSS", mainCss));
console.log(formatHighlight("whiteboard chunk", whiteboardChunk));
console.log(formatHighlight("whiteboard CSS", whiteboardCss));
console.log(formatHighlight("mermaid chunk", mermaidChunk));
console.log(formatHighlight("rich editor chunk", richEditorChunk));
console.log("");
console.log("Largest JS/CSS assets:");
for (const file of files.slice(0, 16)) {
  console.log(`- ${file.name}: ${formatBytes(file.bytes)} / ${formatBytes(file.gzipBytes)} gzip`);
}

const failures = [];
if (!mainEntry) {
  failures.push("main entry script could not be identified from dist/index.html");
} else if (mainEntry.bytes > mainEntryMaxBytes) {
  failures.push(
    `main entry ${formatBytes(mainEntry.bytes)} exceeds budget ${formatBytes(mainEntryMaxBytes)}`,
  );
}

if (!whiteboardChunk) {
  console.log("Note: no named whiteboard chunk was found; this is only OK if whiteboard code was not emitted.");
}

const forbiddenInitialAssets = initialAssetNames.filter((name) =>
  /whiteboard|excalidraw|rich-text-editor|tiptap|mermaid|workspace-settings/i.test(name),
);
if (forbiddenInitialAssets.length > 0) {
  failures.push(
    `heavy lazy assets are referenced by dist/index.html: ${forbiddenInitialAssets.join(", ")}`,
  );
}

if (failures.length > 0) {
  console.error("");
  console.error("Build asset scan failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

function collectFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? collectFiles(path) : [path];
  });
}

function findLargest(pattern) {
  return files.filter((file) => pattern.test(file.name)).sort((a, b) => b.bytes - a.bytes)[0] ?? null;
}

function findLargestJs(pattern) {
  return files
    .filter((file) => file.name.endsWith(".js") && pattern.test(file.name))
    .sort((a, b) => b.bytes - a.bytes)[0] ?? null;
}

function findLargestCss(pattern) {
  return files
    .filter((file) => file.name.endsWith(".css") && pattern.test(file.name))
    .sort((a, b) => b.bytes - a.bytes)[0] ?? null;
}

function formatHighlight(label, file) {
  if (!file) {
    return `${label}: not found`;
  }

  return `${label}: ${file.name} ${formatBytes(file.bytes)} / ${formatBytes(file.gzipBytes)} gzip`;
}

function formatBytes(bytes) {
  return `${(bytes / 1000).toFixed(2)} kB`;
}
