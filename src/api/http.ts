// Thin fetch wrapper for the backend. All requests are same-origin (Vite proxies them to
// :3000), so the session cookie is sent automatically.

/** `refused`: the server understood the request and said no, with a message written for players. */
export type ApiErrorKind = 'network' | 'server' | 'unexpected' | 'refused';

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

// Messages players see. They say what happened and what to do, never ports, status codes or stack traces.
export const SERVER_UNREACHABLE =
  'Unable to connect to the game server. Please check your internet connection or try again in a moment.';
export const SERVER_ERROR = 'Something went wrong on our end. Please try again in a moment.';
export const UNREADABLE_RESPONSE = "We couldn't load that just now. Please refresh the page and try again.";

/** What to tell players when a request failed with `status` and the server gave no message of its own. */
export function failureMessage(status: number): string {
  if (status === 401) return 'Your session has ended. Please sign in again.';
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "We couldn't find what you were looking for. It may have been removed.";
  if (status === 429) return "You're going a little fast. Please wait a moment and try again.";
  return SERVER_ERROR;
}

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
    throw new ApiError('server', failureMessage(response.status), response.status);
  }
  if (text.trim() === '') return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError('unexpected', UNREADABLE_RESPONSE);
  }
}

/** The message to show players for any failure: an ApiError's own, or a general one (never a raw exception's). */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong. Please try again.';
}
