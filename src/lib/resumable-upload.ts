export const UPLOAD_CHUNK_BYTES = 6 * 1024 * 1024;
type UploadOptions = {
  file: File;
  endpoint: string;
  token: () => Promise<string>;
  metadata: Record<string, string>;
  uploadUrl?: string;
  onLocation: (url: string) => void;
  onProgress?: (bytes: number) => void;
  signal?: AbortSignal;
};
/** TUS1.0: an uncertain PATCH is reconciled by HEAD on the next attempt. */
export async function uploadResumableFile(options: UploadOptions, request: typeof fetch = fetch) {
  const endpoint = new URL(options.endpoint);
  const checkedLocation = (value: string) => {
    const url = new URL(value, endpoint);
    if (
      url.origin !== endpoint.origin ||
      !url.pathname.startsWith(endpoint.pathname + "/") ||
      url.username ||
      url.password
    )
      throw new Error("The upload server returned an invalid resume address.");
    return url.href;
  };
  const headers = async () => ({
    Authorization: `Bearer ${await options.token()}`,
    "Tus-Resumable": "1.0.0",
    "x-upsert": "false",
  });
  let location = options.uploadUrl ? checkedLocation(options.uploadUrl) : null;
  let offset = 0;
  if (location) {
    const response = await request(location, {
      method: "HEAD",
      headers: await headers(),
      signal: options.signal,
      redirect: "error",
    });
    if (response.status === 404 || response.status === 410) location = null;
    else {
      if (!response.ok)
        throw new Error("The upload could not resume. Sign in again or retry when connected.");
      const offsetHeader = response.headers.get("Upload-Offset");
      offset = Number(offsetHeader);
      const length = response.headers.get("Upload-Length");
      if (
        offsetHeader === null ||
        !Number.isSafeInteger(offset) ||
        offset < 0 ||
        offset > options.file.size ||
        (length !== null && Number(length) !== options.file.size)
      )
        throw new Error("The upload server reported an invalid resume offset.");
    }
  }
  if (!location) {
    const metadata = Object.entries(options.metadata)
      .map(([key, value]) => `${key} ${btoa(value)}`)
      .join(",");
    const response = await request(endpoint, {
      method: "POST",
      headers: {
        ...(await headers()),
        "Upload-Length": String(options.file.size),
        "Upload-Metadata": metadata,
      },
      signal: options.signal,
      redirect: "error",
    });
    const next = response.headers.get("Location");
    if (response.status !== 201 || !next)
      throw new Error("The upload could not start. Your file remains on this device; retry when connected.");
    location = checkedLocation(next);
    options.onLocation(location);
  }
  options.onProgress?.(offset);
  while (offset < options.file.size) {
    const end = Math.min(offset + UPLOAD_CHUNK_BYTES, options.file.size);
    const response = await request(location, {
      method: "PATCH",
      headers: {
        ...(await headers()),
        "Upload-Offset": String(offset),
        "Content-Type": "application/offset+octet-stream",
      },
      body: options.file.slice(offset, end),
      signal: options.signal,
      redirect: "error",
    });
    if (response.status !== 204 || Number(response.headers.get("Upload-Offset")) !== end)
      throw new Error("Upload interrupted. Select the same file to resume safely.");
    offset = end;
    options.onProgress?.(offset);
  }
  return location;
}
