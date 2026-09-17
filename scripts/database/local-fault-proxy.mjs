import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { projectRoot } from "./migration-bundle.mjs";

// Explicit disposable-local browser fault injection. Successes are always real
// upstream Auth/PostgREST responses. Never point this at a hosted service.
assert.equal(process.env.BINDERNOTES_LOCAL_FAULT_TESTING, "true");
const control = path.join(projectRoot, ".tmp", "remediation", "browser-fault.json");
fs.mkdirSync(path.dirname(control), { recursive: true });
fs.writeFileSync(control, JSON.stringify({ mode: "pass" }));
const held = new Set();
const savePaths = new Set(["/rest/v1/rpc/save_personal_content", "/rest/v1/rpc/save_whiteboard_snapshot", "/rest/v1/rpc/save_review_item", "/rest/v1/rpc/save_review_session"]);
function mode() {
  try { const value = JSON.parse(fs.readFileSync(control, "utf8")).mode; return ["pass", "reject", "hold"].includes(value) ? value : "reject"; }
  catch { return "reject"; }
}
const watcher = fs.watch(path.dirname(control), (_event, name) => {
  if (name === path.basename(control) && mode() === "pass") for (const release of held) release();
});
const server = http.createServer((request, response) => {
  const isSave = request.method === "POST" && savePaths.has(request.url?.split("?")[0]);
  if (isSave && mode() === "reject") {
    const origin = request.headers.origin;
    if (origin && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) response.setHeader("access-control-allow-origin", origin);
    response.writeHead(503, { "content-type": "application/json" });
    response.end(JSON.stringify({ message: "Local test connection interrupted. Retry when connectivity returns." }));
    console.log("Injected save connection failure");
    return;
  }
  const upstream = http.request({ hostname: "127.0.0.1", port: 55442, method: request.method, path: request.url, headers: { ...request.headers, host: "127.0.0.1:55442" } }, (remote) => {
    for (const [name, value] of Object.entries(remote.headers)) if (value !== undefined) response.setHeader(name, value);
    if (isSave && mode() === "hold") {
      const chunks = [];
      remote.on("data", (chunk) => chunks.push(chunk));
      remote.on("end", () => {
        const release = () => { held.delete(release); if (!response.destroyed) { response.writeHead(remote.statusCode ?? 502); response.end(Buffer.concat(chunks)); } };
        held.add(release);
        response.on("close", () => held.delete(release));
        console.log("Held real save acknowledgement");
        if (mode() === "pass") release();
      });
    } else { response.writeHead(remote.statusCode ?? 502); remote.pipe(response); }
  });
  upstream.on("error", () => { if (!response.headersSent) response.writeHead(502); response.end(); });
  request.pipe(upstream);
});
server.listen(55443, "127.0.0.1", () => console.log("Disposable browser fault gateway on loopback55443; local control file only"));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { watcher.close(); server.close(); });
