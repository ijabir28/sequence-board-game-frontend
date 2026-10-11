// Thin fetch wrapper for the backend. All requests are same-origin (Vite proxies them to
// :3000), so the session cookie is sent automatically.

export type ApiErrorKind = 'network' | 'server' | 'unexpected';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const SERVER_UNREACHABLE =
  "Can't reach the game server. Start the backend on port 3000 (npm start in sequence-board-game), then try again.";

/** fetch() that turns network failures and proxy errors into a readable ApiError. */
export async function request(path: string, init: RequestInit = {}): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(path, { credentials: 'same-origin', ...init });
  } catch {
    throw new ApiError('network', SERVER_UNREACHABLE);
  }
  // The Vite proxy answers 500 with an empty body (or 502–504) when the backend is down.
  // Express's own errors are 500 with an HTML page, so an empty 500 means "unreachable".
  if (response.status >= 502 && response.status <= 504) throw new ApiError('network', SERVER_UNREACHABLE, response.status);
  if (response.status === 500 && (await response.clone().text()).trim() === '') {
    throw new ApiError('network', SERVER_UNREACHABLE, 500);
  }
  return response;
}

export function postJson(path: string, body: unknown, init: RequestInit = {}): Promise<Response> {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...init,
  });
}

/**
 * Reads a JSON body. Returns null for an empty body (the backend's "not found" for rooms).
 * The backend has no error handler, so failures arrive as Express's HTML error page.
 */
export async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!response.ok) {
    throw new ApiError('server', `The server returned an error (${response.status}). Try again in a moment.`, response.status);
  }
  if (text.trim() === '') return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError('unexpected', 'The server sent a response this app could not read. Try again, or restart the backend.');
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong. Try again.';
}
