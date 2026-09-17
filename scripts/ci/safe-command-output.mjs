import path from "node:path";
import { stripVTControlCharacters } from "node:util";

// Supabase start/status may print local signing keys and DB credentials. Never
// emit stdout or an entire debug log merely to diagnose a failed child process.
export function safeCommandFailure(binary, phase, result) {
  const stderr = String(result.stderr ?? result.error?.message ?? "");
  const lines = stderr
    .split(/\r?\n/)
    .map(redact)
    .filter((line) =>
      /error|fatal|failed|sqlstate|not available|does not exist|permission denied|unhealthy|cannot|connection refused|Applying migration|At statement|ENOENT|ENOBUFS|ETIMEDOUT/i.test(
        line,
      ),
    )
    .slice(-25);
  return (
    `${path.basename(binary)} ${phase} failed (exit ${result.status ?? "unavailable"}${result.signal ? `, signal ${result.signal}` : ""}).` +
    (lines.length
      ? `\n${lines.join("\n")}`
      : " No safe error lines were available; stdout and unrelated diagnostics withheld.")
  );
}

function redact(line) {
  return stripVTControlCharacters(line)
    .replace(/(?:https?|postgres(?:ql)?):\/\/[^\s)]+/gi, "[URL REDACTED]")
    .replace(
      /\b(?:eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|sb_(?:secret|publishable)_[A-Za-z0-9_-]+|(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9_-]+)\b/g,
      "[TOKEN REDACTED]",
    )
    .replace(
      /((?:authorization|password|passwd|secret|token|api[_ -]?key|anon[_ -]?key|service[_ -]?role[_ -]?key|jwt[_ -]?secret)\s*[:=]\s*).*/gi,
      "$1[REDACTED]",
    )
    .replace(/'(?:''|[^'])*'/g, "'[VALUE REDACTED]'")
    .slice(0, 700);
}
