import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './http';
import {
  AccountError,
  changeEmail,
  changePassword,
  getProfile,
  listSessions,
  removeAvatar,
  saveBoardStyle,
  saveCardDeck,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  signIn,
  signOut,
  signUp,
  updateName,
  uploadAvatar,
} from './user';

const PROFILE_BODY = {
  handle: 'jabir',
  name: 'Jabir',
  email: 'jabir@example.com',
  email_verified: true,
  image: null,
  card_deck: 'jumbo',
  board_style: 'cards',
  created_at: '2026-10-01T10:00:00.000Z',
  stats: { played: 5, won: 3, playing: 1 },
};
const PROFILE = {
  handle: 'jabir',
  name: 'Jabir',
  email: 'jabir@example.com',
  emailVerified: true,
  image: null,
  cardDeck: 'jumbo',
  boardStyle: 'cards',
  createdAt: '2026-10-01T10:00:00.000Z',
  stats: { played: 5, won: 3, playing: 1 },
};

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
  it('sends the new account, and does not sign in: the email must be confirmed first', async () => {
    const calls = respond([200, { token: null, user: {} }]);
    await expect(signUp('New_Player', 'New', 'new@example.com', 'long enough')).resolves.toBeUndefined();
    expect(calls).toHaveLength(1);
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

describe('email confirmation', () => {
  it('signing in before confirming keeps the server message, which says where the link went', async () => {
    respond([403, { code: 'EMAIL_NOT_VERIFIED', message: 'Confirm your email first: open the link we sent to j••••@example.com.' }]);
    await expect(signIn('jabir', 'pw')).rejects.toMatchObject({
      code: 'EMAIL_NOT_VERIFIED',
      field: null,
      message: 'Confirm your email first: open the link we sent to j••••@example.com.',
    });
  });

  it('asks for the link again', async () => {
    const calls = respond([200, { status: true }]);
    await resendVerification('new@example.com');
    expect(calls[0].url).toBe('/api/auth/send-verification-email');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ email: 'new@example.com' });
  });
});

describe('password reset', () => {
  it('asks for a link that comes back to the reset screen', async () => {
    const calls = respond([200, { status: true }]);
    await requestPasswordReset('jabir@example.com');
    expect(calls[0].url).toBe('/api/auth/request-password-reset');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ email: 'jabir@example.com', redirectTo: '/reset-password' });
  });

  it('sets the new password with the token', async () => {
    const calls = respond([200, { status: true }]);
    await resetPassword('tok', 'new password');
    expect(calls[0].url).toBe('/api/auth/reset-password');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ token: 'tok', newPassword: 'new password' });
  });

  it('explains an expired or used link', async () => {
    respond([400, { code: 'INVALID_TOKEN', message: 'Invalid token' }]);
    await expect(resetPassword('old', 'new password')).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
      message: 'This link has expired or was already used. Ask for a new one.',
    });
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

  it('copes with a server that sends no stats or date', async () => {
    respond([200, { handle: 'old', name: 'Old', email: null, email_verified: false, image: null }]);
    await expect(getProfile()).resolves.toMatchObject({ createdAt: null, stats: { played: 0, won: 0, playing: 0 } });
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

describe('profile', () => {
  it('saves the display name through Better Auth', async () => {
    const calls = respond([200, { status: true }]);
    await updateName('New');
    expect(calls[0].url).toBe('/api/auth/update-user');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ name: 'New' });
  });

  it('asks to change the email, with links that come back to the profile', async () => {
    const calls = respond([200, { status: true }]);
    await changeEmail('new@example.com');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ newEmail: 'new@example.com', callbackURL: '/profile' });
  });

  it('changes the password and signs out other devices; a wrong current one is that field', async () => {
    const calls = respond([200, { token: 't' }]);
    await changePassword('old', 'new password');
    expect(calls[0].url).toBe('/api/auth/change-password');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ currentPassword: 'old', newPassword: 'new password', revokeOtherSessions: true });

    respond([400, { code: 'INVALID_PASSWORD', message: 'Invalid password' }]);
    await expect(changePassword('nope', 'new password')).rejects.toMatchObject({ field: 'currentPassword' });
  });

  it('uploads the picture as is and returns its URL', async () => {
    const calls = respond([200, { image: '/user/avatar/3?v=abc' }]);
    const picture = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' });
    await expect(uploadAvatar(picture)).resolves.toBe('/user/avatar/3?v=abc');
    expect(calls[0].url).toBe('/user/avatar');
    expect(calls[0].init?.method).toBe('PUT');
    expect(new Headers(calls[0].init?.headers).get('Content-Type')).toBe('image/webp');
  });

  it('explains a refused picture', async () => {
    respond([413, { error: 'IMAGE_TOO_LARGE', message: 'Pictures can be at most 256 KB.' }]);
    await expect(uploadAvatar(new Blob(['x'], { type: 'image/png' }))).rejects.toMatchObject({
      field: 'image',
      message: 'Pictures can be at most 256 KB.',
    });
  });

  it('removes the picture', async () => {
    const calls = respond([204]);
    await removeAvatar();
    expect(calls[0].init?.method).toBe('DELETE');
  });

  it('lists devices, most recent first, marking this one', async () => {
    respond([
      200,
      [
        { token: 'a', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z', userAgent: 'Firefox/1' },
        { token: 'b', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-05T00:00:00Z', userAgent: '' },
      ],
    ]);
    const sessions = await listSessions('a');
    expect(sessions.map((s) => [s.userAgent, s.current])).toEqual([
      [null, false],
      ['Firefox/1', true],
    ]);
  });
});

describe('saveCardDeck', () => {
  it('puts the deck id on the account', async () => {
    const calls = respond([200, { card_deck: 'classic' }]);
    await saveCardDeck('classic');
    expect(calls[0].url).toBe('/user/card-deck');
    expect(calls[0].init?.method).toBe('PUT');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ card_deck: 'classic' });
  });

  it('reports a refused deck', async () => {
    respond([400, { error: 'INVALID_CARD_DECK', message: 'Choose one of the card decks.' }]);
    await expect(saveCardDeck('nope')).rejects.toBeInstanceOf(AccountError);
  });
});

describe('saveBoardStyle', () => {
  it('puts the board style on the account', async () => {
    const calls = respond([200, { board_style: 'cards' }]);
    await saveBoardStyle('cards');
    expect(calls[0].url).toBe('/user/board-style');
    expect(calls[0].init?.method).toBe('PUT');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ board_style: 'cards' });
  });
});
