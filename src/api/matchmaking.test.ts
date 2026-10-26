import { afterEach, describe, expect, it, vi } from 'vitest';
import { getQueueStatus, joinQueue, sanitizeQueueStatus } from './matchmaking';

afterEach(() => {
  vi.unstubAllGlobals();
});

function respond(status: number, body: unknown) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

describe('sanitizeQueueStatus', () => {
  it('moves the time you joined onto this device’s clock', () => {
    const status = sanitizeQueueStatus(
      {
        status: 'queued',
        teams: 3,
        timer: 'fast',
        joined_at: '2026-10-20T10:00:00.000Z',
        server_time: '2026-10-20T10:00:30.000Z',
      },
      // This device's clock is 5 s ahead of the server's.
      Date.parse('2026-10-20T10:00:35.000Z'),
    );
    expect(status).toEqual({
      status: 'queued',
      teams: 3,
      timer: 'fast',
      joinedAt: Date.parse('2026-10-20T10:00:05.000Z'),
    });
  });

  it('knows the blitz timer, and reads an unknown one as medium', () => {
    expect(sanitizeQueueStatus({ status: 'queued', teams: 2, timer: 'blitz' })).toMatchObject({ timer: 'blitz' });
    expect(sanitizeQueueStatus({ status: 'queued', teams: 2, timer: 'glacial' })).toMatchObject({ timer: 'medium' });
  });

  it('reads the other statuses, and anything unknown as idle', () => {
    expect(sanitizeQueueStatus({ status: 'matched', room_id: 'quick-match-ab12' })).toEqual({ status: 'matched', roomId: 'quick-match-ab12' });
    expect(sanitizeQueueStatus({ status: 'playing', room_id: 'quick-match-ab12' })).toEqual({ status: 'playing', roomId: 'quick-match-ab12' });
    expect(sanitizeQueueStatus({ status: 'matching' })).toEqual({ status: 'matching' });
    expect(sanitizeQueueStatus({ status: 'matched' })).toEqual({ status: 'idle' });
    expect(sanitizeQueueStatus({})).toEqual({ status: 'idle' });
  });
});

describe('the queue requests', () => {
  it('joins with the table shape', async () => {
    const fetch = respond(200, { status: 'matched', room_id: 'quick-match-ab12' });
    expect(await joinQueue(2, 'slow')).toEqual({ status: 'matched', roomId: 'quick-match-ab12' });
    const [path, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe('/matchmaking/queue');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ teams: 2, timer: 'slow' });
  });

  it("shows the server's message when it refuses", async () => {
    respond(400, { error: 'INVALID_MATCH_SETTINGS', message: 'Choose 2 or 3 teams for a quick match.' });
    await expect(joinQueue(2, 'fast')).rejects.toThrow('Choose 2 or 3 teams for a quick match.');
  });

  it('reads the status', async () => {
    respond(200, { status: 'idle' });
    expect(await getQueueStatus()).toEqual({ status: 'idle' });
  });
});
