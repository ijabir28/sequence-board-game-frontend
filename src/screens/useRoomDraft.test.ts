import { describe, expect, it } from 'vitest';
import { resizeRoom, roomUpdate, sanitizeRoom } from '../api/rooms';
import { mergeChanges, previewRoom, settleChanges } from './useRoomDraft';

const p = (handle: string) => ({ handle, name: handle.toUpperCase() });
const room = (teams: (string | null)[][], standing: string[] = []) =>
  sanitizeRoom('t-1', {
    name: 'Friday',
    administrator: 'a',
    teams: teams.map((seats, i) => ({ handle: `TEAM_${i + 1}`, players: seats.map((h) => (h ? p(h) : null)) })),
    standing: standing.map(p),
  });
const handles = (r: ReturnType<typeof room>) => r.teams.map((t) => t.seats.map((s) => s?.handle ?? null));

describe('resizeRoom (mirrors the server)', () => {
  it('keeps seats that still exist and moves the others to an open seat on their team, then anywhere', () => {
    // As the server's spec: 3 teams of 1 down to 2 teams of 2.
    expect(handles(resizeRoom(room([['a'], [null], ['b']]), { teamCount: 2, playersPerTeam: 2 }))).toEqual([
      ['a', null],
      ['b', null],
    ]);
    expect(handles(resizeRoom(room([['a', 'b'], ['c', null]]), { teamCount: 2, playersPerTeam: 1 }))).toEqual([['a'], ['c']]);
  });

  it('stands up whoever no longer fits, after anyone already standing', () => {
    const resized = resizeRoom(room([['a', 'b'], ['c', 'd']], ['e']), { teamCount: 2, playersPerTeam: 1 });
    expect(resized.standing.map((s) => s.handle)).toEqual(['e', 'b', 'd']);
  });

  it('adds empty teams and seats, and returns the same room when the size is unchanged', () => {
    const r = room([['a'], ['b']]);
    expect(resizeRoom(r, { teamCount: 2, playersPerTeam: 1 })).toBe(r);
    const grown = resizeRoom(r, { teamCount: 3, playersPerTeam: 2 });
    expect(handles(grown)).toEqual([
      ['a', null],
      ['b', null],
      [null, null],
    ]);
    expect(grown.teams.map((t) => [t.handle, t.index])).toEqual([
      ['TEAM_1', 0],
      ['TEAM_2', 1],
      ['TEAM_3', 2],
    ]);
  });
});

describe('roomUpdate', () => {
  it('takes the room from a broadcast about this table, and ignores other tables', () => {
    const update = roomUpdate('t-1', { id: 't-1', name: 'Friday', teams: [{ handle: 'TEAM_1', players: [p('a')] }] });
    expect(typeof update === 'object' && update.teams[0].seats[0]?.handle).toBe('a');
    expect(roomUpdate('t-1', { id: 't-2', teams: [] })).toBe('other');
    expect(roomUpdate('42', { id: 42, deleted: true })).toBe('deleted');
  });

  it('asks for a fetch when the broadcast carries no room', () => {
    expect(roomUpdate('t-1', undefined)).toBe('unknown');
    expect(roomUpdate('t-1', {})).toBe('unknown');
    expect(roomUpdate('t-1', { id: 't-1' })).toBe('unknown');
  });
});

describe('the host draft', () => {
  it('merges changes, the latest winning', () => {
    const merged = mergeChanges({ size: { teamCount: 2, playersPerTeam: 1 }, settings: { history: false } }, { size: { teamCount: 3, playersPerTeam: 1 }, settings: { highlights: false } });
    expect(merged).toEqual({ size: { teamCount: 3, playersPerTeam: 1 }, settings: { history: false, highlights: false } });
  });

  it('settles what was saved but keeps what changed again since', () => {
    const sent = { size: { teamCount: 2, playersPerTeam: 2 }, settings: { history: false, highlights: false } };
    expect(settleChanges(sent, sent)).toEqual({});
    expect(settleChanges({ size: { teamCount: 3, playersPerTeam: 1 }, settings: { history: false, highlights: true } }, sent)).toEqual({
      size: { teamCount: 3, playersPerTeam: 1 },
      settings: { highlights: true },
    });
  });

  it('previews the pending size and settings on the saved room, and leaves it alone when nothing is pending', () => {
    const saved = room([['a'], ['b']]);
    expect(previewRoom(saved, {})).toBe(saved);
    const shown = previewRoom(saved, { size: { teamCount: 3, playersPerTeam: 1 }, settings: { history: false } });
    expect(shown.teams).toHaveLength(3);
    expect(shown.settings.history).toBe(false);
    expect(shown.settings.highlights).toBe(saved.settings.highlights);
  });
});
