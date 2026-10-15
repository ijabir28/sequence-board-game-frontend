import { ApiError, postJson, request } from './http';

// Accounts (backend controller/user.js). Successes are JSON profiles; errors are JSON {error, message}.

export interface Profile {
  handle: string;
  name: string;
}

export type AccountField = 'handle' | 'name' | 'password' | 'credentials';

const FIELD_BY_CODE: Record<string, AccountField> = {
  INVALID_HANDLE: 'handle',
  HANDLE_TAKEN: 'handle',
  INVALID_NAME: 'name',
  WEAK_PASSWORD: 'password',
  INVALID_CREDENTIALS: 'credentials',
};

/** The server refused a sign-in or sign-up, for example a taken handle. `message` is written for players. */
export class AccountError extends Error {
  readonly field: AccountField | null;

  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AccountError';
    this.field = FIELD_BY_CODE[code] ?? null;
  }
}

async function readProfile(response: Response): Promise<Profile> {
  let body: { handle?: unknown; name?: unknown; error?: unknown; message?: unknown } | null = null;
  try {
    body = JSON.parse(await response.text());
  } catch {
    // handled below
  }
  if (response.ok && typeof body?.handle === 'string') {
    return { handle: body.handle, name: typeof body.name === 'string' ? body.name : body.handle };
  }
  if (response.status >= 400 && response.status < 500 && typeof body?.error === 'string') {
    throw new AccountError(body.error, typeof body.message === 'string' ? body.message : 'The server refused that. Try again.');
  }
  if (response.ok) throw new ApiError('unexpected', 'The server sent a response this app could not read. Try again.');
  throw new ApiError('server', `The server returned an error (${response.status}). Try again in a moment.`, response.status);
}

export async function signIn(handle: string, password: string): Promise<Profile> {
  return readProfile(await postJson('/user/signin', { handle, password }));
}

/** Creates the account and signs it in. */
export async function signUp(handle: string, name: string, password: string): Promise<Profile> {
  return readProfile(await postJson('/user/signup', { handle, name, password }));
}

/** Ends the session on the server. */
export async function signOut(): Promise<void> {
  const response = await postJson('/user/signout', {});
  if (!response.ok) throw new ApiError('server', `Signing out failed (${response.status}). Try again.`, response.status);
}

/** The signed-in user, or null when there is no session (or it has expired). */
export async function getProfile(): Promise<Profile | null> {
  const response = await request('/user/profile');
  if (response.status === 401) return null;
  return readProfile(response);
}
