import { ApiError, postJson, request } from './http';

// Accounts. Signing up, in and out goes to Better Auth on the backend (/api/auth, see its auth.js); the signed-in
// profile comes from GET /user/profile. Better Auth's errors are JSON {code, message}; ours are {error, message}.

export interface Profile {
  handle: string;
  name: string;
  /** null for an account made before emails were asked for. */
  email: string | null;
  emailVerified: boolean;
  /** The avatar's URL, or null. */
  image: string | null;
}

export type AccountField = 'handle' | 'name' | 'email' | 'password' | 'credentials';

// Better Auth's own messages are terse ("Username is too short"), so the ones players see are written here. Codes
// without an entry keep the server's message.
const ERRORS: Record<string, { field: AccountField | null; message?: string }> = {
  USERNAME_TOO_SHORT: { field: 'handle', message: 'Handles are 3 to 20 characters: letters, digits and underscores.' },
  USERNAME_TOO_LONG: { field: 'handle', message: 'Handles are 3 to 20 characters: letters, digits and underscores.' },
  INVALID_USERNAME: { field: 'handle', message: 'Handles are 3 to 20 characters: letters, digits and underscores.' },
  USERNAME_IS_ALREADY_TAKEN: { field: 'handle', message: 'That handle is taken. Pick another one.' },
  INVALID_NAME: { field: 'name' },
  INVALID_EMAIL: { field: 'email', message: 'Enter a valid email address.' },
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: { field: 'email', message: 'That email already has an account. Sign in instead.' },
  PASSWORD_TOO_SHORT: { field: 'password', message: 'Passwords need at least 8 characters.' },
  PASSWORD_TOO_LONG: { field: 'password', message: 'Passwords can be at most 200 characters.' },
  INVALID_USERNAME_OR_PASSWORD: { field: 'credentials', message: "That handle and password don't match." },
  TOO_MANY_ATTEMPTS: { field: null },
  // The server's message says where the new link went.
  EMAIL_NOT_VERIFIED: { field: null },
  INVALID_TOKEN: { field: null, message: 'This link has expired or was already used. Ask for a new one.' },
};

/** The server refused a sign-in or sign-up, for example a taken handle. `message` is written for players. */
export class AccountError extends Error {
  readonly field: AccountField | null;

  constructor(
    readonly code: string,
    message: string,
  ) {
    super(ERRORS[code]?.message ?? message);
    this.name = 'AccountError';
    this.field = ERRORS[code]?.field ?? null;
  }
}

async function readBody(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const body = JSON.parse(await response.text());
    return body && typeof body === 'object' ? body : null;
  } catch {
    return null;
  }
}

/** Throws the AccountError or ApiError a failed response stands for. */
function refusal(response: Response, body: Record<string, unknown> | null): never {
  const code = typeof body?.code === 'string' ? body.code : typeof body?.error === 'string' ? body.error : null;
  if (response.status >= 400 && response.status < 500 && code) {
    throw new AccountError(code, typeof body?.message === 'string' ? body.message : 'The server refused that. Try again.');
  }
  throw new ApiError('server', `The server returned an error (${response.status}). Try again in a moment.`, response.status);
}

function toProfile(body: Record<string, unknown> | null): Profile {
  if (typeof body?.handle !== 'string') {
    throw new ApiError('unexpected', 'The server sent a response this app could not read. Try again.');
  }
  return {
    handle: body.handle,
    name: typeof body.name === 'string' ? body.name : body.handle,
    email: typeof body.email === 'string' ? body.email : null,
    emailVerified: body.email_verified === true,
    image: typeof body.image === 'string' ? body.image : null,
  };
}

/** Sends an account action to Better Auth; resolves once it succeeded. */
async function authAction(path: string, body: unknown): Promise<void> {
  const response = await postJson(`/api/auth${path}`, body);
  if (!response.ok) refusal(response, await readBody(response));
}

/** The profile right after signing in, which must exist. */
async function signedInProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) throw new ApiError('unexpected', 'Signed in, but the server lost the session. Try again.');
  return profile;
}

export async function signIn(handle: string, password: string): Promise<Profile> {
  await authAction('/sign-in/username', { username: handle, password });
  return signedInProfile();
}

/**
 * Creates the account and emails a link to confirm the address; the account can sign in once that link is opened.
 * Resolves the same way when the email is already registered (the server tells that address's owner instead), so
 * the screen after it must not claim the account was created.
 */
export async function signUp(handle: string, name: string, email: string, password: string): Promise<void> {
  await authAction('/sign-up/email', { username: handle, name, email, password });
}

/** Emails a new confirmation link to an address that hasn't been confirmed yet. */
export async function resendVerification(email: string): Promise<void> {
  await authAction('/send-verification-email', { email });
}

/** Where the reset link sends the player, with the token: the ResetPassword screen. */
export const RESET_PASSWORD_PATH = '/reset-password';

/** Emails a password reset link if an account uses this address. Resolves the same way either way. */
export async function requestPasswordReset(email: string): Promise<void> {
  await authAction('/request-password-reset', { email, redirectTo: RESET_PASSWORD_PATH });
}

/** Sets a new password with the token from a reset link. Every device is signed out. */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await authAction('/reset-password', { token, newPassword });
}

/** Ends the session on the server. */
export async function signOut(): Promise<void> {
  const response = await postJson('/api/auth/sign-out', {});
  if (!response.ok) throw new ApiError('server', `Signing out failed (${response.status}). Try again.`, response.status);
}

/** The signed-in user, or null when there is no session (or it has expired). */
export async function getProfile(): Promise<Profile | null> {
  const response = await request('/user/profile');
  if (response.status === 401) return null;
  const body = await readBody(response);
  if (!response.ok) refusal(response, body);
  return toProfile(body);
}
