import { API_URL } from "@/constants/backend";
import { clientFetch } from "@/utils/client-fetch";
import { Actor, actorFields } from "./domain";
export async function request(
  endpoint: string,
  body?: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<any> {
  let res: Response;
  try {
    res = await clientFetch(`${API_URL}/${endpoint}`, {
      ...(body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
      signal,
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new Error(
      body
        ? "Connection interrupted. Check the current records before repeating an action."
        : "Could not connect. Check your connection and retry.",
    );
  }
  const raw = await res.text();
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      `The server returned an unreadable response (HTTP ${res.status}). Please retry later.`,
    );
  }
  // Older API releases represented a valid empty current queue as success:false.
  // Normalize ONLY that exact endpoint/shape on a successful HTTP response.
  // Never turn auth/server failures or explicit application errors into emptiness.
  const legacyEmptyQueue =
    res.ok &&
    endpoint.split("?")[0] === "get_current_queue.php" &&
    data?.success === false &&
    data.queue == null &&
    Array.isArray(data.queues) && data.queues.length === 0 &&
    Array.isArray(data.reserved) && data.reserved.length === 0 &&
    !data.message && !data.code && !data.error;
  if (legacyEmptyQueue) {
    return { ...data, success: true, queue: null, queues: [], reserved: [], count: 0 };
  }
  if (!res.ok || data?.success === false)
    throw new Error(data?.message || `Request failed (HTTP ${res.status}).`);
  return data;
}
export const query = (values: Record<string, unknown>) =>
  Object.entries(values)
    .filter(([, v]) => v != null)
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
    )
    .join("&");
export const scopedRead = (
  endpoint: string,
  actor: Actor,
  values: Record<string, unknown> = {},
  signal?: AbortSignal,
) =>
  request(
    `${endpoint}?${query({ ...values, ...actorFields(actor) })}`,
    undefined,
    signal,
  );
export const scopedPost = (
  endpoint: string,
  actor: Actor,
  values: Record<string, unknown> = {},
) => request(endpoint, { ...values, ...actorFields(actor) });
