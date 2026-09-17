// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    storage: {
      from: vi.fn(),
    },
    from: vi.fn(),
  },
}));

import {
  createUploadedTutorial,
  reconcilePendingTutorialUploads,
  normalizeInternalTutorialLink,
} from "@/services/tutorial-service";
import { supabase } from "@/lib/supabase";

const validTutorialInput = {
  id: "safe-tutorial",
  title: "Safe tutorial",
  audience: "all" as const,
  category: "Dashboard" as const,
  routePatterns: ["/dashboard"],
  promptRoutePatterns: ["/dashboard"],
  tags: ["dashboard"],
  summary: "A tutorial.",
  durationSeconds: 10,
  steps: ["Open Dashboard"],
  transcript: "Transcript",
  relatedFeatureLink: "/dashboard",
  status: "published" as const,
};

const supabaseMock = supabase as unknown as {
  storage: {
    from: ReturnType<typeof vi.fn>;
  };
  from: ReturnType<typeof vi.fn>;
};

function mockSuccessfulTutorialSave() {
  let savedPayload: Record<string, unknown> | null = null;
  const upload = vi.fn().mockResolvedValue({ error: null });
  const getPublicUrl = vi.fn((path: string) => ({
    data: { publicUrl: `https://storage.example.test/${path}` },
  }));
  const single = vi.fn(async () => ({
    data: {
      ...savedPayload,
      created_at: "2026-05-12T00:00:00.000Z",
      sort_order: 1000,
      updated_at: "2026-05-12T00:00:00.000Z",
    },
    error: null,
  }));
  const select = vi.fn(() => ({ single }));
  const upsert = vi.fn((payload: Record<string, unknown>) => {
    savedPayload = payload;
    return { select };
  });

  supabaseMock.storage.from.mockReturnValue({ upload, getPublicUrl });
  supabaseMock.from.mockReturnValue({ upsert });

  return { getPublicUrl, single, upload, upsert };
}

describe("tutorial service security hardening", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    supabaseMock.storage.from.mockReset();
    supabaseMock.from.mockReset();
  });

  it("keeps tutorial feature links app-relative", () => {
    expect(normalizeInternalTutorialLink("/dashboard?from=tutorial#top")).toBe(
      "/dashboard?from=tutorial#top",
    );
    expect(normalizeInternalTutorialLink("javascript:alert(1)")).toBe("/tutorial");
    expect(normalizeInternalTutorialLink("//evil.test/path")).toBe("/tutorial");
    expect(normalizeInternalTutorialLink("https://evil.test/path")).toBe("/tutorial");
    expect(normalizeInternalTutorialLink("/\\evil")).toBe("/tutorial");
  });

  it("rejects unexpected tutorial video MIME types before upload", async () => {
    const htmlFile = new File(["<script>alert(1)</script>"], "lesson.html", {
      type: "text/html",
    });

    await expect(createUploadedTutorial(validTutorialInput, htmlFile, null, "user-1")).rejects.toThrow(
      "Tutorial video must use an allowed file type.",
    );
  });

  it("rejects unexpected tutorial poster MIME types before upload", async () => {
    const videoFile = new File(["video"], "lesson.mp4", {
      type: "video/mp4",
    });
    const svgFile = new File(["<svg><script>alert(1)</script></svg>"], "poster.svg", {
      type: "image/svg+xml",
    });

    await expect(createUploadedTutorial(validTutorialInput, videoFile, svgFile, "user-1")).rejects.toThrow(
      "Tutorial poster must use an allowed file type.",
    );
  });

  it("uploads admin video files as new public storage objects without overwrite upsert", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_770_000_000_000);
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);
    const { upload, upsert } = mockSuccessfulTutorialSave();
    const videoFile = new File(["video"], "admin walkthrough.mp4", {
      type: "video/mp4",
    });

    const tutorial = await createUploadedTutorial(validTutorialInput, videoFile, null, "admin-1");

    const uploadedPath = upload.mock.calls[0]?.[0] as string;
    expect(uploadedPath).toMatch(/^safe-tutorial\/video-1770000000000-[a-z0-9]+\.mp4$/);
    expect(upload.mock.calls[0]?.[2]).toMatchObject({
      cacheControl: "3600",
      contentType: "video/mp4",
      upsert: false,
    });
    expect(upsert.mock.calls[0]?.[0]).toMatchObject({
      created_by: "admin-1",
      id: "safe-tutorial",
      status: "published",
      storage_path: uploadedPath,
      updated_by: "admin-1",
      video_url: `https://storage.example.test/${uploadedPath}`,
    });
    expect(tutorial.videoSrc).toBe(`https://storage.example.test/${uploadedPath}`);
    expect(tutorial.status).toBe("published");
  });

  it("accepts browser-local video files when the browser omits the MIME type", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_770_000_000_001);
    vi.spyOn(Math, "random").mockReturnValue(0.223456789);
    const { upload } = mockSuccessfulTutorialSave();
    const videoFile = new File(["video"], "local-recording.MP4", {
      type: "",
    });

    await createUploadedTutorial(validTutorialInput, videoFile, null, "admin-1");

    expect(upload.mock.calls[0]?.[0]).toMatch(/\.mp4$/);
    expect(upload.mock.calls[0]?.[2]).toMatchObject({
      contentType: "video/mp4",
      upsert: false,
    });
  });

  it("keeps the browser-provided video MIME type when the extension disagrees", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_770_000_000_002);
    vi.spyOn(Math, "random").mockReturnValue(0.323456789);
    const { upload } = mockSuccessfulTutorialSave();
    const videoFile = new File(["video"], "renamed-recording.mp4", {
      type: "video/webm",
    });

    await createUploadedTutorial(validTutorialInput, videoFile, null, "admin-1");

    expect(upload.mock.calls[0]?.[2]).toMatchObject({
      contentType: "video/webm",
      upsert: false,
    });
  });

  it("rejects non-video MIME types even when the extension looks like a video", async () => {
    const misleadingFile = new File(["<script>alert(1)</script>"], "lesson.mp4", {
      type: "text/html",
    });

    await expect(createUploadedTutorial(validTutorialInput, misleadingFile, null, "user-1")).rejects.toThrow(
      "Tutorial video must use an allowed file type.",
    );
  });
  it("removes uploaded objects only after metadata read proves they are unreferenced", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null }),
      remove = vi.fn().mockResolvedValue({ error: null });
    supabaseMock.storage.from.mockReturnValue({
      upload,
      remove,
      getPublicUrl: (path: string) => ({ data: { publicUrl: path } }),
    });
    const failure = { message: "metadata rejected" };
    supabaseMock.from.mockReturnValue({
      upsert: () => ({ select: () => ({ single: async () => ({ data: null, error: failure }) }) }),
      select: () => ({ eq: () => ({ limit: async () => ({ data: [], error: null }) }) }),
    });
    await expect(
      createUploadedTutorial(
        validTutorialInput,
        new File(["video"], "test.mp4", { type: "video/mp4" }),
        null,
        "admin-1",
      ),
    ).rejects.toEqual(failure);
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
    expect(localStorage.length).toBe(0);
  });
  it("never deletes an object referenced by a committed write whose acknowledgement was lost", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null }),
      remove = vi.fn();
    supabaseMock.storage.from.mockReturnValue({
      upload,
      remove,
      getPublicUrl: (path: string) => ({ data: { publicUrl: path } }),
    });
    supabaseMock.from.mockReturnValue({
      upsert: () => ({
        select: () => ({ single: async () => ({ data: null, error: new Error("lost acknowledgement") }) }),
      }),
      select: () => ({
        eq: () => ({ limit: async () => ({ data: [{ id: "safe-tutorial" }], error: null }) }),
      }),
    });
    await expect(
      createUploadedTutorial(
        validTutorialInput,
        new File(["video"], "test.mp4", { type: "video/mp4" }),
        null,
        "admin-1",
      ),
    ).rejects.toThrow("lost acknowledgement");
    expect(remove).not.toHaveBeenCalled();
  });
  it("retains a durable cleanup journal when reference lookup is unavailable, then retries", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null }),
      remove = vi.fn().mockResolvedValue({ error: null });
    supabaseMock.storage.from.mockReturnValue({
      upload,
      remove,
      getPublicUrl: (path: string) => ({ data: { publicUrl: path } }),
    });
    const lookup = vi.fn().mockResolvedValue({ data: null, error: new Error("offline") });
    supabaseMock.from.mockReturnValue({
      upsert: () => ({
        select: () => ({ single: async () => ({ data: null, error: new Error("write failed") }) }),
      }),
      select: () => ({ eq: () => ({ limit: lookup }) }),
    });
    await expect(
      createUploadedTutorial(
        validTutorialInput,
        new File(["video"], "test.mp4", { type: "video/mp4" }),
        null,
        "admin-1",
      ),
    ).rejects.toThrow("write failed");
    expect(remove).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(1);
    lookup.mockResolvedValue({ data: [], error: null });
    await reconcilePendingTutorialUploads("admin-1");
    expect(remove).toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });
});
