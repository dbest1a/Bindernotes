import { supabase } from "@/lib/supabase";
import {
  formatTutorialDuration,
  type TutorialCategory,
  type TutorialEntry,
  type TutorialStatus,
} from "@/lib/tutorials/tutorial-registry";

const tutorialVideoBucket = "tutorial-videos";
const tutorialPosterBucket = "tutorial-posters";
const defaultPosterSrc = "/tutorials/posters/bindernotes-tutorial-poster.svg";
const maxTutorialVideoBytes = 500 * 1024 * 1024;
const maxTutorialPosterBytes = 10 * 1024 * 1024;
const allowedTutorialVideoMimeTypes = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);
const allowedTutorialVideoExtensions = new Set([".mp4", ".m4v", ".mov", ".webm"]);
const tutorialVideoContentTypesByExtension = new Map([
  [".m4v", "video/mp4"],
  [".mov", "video/quicktime"],
  [".mp4", "video/mp4"],
  [".webm", "video/webm"],
]);
const allowedTutorialPosterMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const allowedTutorialPosterExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const tutorialPosterContentTypesByExtension = new Map([
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

export type CreateTutorialInput = {
  id: string;
  title: string;
  audience: NonNullable<TutorialEntry["audience"]>;
  category: TutorialCategory;
  routePatterns: string[];
  promptRoutePatterns: string[];
  tags: string[];
  summary: string;
  durationSeconds: number;
  steps: string[];
  transcript: string;
  relatedFeatureLink: string;
  status: TutorialStatus;
};

type TutorialEntryRecord = {
  id: string;
  slug: string;
  title: string;
  audience: NonNullable<TutorialEntry["audience"]>;
  category: TutorialCategory;
  route_patterns: string[] | null;
  prompt_route_patterns: string[] | null;
  tags: string[] | null;
  summary: string | null;
  duration_seconds: number | null;
  video_url: string | null;
  poster_url: string | null;
  steps: string[] | null;
  transcript: string | null;
  related_feature_link: string | null;
  storage_path: string | null;
  poster_storage_path: string | null;
  status: TutorialStatus;
  sort_order: number | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

function tutorialSelect() {
  return [
    "id",
    "slug",
    "title",
    "audience",
    "category",
    "route_patterns",
    "prompt_route_patterns",
    "tags",
    "summary",
    "duration_seconds",
    "video_url",
    "poster_url",
    "steps",
    "transcript",
    "related_feature_link",
    "storage_path",
    "poster_storage_path",
    "status",
    "sort_order",
    "created_by",
    "updated_by",
    "created_at",
    "updated_at",
    "published_at",
  ].join(", ");
}

export function isMissingTutorialLibraryError(error: unknown) {
  const candidate = error as { code?: string; message?: string } | null;
  const message = candidate?.message?.toLowerCase() ?? "";

  return (
    candidate?.code === "42P01" ||
    message.includes("tutorial_entries") ||
    message.includes("tutorial-videos") ||
    message.includes("tutorial-posters") ||
    message.includes("bucket not found")
  );
}

export async function listUploadedTutorials(includeAdminDrafts: boolean): Promise<TutorialEntry[]> {
  if (!supabase) {
    return [];
  }

  let query = supabase
    .from("tutorial_entries")
    .select(tutorialSelect())
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false });

  if (!includeAdminDrafts) {
    query = query.eq("status", "published");
  }

  const { data, error } = await query.returns<TutorialEntryRecord[]>();

  if (error) {
    if (isMissingTutorialLibraryError(error)) {
      return [];
    }
    throw error;
  }

  return (data ?? []).map(recordToTutorialEntry);
}

export async function createUploadedTutorial(
  input: CreateTutorialInput,
  videoFile: File | null,
  posterFile: File | null,
  userId: string,
  existingTutorial: TutorialEntry | null = null,
) {
  if (!supabase) {
    throw new Error("Supabase is required before tutorials can be uploaded.");
  }

  const id = sanitizeTutorialId(input.id);
  if (!videoFile && !existingTutorial?.videoSrc) {
    throw new Error("Choose a tutorial video before creating the tutorial.");
  }
  if (videoFile) {
    validateTutorialAsset(videoFile, {
      allowedExtensions: allowedTutorialVideoExtensions,
      allowedTypes: allowedTutorialVideoMimeTypes,
      compatibleTypePrefix: "video",
      label: "Tutorial video",
      maxBytes: maxTutorialVideoBytes,
    });
  }
  if (posterFile) {
    validateTutorialAsset(posterFile, {
      allowedExtensions: allowedTutorialPosterExtensions,
      allowedTypes: allowedTutorialPosterMimeTypes,
      compatibleTypePrefix: "image",
      label: "Tutorial poster",
      maxBytes: maxTutorialPosterBytes,
    });
  }

  const videoPath = videoFile ? buildAssetPath(id, videoFile.name, "video") : null;
  const videoSrc = videoFile
    ? await uploadTutorialAsset(tutorialVideoBucket, videoPath!, videoFile, tutorialVideoContentTypesByExtension)
    : existingTutorial?.videoSrc ?? "";
  const posterPath = posterFile ? buildAssetPath(id, posterFile.name, "poster") : null;
  const posterSrc = posterFile
    ? await uploadTutorialAsset(tutorialPosterBucket, posterPath!, posterFile, tutorialPosterContentTypesByExtension)
    : existingTutorial?.posterSrc || defaultPosterSrc;
  const now = new Date().toISOString();
  const wasPublished = existingTutorial?.status === "published";
  const publishedAt =
    input.status === "published"
      ? wasPublished
        ? undefined
        : now
      : null;

  const payload = {
    id,
    slug: id,
    title: input.title.trim(),
    audience: input.audience,
    category: input.category,
    route_patterns: input.routePatterns,
    prompt_route_patterns: input.promptRoutePatterns,
    tags: input.tags,
    summary: input.summary.trim(),
    duration_seconds: Math.max(0, Math.round(input.durationSeconds || 0)),
    video_url: videoSrc,
    poster_url: posterSrc,
    steps: input.steps,
    transcript: input.transcript.trim(),
    related_feature_link: normalizeInternalTutorialLink(input.relatedFeatureLink),
    ...(videoPath ? { storage_path: videoPath } : {}),
    ...(posterPath ? { poster_storage_path: posterPath } : {}),
    status: input.status,
    updated_by: userId,
    created_by: userId,
    updated_at: now,
    ...(publishedAt === undefined ? {} : { published_at: publishedAt }),
  };

  const { data, error } = await supabase
    .from("tutorial_entries")
    .upsert(payload, { onConflict: "id" })
    .select(tutorialSelect())
    .single<TutorialEntryRecord>();

  if (error) {
    throw error;
  }

  return recordToTutorialEntry(data);
}

async function uploadTutorialAsset(
  bucket: string,
  path: string,
  file: File,
  contentTypesByExtension: Map<string, string>,
) {
  if (!supabase) {
    throw new Error("Supabase is required before tutorials can be uploaded.");
  }

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    contentType: resolveTutorialContentType(file, contentTypesByExtension),
    upsert: false,
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

function recordToTutorialEntry(record: TutorialEntryRecord): TutorialEntry {
  const durationSeconds = record.duration_seconds ?? 0;
  return {
    id: record.id,
    title: record.title,
    audience: record.audience ?? "all",
    category: record.category,
    routePatterns: record.route_patterns ?? [],
    promptRoutePatterns: record.prompt_route_patterns ?? [],
    tags: record.tags ?? [],
    summary: record.summary ?? "",
    durationSeconds,
    duration: formatTutorialDuration(durationSeconds),
    videoSrc: record.video_url ?? "",
    posterSrc: record.poster_url || defaultPosterSrc,
    status: record.status,
    steps: record.steps ?? [],
    transcript: record.transcript ?? "",
    relatedFeatureLink: normalizeInternalTutorialLink(record.related_feature_link),
  };
}

function validateTutorialAsset(
  file: File,
  options: {
    allowedExtensions: Set<string>;
    allowedTypes: Set<string>;
    compatibleTypePrefix: "image" | "video";
    label: string;
    maxBytes: number;
  },
) {
  const normalizedType = file.type.toLowerCase();
  const extension = getFileExtension(file.name);
  const hasAllowedType = Boolean(normalizedType) && options.allowedTypes.has(normalizedType);
  const hasAllowedExtension = Boolean(extension) && options.allowedExtensions.has(extension);
  const hasCompatibleFallbackType =
    !normalizedType ||
    normalizedType === "application/octet-stream" ||
    normalizedType.startsWith(`${options.compatibleTypePrefix}/`);

  if (!hasAllowedType && !(hasAllowedExtension && hasCompatibleFallbackType)) {
    throw new Error(`${options.label} must use an allowed file type.`);
  }

  if (file.size > options.maxBytes) {
    throw new Error(`${options.label} is larger than the allowed upload size.`);
  }
}

export function normalizeInternalTutorialLink(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return "/tutorial";
  }

  try {
    const parsed = new URL(trimmed, "https://bindernotes.local");
    if (parsed.origin !== "https://bindernotes.local") {
      return "/tutorial";
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/tutorial";
  }
}

function buildAssetPath(tutorialId: string, fileName: string, kind: "poster" | "video") {
  const extension = getFileExtension(fileName);
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${tutorialId}/${kind}-${uniqueSuffix}${extension}`;
}

function getFileExtension(fileName: string) {
  const extension = fileName.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase();
  return extension ?? "";
}

function resolveTutorialContentType(file: File, contentTypesByExtension: Map<string, string>) {
  const normalizedType = file.type.toLowerCase();
  const extension = getFileExtension(file.name);
  if (normalizedType && normalizedType !== "application/octet-stream") {
    return normalizedType;
  }

  return contentTypesByExtension.get(extension) ?? (normalizedType || undefined);
}

export function sanitizeTutorialId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
