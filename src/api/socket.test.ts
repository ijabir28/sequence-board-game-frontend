import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A stand-in for socket.io-client's socket: it only records connects, disconnects and what was emitted.
interface FakeSocket {
  connected: boolean;
  connects: number;
  disconnects: number;
  emitted: string[];
  connect(): void;
  disconnect(): void;
  emit(event: string): void;
  on(): void;
  off(): void;
}

let fake: FakeSocket;

vi.mock('socket.io-client', () => ({
  default: () => fake,
}));

// Just enough of a page: its visibility, and whether the device says it is online.
type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();
const page = { visibilityState: 'visible' as 'visible' | 'hidden', onLine: true };

function fire(type: string) {
  listeners.get(type)?.forEach((listener) => listener());
}

function addEventListener(type: string, listener: Listener) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type)!.add(listener);
}

function removeEventListener(type: string, listener: Listener) {
  listeners.get(type)?.delete(listener);
}

function setVisibility(state: 'visible' | 'hidden') {
  page.visibilityState = state;
  fire('visibilitychange');
}

function setOnline(online: boolean) {
  page.onLine = online;
  fire(online ? 'online' : 'offline');
}

async function load() {
  vi.resetModules();
  return import('./socket');
}

beforeEach(() => {
  vi.useFakeTimers();
  listeners.clear();
  page.visibilityState = 'visible';
  page.onLine = true;
  fake = {
    connected: true,
    connects: 0,
    disconnects: 0,
    emitted: [],
    connect() {
      this.connects += 1;
      this.connected = true;
    },
    disconnect() {
      this.disconnects += 1;
      this.connected = false;
    },
    emit(event: string) {
      this.emitted.push(event);
    },
    on() {},
    off() {},
  };
  vi.stubGlobal('window', { addEventListener, removeEventListener });
  vi.stubGlobal('document', {
    get visibilityState() {
      return page.visibilityState;
    },
    addEventListener,
    removeEventListener,
  });
  vi.stubGlobal('navigator', {
    get onLine() {
      return page.onLine;
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the socket while the page is away', () => {
  it('lets go after a minute hidden, and opens again on coming back', async () => {
    const { getSocket } = await load();
    getSocket();
    setVisibility('hidden');
    vi.advanceTimersByTime(59_000);
    expect(fake.disconnects).toBe(0);
    vi.advanceTimersByTime(1_000);
    expect(fake.disconnects).toBe(1);
    setVisibility('visible');
    expect(fake.connects).toBe(1);
  });

  it('stays open for a short look elsewhere', async () => {
    const { getSocket } = await load();
    getSocket();
    setVisibility('hidden');
    vi.advanceTimersByTime(30_000);
    setVisibility('visible');
    vi.advanceTimersByTime(60_000);
    expect([fake.disconnects, fake.connects]).toEqual([0, 0]);
  });

  it('stays open while held, and lets go a minute after the hold ends', async () => {
    const { getSocket, holdSocketOpen } = await load();
    getSocket();
    const release = holdSocketOpen();
    setVisibility('hidden');
    vi.advanceTimersByTime(120_000);
    expect(fake.disconnects).toBe(0);
    release();
    vi.advanceTimersByTime(60_000);
    expect(fake.disconnects).toBe(1);
  });

  it('a hold opens a socket that was let go', async () => {
    const { getSocket, holdSocketOpen } = await load();
    getSocket();
    setVisibility('hidden');
    vi.advanceTimersByTime(60_000);
    holdSocketOpen();
    expect(fake.connects).toBe(1);
  });

  it('stops trying while the device is offline, and tries again once it is back', async () => {
    const { getSocket } = await load();
    getSocket();
    setOnline(false);
    expect(fake.disconnects).toBe(1);
    setOnline(true);
    expect(fake.connects).toBe(1);
  });

  it('back online while hidden, waits for the page to come back', async () => {
    const { getSocket } = await load();
    getSocket();
    setVisibility('hidden');
    setOnline(false);
    setOnline(true);
    expect(fake.connects).toBe(0);
    setVisibility('visible');
    expect(fake.connects).toBe(1);
  });

  it('signing in or out while let go reconnects only on waking', async () => {
    const { getSocket, reconnectSocket } = await load();
    getSocket();
    setVisibility('hidden');
    vi.advanceTimersByTime(60_000);
    reconnectSocket();
    expect(fake.connects).toBe(0);
    setVisibility('visible');
    expect(fake.connects).toBe(1);
  });
});

describe('leaving while disconnected', () => {
  it("doesn't queue a leave_game that would undo the next join", async () => {
    const { announcePresence } = await load();
    const leave = announcePresence('room-1', 'ann', 'token');
    expect(fake.emitted).toEqual(['join_game']);
    fake.connected = false;
    leave();
    expect(fake.emitted).toEqual(['join_game']);
  });

  it('says so while connected', async () => {
    const { announcePresence, watchGame } = await load();
    announcePresence('room-1', 'ann', 'token')();
    watchGame('room-2')();
    expect(fake.emitted).toEqual(['join_game', 'leave_game', 'watch_game', 'unwatch_game']);
  });
});
