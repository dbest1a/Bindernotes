export const AUTH_SESSION_VALIDATION_EVENT = "bindernotes:validate-server-session";
/** Request a server check on expired/explicitly revoked data actions. Do not
 * consume the response or create a loop from the status RPC itself. */
export async function sessionAwareFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (typeof window !== "undefined" && [401, 403].includes(response.status)) {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.includes("/rpc/get_account_session_status")) {
      const body: unknown = await response
        .clone()
        .json()
        .catch(() => null);
      const revoked =
        body &&
        typeof body === "object" &&
        "message" in body &&
        String(body.message).includes("ACCOUNT_SESSION_REVOKED");
      if (response.status === 401 || revoked) window.dispatchEvent(new Event(AUTH_SESSION_VALIDATION_EVENT));
    }
  }
  return response;
}
