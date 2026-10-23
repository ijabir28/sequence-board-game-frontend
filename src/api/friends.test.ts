import { afterEach, describe, expect, it, vi } from 'vitest';
import { inviteToTable, sanitizeOverview, sanitizeSearch, searchPlayers, sendFriendRequest } from './friends';

afterEach(() => {
  vi.unstubAllGlobals();
});

function respond(status: number, body: unknown) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

describe('sanitizeOverview', () => {
  it('reads friends, requests and invitations', () => {
    const overview = sanitizeOverview({
      friends: [
        { handle: 'sakib', name: 'Sakib', image: null, since: '2026-10-20T10:00:00.000Z', online: true, playing: true, watch: 'otter-k3m9' },
        { handle: 'tanvir', name: 'Tanvir', online: false, playing: true, watch: null },
      ],
      incoming: [{ handle: 'rafi', name: '', sent_at: '2026-10-21T10:00:00.000Z' }],
      outgoing: [],
      invitations: [
        { room_id: 'friday-ab12', room_name: 'Friday', from: { handle: 'sakib', name: 'Sakib' }, seats_taken: 1, seats: 4 },
        { room_name: 'no code' },
      ],
    });
    expect(overview.friends).toEqual([
      { handle: 'sakib', name: 'Sakib', image: null, since: Date.parse('2026-10-20T10:00:00.000Z'), online: true, playing: true, watch: 'otter-k3m9' },
      // Playing, but hasn't let friends watch: no table to link to.
      { handle: 'tanvir', name: 'Tanvir', image: null, since: null, online: false, playing: true, watch: null },
    ]);
    expect(overview.incoming).toEqual([{ handle: 'rafi', name: 'rafi', image: null, sentAt: Date.parse('2026-10-21T10:00:00.000Z') }]);
    expect(overview.invitations).toEqual([
      { roomId: 'friday-ab12', roomName: 'Friday', from: { handle: 'sakib', name: 'Sakib', image: null }, sentAt: null, seatsTaken: 1, seats: 4 },
    ]);
  });

  it('copes with an empty or malformed body', () => {
    expect(sanitizeOverview({ friends: 'nope' })).toEqual({ friends: [], incoming: [], outgoing: [], invitations: [] });
  });
});

describe('sanitizeSearch', () => {
  it('reads anything unknown as no relationship', () => {
    expect(sanitizeSearch({ players: [{ handle: 'a1', name: 'A', relationship: 'enemies' }] })).toEqual([
      { handle: 'a1', name: 'A', image: null, relationship: 'none' },
    ]);
  });
});

describe('requests', () => {
  it('searches by the query', async () => {
    const fetch = respond(200, { players: [] });
    await searchPlayers('jab ir');
    expect(fetch).toHaveBeenCalledWith('/friends/search?q=jab+ir', expect.anything());
  });

  it("says when a request became a friendship, and passes the server's refusals on", async () => {
    respond(200, { handle: 'sakib', relationship: 'friends' });
    expect(await sendFriendRequest('sakib')).toBe('friends');
    respond(409, { error: 'ALREADY_REQUESTED', message: "You've already asked Sakib." });
    await expect(sendFriendRequest('sakib')).rejects.toThrow("You've already asked Sakib.");
    respond(403, { error: 'NOT_FRIENDS', message: 'Add Sakib as a friend first.' });
    await expect(inviteToTable('otter-k3m9', 'sakib')).rejects.toThrow('Add Sakib as a friend first.');
  });
});
