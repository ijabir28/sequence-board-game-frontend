import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './http';
import { AccountError, getProfile, signIn, signOut, signUp } from './user';

const PROFILE_BODY = { handle: 'jabir', name: 'Jabir', email: 'jabir@example.com', email_verified: true, image: null };
const PROFILE = { handle: 'jabir', name: 'Jabir', email: 'jabir@example.com', emailVerified: true, image: null };

/** Answers each fetch with the next [status, body], and records the calls. */
function respond(...responses: [number, unknown?][]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const [status, body] = responses[Math.min(calls.length, responses.length) - 1];
    return new Response(body === undefined ? null : JSON.stringify(body), { status });
  });
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('signIn', () => {
  it('signs in with Better Auth, then returns the profile', async () => {
    const calls = respond([200, { token: 't', user: {} }], [200, PROFILE_BODY]);
    await expect(signIn('jabir', 'pw')).resolves.toEqual(PROFILE);
    expect(calls.map((c) => c.url)).toEqual(['/api/auth/sign-in/username', '/user/profile']);
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ username: 'jabir', password: 'pw' });
  });

  it('turns a refusal into an AccountError for the credentials, in our words', async () => {
    respond([401, { code: 'INVALID_USERNAME_OR_PASSWORD', message: 'Invalid username or password' }]);
    const error = await signIn('jabir', 'nope').catch((e) => e);
    expect(error).toBeInstanceOf(AccountError);
    expect(error).toMatchObject({
      code: 'INVALID_USERNAME_OR_PASSWORD',
      field: 'credentials',
      message: "That handle and password don't match.",
    });
  });

  it('reports rate limiting without blaming a field', async () => {
    respond([429, { code: 'TOO_MANY_ATTEMPTS', message: 'Too many attempts.' }]);
    await expect(signIn('jabir', 'nope')).rejects.toMatchObject({ code: 'TOO_MANY_ATTEMPTS', field: null, message: 'Too many attempts.' });
  });

  it('treats a server crash as a server error, not a refusal', async () => {
    respond([500, { code: 'INTERNAL_SERVER_ERROR', message: 'Something went wrong.' }]);
    await expect(signIn('jabir', 'pw')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('signUp', () => {
  it('sends the new account and returns its profile', async () => {
    const calls = respond([200, { token: 't', user: {} }], [200, PROFILE_BODY]);
    await expect(signUp('New_Player', 'New', 'new@example.com', 'long enough')).resolves.toEqual(PROFILE);
    expect(calls[0].url).toBe('/api/auth/sign-up/email');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      username: 'New_Player',
      name: 'New',
      email: 'new@example.com',
      password: 'long enough',
    });
  });

  it.each([
    ['USERNAME_IS_ALREADY_TAKEN', 400, 'handle'],
    ['USERNAME_TOO_SHORT', 400, 'handle'],
    ['INVALID_USERNAME', 400, 'handle'],
    ['INVALID_NAME', 400, 'name'],
    ['USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', 422, 'email'],
    ['PASSWORD_TOO_SHORT', 400, 'password'],
  ])('maps %s to the %s field', async (code, status, field) => {
    respond([status, { code, message: 'explained' }]);
    await expect(signUp('a', 'b', 'c@d.e', 'f')).rejects.toMatchObject({ code, field });
  });

  it("keeps the server's message for codes it has no wording for", async () => {
    respond([400, { code: 'INVALID_NAME', message: 'Enter a display name of up to 10 characters.' }]);
    await expect(signUp('a', 'b', 'c@d.e', 'f')).rejects.toMatchObject({ message: 'Enter a display name of up to 10 characters.' });
  });
});

describe('getProfile', () => {
  it('is null without a session', async () => {
    respond([401, { error: 'NOT_SIGNED_IN', message: 'Sign in first.' }]);
    await expect(getProfile()).resolves.toBeNull();
  });

  it('returns the signed-in profile', async () => {
    respond([200, PROFILE_BODY]);
    await expect(getProfile()).resolves.toEqual(PROFILE);
  });

  it('has no email for accounts made before emails were asked for', async () => {
    respond([200, { handle: 'old', name: 'Old', email: null, email_verified: false, image: null }]);
    await expect(getProfile()).resolves.toMatchObject({ email: null, emailVerified: false });
  });
});

describe('signOut', () => {
  it('posts to Better Auth', async () => {
    const calls = respond([200, { success: true }]);
    await signOut();
    expect(calls[0].url).toBe('/api/auth/sign-out');
    expect(calls[0].init?.method).toBe('POST');
  });
});
