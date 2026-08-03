type QueryArgs = Record<string, string | number | boolean | null | undefined>;

export interface FrappeCallError extends Error {
  status?: number;
  exc_type?: string;
  exc?: unknown;
  messages: string[];
}

function buildUrl(method: string, args: QueryArgs): string {
  const path = method.startsWith("/") ? method : `/api/method/${method}`;
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null) continue;
    params.append(key, String(value));
  }

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function extractMessages(payload: Record<string, any>): string[] {
  let messages: unknown[] = [];
  try {
    messages = payload._server_messages ? JSON.parse(payload._server_messages) : [];
  } catch {
    messages = [];
  }

  const parsed = messages
    .concat(payload.message)
    .map((entry) => {
      try {
        return JSON.parse(entry as string).message;
      } catch {
        return entry;
      }
    })
    .filter(Boolean)
    .map(String);

  if (parsed.length) return parsed;
  return payload._error_message ? [String(payload._error_message)] : ["Internal Server Error"];
}

function toCallError(method: string, status: number, body: string): FrappeCallError {
  let payload: Record<string, any> = {};
  try {
    payload = JSON.parse(body) ?? {};
  } catch {
    payload = {};
  }

  const error = new Error(
    [method, payload.exc_type, payload._error_message].filter(Boolean).join(" ")
  ) as FrappeCallError;

  error.status = status;
  error.exc_type = payload.exc_type;
  error.messages = extractMessages(payload);

  if (payload.exc) {
    try {
      error.exc = JSON.parse(payload.exc)[0];
    } catch {
      error.exc = payload.exc;
    }
  }

  return error;
}

export async function getCall<T>(method: string, args: QueryArgs = {}): Promise<T> {
  const res = await fetch(buildUrl(method, args), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Frappe-Site-Name": window.location.hostname,
    },
  });

  if (!res.ok) {
    throw toCallError(method, res.status, await res.text());
  }

  const data = await res.json();
  return data.message as T;
}
