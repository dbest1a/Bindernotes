import { describe, expect, it, vi } from "vitest";
import { UPLOAD_CHUNK_BYTES, uploadResumableFile } from "./resumable-upload";
describe("resumable file transfer", () => {
  it("reconciles an uncertain accepted PATCH with HEAD before sending remaining bytes", async () => {
    const file = new File([new Uint8Array(UPLOAD_CHUNK_BYTES + 17)], "test.pdf");
    let remoteOffset = 0; let location: string | undefined; let fail = true;
    const request = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return new Response(null, { status: 201, headers: { Location: "https://storage.test/storage/v1/upload/resumable/id" } });
      if (init?.method === "HEAD") return new Response(null, { headers: { "Upload-Offset": String(remoteOffset), "Upload-Length": String(file.size) } });
      expect(new Headers(init?.headers).get("Upload-Offset")).toBe(String(remoteOffset));
      remoteOffset += (init?.body as Blob).size;
      if (fail) { fail = false; throw new TypeError("Network dropped after accepting chunk"); }
      return new Response(null, { status: 204, headers: { "Upload-Offset": String(remoteOffset) } });
    });
    const options = { file, endpoint: "https://storage.test/storage/v1/upload/resumable", token: async () => "session", metadata: {}, onLocation: (value: string) => { location = value; } };
    await expect(uploadResumableFile(options, request)).rejects.toThrow("Network dropped");
    expect(remoteOffset).toBe(UPLOAD_CHUNK_BYTES);
    await uploadResumableFile({ ...options, uploadUrl: location }, request);
    expect(remoteOffset).toBe(file.size);
    expect(request.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });
  it("never sends session credentials to a foreign resume URL", async () => {
    const request = vi.fn(); const token = vi.fn();
    await expect(uploadResumableFile({ file: new File(["data"], "test.pdf"), endpoint: "https://storage.test/storage/v1/upload/resumable", uploadUrl: "https://evil.test/upload", token,
      metadata: {}, onLocation: vi.fn() }, request)).rejects.toThrow("invalid resume address");
    expect(token).not.toHaveBeenCalled(); expect(request).not.toHaveBeenCalled();
  });
});
