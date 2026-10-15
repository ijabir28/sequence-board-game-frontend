import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './http';
import { AccountError, getProfile, signIn, signOut, signUp } from './user';

function respond(status: number, body?: unknown) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(body === undefined ? null : JSON.stringify(body), { status });
  });
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('signIn', () => {
  it('returns the profile from the response', async () => {
    const calls = respond(200, { handle: 'jabir', name: 'Jabir' });
    await expect(signIn('jabir', 'pw')).resolves.toEqual({ handle: 'jabir', name: 'Jabir' });
    expect(calls[0].url).toBe('/user/signin');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ handle: 'jabir', password: 'pw' });
  });

  it('turns a refusal into an AccountError for the credentials', async () => {
    respond(401, { error: 'INVALID_CREDENTIALS', message: "That handle and password don't match." });
    const error = await signIn('jabir', 'nope').catch((e) => e);
    expect(error).toBeInstanceOf(AccountError);
    expect(error).toMatchObject({ code: 'INVALID_CREDENTIALS', field: 'credentials', message: "That handle and password don't match." });
  });

  it('reports rate limiting without blaming a field', async () => {
    respond(429, { error: 'TOO_MANY_ATTEMPTS', message: 'Too many attempts.' });
    await expect(signIn('jabir', 'nope')).rejects.toMatchObject({ code: 'TOO_MANY_ATTEMPTS', field: null });
  });

  it('treats a server crash as a server error, not a refusal', async () => {
    respond(500, { error: 'SERVER_ERROR', message: 'Something went wrong on the server.' });
    await expect(signIn('jabir', 'pw')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('signUp', () => {
  it('sends the new account and returns its profile', async () => {
    const calls = respond(201, { handle: 'new_player', name: 'New' });
    await expect(signUp('New_Player', 'New', 'long enough')).resolves.toEqual({ handle: 'new_player', name: 'New' });
    expect(calls[0].url).toBe('/user/signup');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ handle: 'New_Player', name: 'New', password: 'long enough' });
  });

  it.each([
    ['HANDLE_TAKEN', 409, 'handle'],
    ['INVALID_HANDLE', 400, 'handle'],
    ['INVALID_NAME', 400, 'name'],
    ['WEAK_PASSWORD', 400, 'password'],
  ])('maps %s to the %s field', async (code, status, field) => {
    respond(status, { error: code, message: 'explained' });
    await expect(signUp('a', 'b', 'c')).rejects.toMatchObject({ code, field, message: 'explained' });
  });
});

describe('getProfile', () => {
  it('is null without a session', async () => {
    respond(401, { error: 'NOT_SIGNED_IN', message: 'Sign in first.' });
    await expect(getProfile()).resolves.toBeNull();
  });

  it('returns the signed-in profile', async () => {
    respond(200, { handle: 'jabir', name: 'Jabir' });
    await expect(getProfile()).resolves.toEqual({ handle: 'jabir', name: 'Jabir' });
  });
});

describe('signOut', () => {
  it('posts to /user/signout', async () => {
    const calls = respond(204);
    await signOut();
    expect(calls[0].url).toBe('/user/signout');
    expect(calls[0].init?.method).toBe('POST');
  });
});
