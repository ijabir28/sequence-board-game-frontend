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
  /** The hand card deck chosen on the account (src/decks/decks.ts), or null before one is chosen. */
  cardDeck: string | null;
  /** How the board's cells look, chosen on the account (src/decks/decks.ts), or null before one is chosen. */
  boardStyle: string | null;
  /** When the account was made (ISO 8601), or null if the server didn't say. */
  createdAt: string | null;
  /** Table games: finished ones played and won, and the ones in progress. */
  stats: { played: number; won: number; playing: number };
}

export type AccountField = 'handle' | 'name' | 'email' | 'password' | 'currentPassword' | 'image' | 'credentials';

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
  INVALID_PASSWORD: { field: 'currentPassword', message: "That isn't your current password." },
  INVALID_IMAGE: { field: 'image' },
  IMAGE_TOO_LARGE: { field: 'image' },
  UNSUPPORTED_MEDIA_TYPE: { field: 'image' },
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

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toProfile(body: Record<string, unknown> | null): Profile {
  if (typeof body?.handle !== 'string') {
    throw new ApiError('unexpected', 'The server sent a response this app could not read. Try again.');
  }
  const stats = (body.stats && typeof body.stats === 'object' ? body.stats : {}) as Record<string, unknown>;
  return {
    handle: body.handle,
    name: typeof body.name === 'string' ? body.name : body.handle,
    email: typeof body.email === 'string' ? body.email : null,
    emailVerified: body.email_verified === true,
    image: typeof body.image === 'string' ? body.image : null,
    cardDeck: typeof body.card_deck === 'string' ? body.card_deck : null,
    boardStyle: typeof body.board_style === 'string' ? body.board_style : null,
    createdAt: typeof body.created_at === 'string' ? body.created_at : null,
    stats: { played: count(stats.played), won: count(stats.won), playing: count(stats.playing) },
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

// --- Profile ---

/** Where the links for a new email land. */
export const PROFILE_PATH = '/profile';

export async function updateName(name: string): Promise<void> {
  await authAction('/update-user', { name });
}

/**
 * Starts moving the account to `newEmail`. Nothing changes yet: a confirmed current address is first asked to
 * approve, then the new address gets a link to confirm itself. Resolves the same if the address has an account.
 */
export async function changeEmail(newEmail: string): Promise<void> {
  await authAction('/change-email', { newEmail, callbackURL: PROFILE_PATH });
}

/** Changes the password and signs out every other device. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await authAction('/change-password', { currentPassword, newPassword, revokeOtherSessions: true });
}

/** Uploads a PNG, JPEG or WebP picture as the avatar; resolves to the URL that serves it. */
export async function uploadAvatar(picture: Blob): Promise<string> {
  const response = await request('/user/avatar', { method: 'PUT', headers: { 'Content-Type': picture.type }, body: picture });
  const body = await readBody(response);
  if (!response.ok) refusal(response, body);
  if (typeof body?.image !== 'string') throw new ApiError('unexpected', 'The server sent a response this app could not read. Try again.');
  return body.image;
}

export async function removeAvatar(): Promise<void> {
  const response = await request('/user/avatar', { method: 'DELETE' });
  if (!response.ok) refusal(response, await readBody(response));
}

async function putJson(path: string, body: unknown): Promise<void> {
  const response = await request(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) refusal(response, await readBody(response));
}

/** Saves the hand card deck on the account, so it follows the player to every device. */
export async function saveCardDeck(cardDeck: string): Promise<void> {
  await putJson('/user/card-deck', { card_deck: cardDeck });
}

/** Saves how the board's cells look on the account, so it follows the player to every device. */
export async function saveBoardStyle(boardStyle: string): Promise<void> {
  await putJson('/user/board-style', { board_style: boardStyle });
}

export interface DeviceSession {
  createdAt: string;
  updatedAt: string;
  userAgent: string | null;
  /** Whether it is this browser's session. */
  current: boolean;
}

/** Every device the account is signed in on, most recently used first. `currentToken` marks this browser's. */
export async function listSessions(currentToken: string | null): Promise<DeviceSession[]> {
  const response = await request('/api/auth/list-sessions');
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok || !Array.isArray(body)) refusal(response, null);
  return (body as Record<string, unknown>[])
    .map((session) => ({
      createdAt: String(session.createdAt),
      updatedAt: String(session.updatedAt),
      userAgent: typeof session.userAgent === 'string' && session.userAgent ? session.userAgent : null,
      current: currentToken !== null && session.token === currentToken,
    }))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

/** The token of this browser's session, to tell it apart in listSessions. */
export async function currentSessionToken(): Promise<string | null> {
  const response = await request('/api/auth/get-session');
  const body = (await response.json().catch(() => null)) as { session?: { token?: unknown } } | null;
  return typeof body?.session?.token === 'string' ? body.session.token : null;
}
