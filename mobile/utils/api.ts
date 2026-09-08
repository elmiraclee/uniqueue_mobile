/**
 * Safe JSON fetch helpers.
 * Prevents "JSON Parse error: Unexpected end of input" when the server
 * returns an empty body, HTML error page, or non-JSON response.
 * Also retries once on empty HTTP 5xx (common on shared hosting under load).
 */

export type ApiResult<T = any> = {
  ok: boolean;
  status: number;
  data: T | null;
  raw: string;
  error?: string;
};

async function fetchOnce(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<ApiResult> {
  try {
    const res = await fetch(input, init);
    const raw = await res.text();

    if (!raw || !raw.trim()) {
      return {
        ok: false,
        status: res.status,
        data: null,
        raw: '',
        error: `Empty response (HTTP ${res.status})`,
      };
    }

    try {
      const data = JSON.parse(raw);
      return {
        ok: res.ok,
        status: res.status,
        data,
        raw,
      };
    } catch (parseErr) {
      return {
        ok: false,
        status: res.status,
        data: null,
        raw,
        error: `Invalid JSON (HTTP ${res.status}): ${String(parseErr)}`,
      };
    }
  } catch (e) {
    return {
      ok: false,
      status: 0,
      data: null,
      raw: '',
      error: String(e),
    };
  }
}

export async function safeFetchJson(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<ApiResult> {
  let result = await fetchOnce(input, init);

  // Shared hosts sometimes return empty 500 under concurrent load.
  // Retry once after a short delay.
  if (
    !result.data &&
    result.status >= 500 &&
    (!result.raw || !result.raw.trim())
  ) {
    await new Promise((r) => setTimeout(r, 400));
    result = await fetchOnce(input, init);
  }

  return result;
}

/** Convenience: returns data on success, null + logs on failure. */
export async function fetchJsonOrNull(
  input: RequestInfo | URL,
  init?: RequestInit,
  logLabel?: string
): Promise<any | null> {
  const result = await safeFetchJson(input, init);
  if (!result.data) {
    if (logLabel) {
      console.log(`${logLabel}:`, result.error || 'No data');
    }
    return null;
  }
  return result.data;
}
