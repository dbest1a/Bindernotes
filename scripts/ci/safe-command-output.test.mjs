import { describe, expect, it } from "vitest";
import { safeCommandFailure } from "./safe-command-output.mjs";

describe("safe subprocess failure diagnostics", () => {
  it("preserves the failed phase, exit and migration cause", () => {
    const value = safeCommandFailure("supabase", "start", {
      status: 1,
      stderr:
        'Applying migration 0018_backend_performance_layer.sql...\nERROR: extension "pgmq" is not available (SQLSTATE 0A000)\nAt statement 1',
    });
    expect(value).toContain("supabase start failed (exit 1)");
    expect(value).toContain('extension "pgmq" is not available');
    expect(value).toContain("SQLSTATE 0A000");
  });
  it("never includes stdout containing status credentials", () => {
    expect(
      safeCommandFailure("supabase", "status", {
        status: 1,
        stdout: '{"SERVICE_ROLE_KEY":"sensitive-output"}',
        stderr: "Something unrelated",
      }),
    ).not.toContain("sensitive-output");
  });
  it("redacts credentials, DSNs, signed URLs, tokens and SQL values even on an error line", () => {
    const value = safeCommandFailure("supabase", "start", {
      status: 1,
      stderr: [
        "ERROR: password=hunter-secret",
        "failed authorization: Bearer abc123",
        "failed url https://private.test/?token=private-token",
        "ERROR: connect postgres://dbuser:dbpassword@localhost:5432/postgres",
        "ERROR: token eyJabcdefg.abcdefg.abcdefg",
        "ERROR: duplicate row 'private student text'",
        "ERROR: sb_secret_abcdefg",
        "ERROR: sk_test_abcdefg",
        "API key: should-not-print",
      ].join("\n"),
    });
    for (const secret of [
      "hunter-secret",
      "abc123",
      "private-token",
      "dbpassword",
      "eyJabcdefg",
      "private student text",
      "sb_secret_abcdefg",
      "sk_test_abcdefg",
      "should-not-print",
    ])
      expect(value).not.toContain(secret);
  });
  it("bounds diagnostic size and omits raw progress/status", () => {
    const value = safeCommandFailure("supabase", "start", {
      status: 1,
      stderr: [
        "SERVICE_ROLE_KEY=hidden",
        ...Array.from({ length: 100 }, (_, i) => `ERROR ${i} ${"x".repeat(1000)}`),
      ].join("\n"),
    });
    expect(value).not.toContain("hidden");
    expect(value.split("\n")).toHaveLength(26);
    expect(value.length).toBeLessThan(18000);
  });
  it("reports missing binaries without weakening the failing exit", () => {
    expect(
      safeCommandFailure("supabase", "start", { status: null, error: new Error("spawn supabase ENOENT") }),
    ).toContain("ENOENT");
  });
});
