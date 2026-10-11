import type { Pos } from '../engine/board';
import { readJson, request } from './http';

// The legacy HTTP game (backend controller/game.js): one global game for the whole server.

export interface RawCell {
  name: string;
  occupied_by?: string;
}

export async function getDeck(): Promise<RawCell[][]> {
  const body = await readJson<{ deck: RawCell[][] }>(await request('/board/deck'));
  if (!body?.deck) throw new Error('The server returned no board.');
  return body.deck;
}

export async function getHandCards(handle: string): Promise<string[]> {
  const body = await readJson<{ cards_in_hand: { name: string }[] }>(
    await request(`/game/hand_cards?player_handler=${encodeURIComponent(handle)}`),
  );
  return (body?.cards_in_hand ?? []).map((c) => c.name);
}

/** GET /game/play. Returns the raw status and body; interpreting them is a backend quirk. */
export async function playMove(handle: string, handIndex: number, pos: Pos): Promise<{ status: number; body: string }> {
  const params = new URLSearchParams({
    player_handler: handle,
    hand_card_index: String(handIndex),
    board_card_index: JSON.stringify({ row: pos.row, column: pos.column }),
  });
  const response = await request(`/game/play?${params}`);
  return { status: response.status, body: await response.text() };
}
