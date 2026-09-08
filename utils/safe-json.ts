/**
 * Safe JSON helpers — never throw on empty / non-JSON responses.
 * The mobile app was logging "JSON Parse error: Unexpected end of input"
 * whenever an endpoint returned an empty body or HTML error page.
 */

export async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text || !text.trim()) {
    return { success: false, message: 'Empty response from server' };
  }
  try {
    return JSON.parse(text);
  } catch {
    console.warn(
      'Non-JSON response from',
      res.url,
      'status',
      res.status,
      'body starts with:',
      text.slice(0, 120)
    );
    return {
      success: false,
      message: `Invalid JSON (HTTP ${res.status})`,
      _raw: text.slice(0, 200),
    };
  }
}

export function safeParseStorage(raw: string | null): any | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
