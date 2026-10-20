import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, SERVER_ERROR, SERVER_UNREACHABLE, errorMessage, failureMessage, readJson, request } from './http';

afterEach(() => vi.unstubAllGlobals());

describe('request', () => {
  it('turns a network failure into a friendly connection message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(request('/room/abc')).rejects.toThrow(SERVER_UNREACHABLE);
  });

  it('treats a gateway error as the server being unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 502 })));
    await expect(request('/room/abc')).rejects.toThrow(SERVER_UNREACHABLE);
  });
});

describe('readJson', () => {
  it('never shows the status code or the error page', async () => {
    const page = '<pre>TypeError: x is undefined<br> &nbsp; &nbsp;at handler (/app/controller/room.js:12:5)</pre>';
    await expect(readJson(new Response(page, { status: 500 }))).rejects.toThrow(SERVER_ERROR);
  });
});

describe('failureMessage', () => {
  it('explains common statuses in plain words', () => {
    expect(failureMessage(401)).toMatch(/sign in again/);
    expect(failureMessage(429)).toMatch(/wait a moment/);
    expect(failureMessage(500)).toBe(SERVER_ERROR);
    for (const status of [400, 401, 403, 404, 429, 500, 503]) expect(failureMessage(status)).not.toMatch(/\d/);
  });
});

describe('errorMessage', () => {
  it("shows an ApiError's message but hides a raw exception's", () => {
    expect(errorMessage(new ApiError('refused', 'That handle is taken.'))).toBe('That handle is taken.');
    expect(errorMessage(new TypeError("Cannot read properties of undefined (reading 'id')"))).toBe('Something went wrong. Please try again.');
  });
});
