import { BOARD_SIZE, type Pos } from '../../../engine/board';
import { BLANK, cardNumber, parseCard, type BoardCardName, type Suit } from '../../../engine/cards';
import type { TeamIndex } from '../../../engine/setup';
import type { BoardStyle, Deck } from '../../../decks/decks';
import { TEAM_STYLES } from '../../../game/teams';
import type { CellView } from '../../../game/types';
import { creditLine } from '../../PoweredBy';
import { SUIT_PATHS } from '../../cards/SuitIcon';
import { BOARD_GAP, BOARD_INSET } from '../../board/geometry';
import type { ShareSummary } from './shareSummary';

/*
 * The share image: a portrait card with the brand, the result, the final board and the numbers, painted straight
 * onto a canvas so it needs no screenshot library and looks the same on every device. The colours mirror
 * styles/tokens.css and the board mirrors Board.module.css (cells, chips, corners and sequence lines), in the deck and
 * board style the viewer plays with, so the picture is the board they just saw.
 */

const WIDTH = 1080;
const PAD = 72;
const BOARD = WIDTH - 2 * PAD;
const HEADER_Y = 64;
const HEADLINE_Y = 168;
const BOARD_Y = 316;
const TEAMS_Y = BOARD_Y + BOARD + 40;
const TEAM_H = 172;
const FACTS_Y = TEAMS_Y + TEAM_H + 24;
const FACT_H = 108;
const FOOTER_Y = FACTS_Y + FACT_H + 44;
export const SHARE_IMAGE_SIZE = { width: WIDTH, height: FOOTER_Y + 92 };

const DISPLAY = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";
const BODY = "'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif";

const C = {
  surface: '#0b1326',
  surfaceLowest: '#060e20',
  surfaceContainer: '#171f33',
  surfaceHigh: '#222a3d',
  onSurface: '#dae2fd',
  muted: '#a9b4cc',
  outlineSubtle: 'rgba(255, 255, 255, 0.08)',
  primary: '#4edea3',
};

const TEAM: Record<TeamIndex, { color: string; ink: string; glow: string }> = {
  0: { color: '#10b981', ink: '#002113', glow: 'rgba(16, 185, 129, 0.45)' },
  1: { color: '#3b82f6', ink: '#001a42', glow: 'rgba(59, 130, 246, 0.45)' },
  2: { color: '#ef4444', ink: '#410004', glow: 'rgba(239, 68, 68, 0.45)' },
};

/** The board's two looks (Board.module.css): light card faces in the deck's colour, or dark tiles. */
function cellPalette(style: BoardStyle, deck: Deck) {
  const cards = style === 'cards';
  const ink = cards
    ? { black: '#0f172a', red: '#dc2626', blue: '#1d4ed8', green: '#15803d' }
    : { black: '#e2e8f0', red: '#ff8a80', blue: '#8ab4ff', green: '#7ee2a8' };
  const suit = (s: Suit): string => {
    if (deck.suits === 'numbers') return { Heart: '#8b5cf6', Club: '#d97706', Diamond: '#d946ef', Spade: '#0891b2' }[s];
    if (s === 'Heart') return ink.red;
    if (s === 'Diamond') return deck.suits === 'four' ? ink.blue : ink.red;
    if (s === 'Club') return deck.suits === 'four' ? ink.green : ink.black;
    return ink.black;
  };
  return {
    face: cards ? deck.face : '#1a2236',
    outline: cards ? 'rgba(15, 23, 42, 0.16)' : C.outlineSubtle,
    suit,
    corner: cards
      ? [mix('#e9b949', deck.face, 0.3), mix('#e9b949', deck.face, 0.08), mix('#e9b949', deck.face, 0.36)]
      : ['#3a2f12', '#1b1f2e', '#4a3410'],
    cornerEdge: cards ? 'rgba(180, 83, 9, 0.38)' : 'rgba(245, 196, 81, 0.45)',
    cornerInk: cards ? '#b45309' : '#f5c451',
    lastRing: cards ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.7)',
  };
}

/** `a` mixed into `b`, like CSS color-mix(in srgb, a share%, b). */
function mix(a: string, b: string, share: number): string {
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [x, y] = [rgb(a), rgb(b)];
  return `rgb(${x.map((v, i) => Math.round(v * share + y[i] * (1 - share))).join(', ')})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Tracking for small capitals, where the canvas supports it (older Safari draws them untracked). */
function setLetterSpacing(ctx: CanvasRenderingContext2D, spacing: string) {
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = spacing;
}

/** `text` cut short with an ellipsis so it fits in `max` pixels in the current font. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/** Largest font size from `from` down to `min` at which `text` fits in `max` pixels. */
function fitSize(ctx: CanvasRenderingContext2D, text: string, font: (size: number) => string, from: number, min: number, max: number): number {
  let size = from;
  ctx.font = font(size);
  while (size > min && ctx.measureText(text).width > max) {
    size -= 2;
    ctx.font = font(size);
  }
  return size;
}

/** A team chip (Chip.tsx), `size` pixels across, with its top-left corner at (x, y). */
function drawChip(ctx: CanvasRenderingContext2D, team: TeamIndex, x: number, y: number, size: number, locked = false) {
  const { color, ink, glow } = TEAM[team];
  const shape = TEAM_STYLES[team].shape;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  const body = () => {
    ctx.beginPath();
    if (shape === 'circle') ctx.arc(12, 12, 10.5, 0, Math.PI * 2);
    else if (shape === 'diamond') {
      ctx.save();
      ctx.translate(12, 12);
      ctx.rotate(Math.PI / 4);
      roundRect(ctx, -7.8, -7.8, 15.6, 15.6, 2);
      ctx.restore();
    } else {
      ctx.moveTo(12, 1.8);
      ctx.lineTo(22.6, 21);
      ctx.lineTo(1.4, 21);
      ctx.closePath();
    }
  };
  // The glow round the chip, then a small dark drop shadow under it, as on the board.
  ctx.shadowColor = glow;
  ctx.shadowBlur = size * 0.3;
  body();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = size * 0.04;
  ctx.shadowOffsetY = size * 0.04;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = locked ? '#ffffff' : 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = locked ? 2 : 1;
  ctx.stroke();

  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  if (shape === 'circle') {
    ctx.beginPath();
    ctx.arc(12, 12, 5.5, 0, Math.PI * 2);
    ctx.lineWidth = 2.2;
    ctx.stroke();
  } else if (shape === 'diamond') {
    ctx.translate(12, 12);
    ctx.rotate(Math.PI / 4);
    ctx.lineWidth = 2;
    ctx.strokeRect(-3, -3, 6, 6);
  } else {
    ctx.beginPath();
    ctx.arc(12, 14.4, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSuit(ctx: CanvasRenderingContext2D, suit: Suit, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color;
  SUIT_PATHS[suit].forEach((d) => ctx.fill(new Path2D(d)));
  ctx.restore();
}

/** The final board, `size` pixels square, top-left at (x, y): Board.tsx without the interaction. */
function drawBoard(
  ctx: CanvasRenderingContext2D,
  board: CellView[][],
  sequences: ShareSummary['sequences'],
  lastMove: Pos | null,
  { x, y, size, deck, style }: { x: number; y: number; size: number; deck: Deck; style: BoardStyle },
) {
  const p = cellPalette(style, deck);
  const unit = size / 100; // 1cqw of the board
  const inset = BOARD_INSET * unit;
  const gap = BOARD_GAP * unit;
  const cell = (size - 2 * inset - (BOARD_SIZE - 1) * gap) / BOARD_SIZE;
  const cellX = (column: number) => x + inset + column * (cell + gap);
  const cellY = (row: number) => y + inset + row * (cell + gap);
  const radius = Math.max(2, 0.6 * unit);

  // The board's tray, with its faint green rim and shadow.
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 12;
  roundRect(ctx, x, y, size, size, 14);
  ctx.fillStyle = C.surfaceLowest;
  ctx.fill();
  ctx.restore();
  roundRect(ctx, x - 1, y - 1, size + 2, size + 2, 15);
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.22)';
  ctx.lineWidth = 2;
  ctx.stroke();

  board.flat().forEach((c) => {
    const cx = cellX(c.column);
    const cy = cellY(c.row);
    const corner = c.card === BLANK;
    roundRect(ctx, cx, cy, cell, cell, radius);
    if (corner) {
      const foil = ctx.createLinearGradient(cx, cy, cx + cell, cy + cell);
      p.corner.forEach((colour, i) => foil.addColorStop(i / 2, colour));
      ctx.fillStyle = foil;
    } else {
      ctx.fillStyle = p.face;
    }
    ctx.fill();
    ctx.strokeStyle = corner ? p.cornerEdge : p.outline;
    ctx.lineWidth = 1;
    roundRect(ctx, cx + 0.5, cy + 0.5, cell - 1, cell - 1, radius);
    ctx.stroke();

    if (corner) {
      ctx.fillStyle = p.cornerInk;
      ctx.font = `${Math.max(12, 3.6 * unit)}px ${DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', cx + cell / 2, cy + cell / 2 + unit * 0.2);
    } else {
      const card = c.card as Exclude<BoardCardName, 'Blank'>;
      const { rank, suit } = parseCard(card);
      ctx.fillStyle = p.suit(suit);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      if (deck.notation === 'numbers') {
        ctx.font = `700 ${Math.max(10, 3 * unit)}px ${DISPLAY}`;
        ctx.fillText(String(cardNumber(card)), cx + 0.6 * unit, cy + 0.35 * unit);
      } else {
        ctx.font = `700 ${Math.max(9, 2.5 * unit)}px ${DISPLAY}`;
        ctx.fillText(rank, cx + 0.6 * unit, cy + 0.35 * unit);
        const pip = Math.max(9, 2.5 * unit);
        drawSuit(ctx, suit, cx + cell - 0.5 * unit - pip, cy + cell - 0.45 * unit - pip, pip, p.suit(suit));
      }
    }

    if (lastMove && lastMove.row === c.row && lastMove.column === c.column) {
      roundRect(ctx, cx + 1, cy + 1, cell - 2, cell - 2, radius);
      ctx.strokeStyle = p.lastRing;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    if (c.chip !== null) {
      const chip = cell * 0.66;
      drawChip(ctx, c.chip, cx + (cell - chip) / 2, cy + (cell - chip) / 2, chip, c.locked);
    }
  });

  // Completed sequences: a soft glow and a dashed line through the chips' centres, in the team's colour.
  const scale = size / 640;
  sequences.forEach((s) => {
    const first = s.cells[0];
    const last = s.cells[s.cells.length - 1];
    const ax = cellX(first.column) + cell / 2;
    const ay = cellY(first.row) + cell / 2;
    const bx = cellX(last.column) + cell / 2;
    const by = cellY(last.row) + cell / 2;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = TEAM[s.team].color;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 10 * scale;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 3 * scale;
    ctx.setLineDash([6 * scale, 4 * scale]);
    ctx.stroke();
    ctx.restore();
  });
}

function drawBackground(ctx: CanvasRenderingContext2D, height: number, winner: TeamIndex | null) {
  ctx.fillStyle = C.surface;
  ctx.fillRect(0, 0, WIDTH, height);
  // A glow of the winning colour from the top, fading into the felt.
  const accent = winner !== null ? TEAM[winner].glow : 'rgba(78, 222, 163, 0.3)';
  const top = ctx.createRadialGradient(WIDTH * 0.25, 0, 0, WIDTH * 0.25, 0, WIDTH * 0.95);
  top.addColorStop(0, accent);
  top.addColorStop(1, 'rgba(11, 19, 38, 0)');
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, WIDTH, height);
  const bottom = ctx.createRadialGradient(WIDTH, height, 0, WIDTH, height, WIDTH * 0.8);
  bottom.addColorStop(0, 'rgba(59, 130, 246, 0.18)');
  bottom.addColorStop(1, 'rgba(11, 19, 38, 0)');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.globalAlpha = 1;
}

function drawHeader(ctx: CanvasRenderingContext2D, title: string) {
  // The app's logo (favicon.svg): the green chip on a dark tile.
  roundRect(ctx, PAD, HEADER_Y, 56, 56, 12);
  ctx.fillStyle = C.surfaceLowest;
  ctx.fill();
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  drawChip(ctx, 0, PAD + 9, HEADER_Y + 9, 38);

  ctx.fillStyle = C.onSurface;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `700 40px ${DISPLAY}`;
  ctx.fillText('Sequence', PAD + 76, HEADER_Y + 29);
  const brandEnd = PAD + 76 + ctx.measureText('Sequence').width;

  ctx.textAlign = 'right';
  ctx.font = `600 24px ${BODY}`;
  ctx.fillStyle = C.muted;
  ctx.fillText(fit(ctx, title, WIDTH - PAD - brandEnd - 40), WIDTH - PAD, HEADER_Y + 29);
}

function drawHeadline(ctx: CanvasRenderingContext2D, summary: ShareSummary) {
  let x = PAD;
  if (summary.winner !== null) {
    drawChip(ctx, summary.winner, PAD, HEADLINE_Y + 8, 92);
    x = PAD + 120;
  }
  const max = WIDTH - PAD - x;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  const size = fitSize(ctx, summary.headline, (s) => `700 ${s}px ${DISPLAY}`, 58, 34, max);
  ctx.font = `700 ${size}px ${DISPLAY}`;
  ctx.fillText(fit(ctx, summary.headline, max), x, HEADLINE_Y + 58);
  if (summary.subline) {
    ctx.font = `500 28px ${BODY}`;
    ctx.fillStyle = C.muted;
    ctx.fillText(fit(ctx, summary.subline, max), x, HEADLINE_Y + 102);
  }
}

function drawTeams(ctx: CanvasRenderingContext2D, teams: ShareSummary['teams']) {
  const gap = 20;
  const w = (BOARD - gap * (teams.length - 1)) / teams.length;
  teams.forEach((t, i) => {
    const x = PAD + i * (w + gap);
    const y = TEAMS_Y;
    roundRect(ctx, x, y, w, TEAM_H, 18);
    ctx.fillStyle = t.won ? mix(TEAM[t.team].color, C.surfaceContainer, 0.16) : C.surfaceContainer;
    ctx.fill();
    ctx.strokeStyle = t.won ? TEAM[t.team].color : C.outlineSubtle;
    ctx.lineWidth = t.won ? 3 : 1.5;
    ctx.stroke();

    drawChip(ctx, t.team, x + 24, y + 24, 36);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.onSurface;
    ctx.font = `600 26px ${DISPLAY}`;
    const crown = t.won ? 'Winner' : '';
    ctx.fillText(fit(ctx, t.name, w - 96 - (crown ? 100 : 0)), x + 72, y + 43);
    if (crown) {
      ctx.font = `700 16px ${BODY}`;
      const label = crown.toUpperCase();
      const lw = ctx.measureText(label).width + 20;
      roundRect(ctx, x + w - 20 - lw, y + 29, lw, 28, 14);
      ctx.fillStyle = TEAM[t.team].color;
      ctx.fill();
      ctx.fillStyle = TEAM[t.team].ink;
      ctx.textAlign = 'center';
      ctx.fillText(label, x + w - 20 - lw / 2, y + 44);
      ctx.textAlign = 'left';
    }

    ctx.font = `500 21px ${BODY}`;
    ctx.fillStyle = C.muted;
    ctx.fillText(fit(ctx, t.players.join(', ') || '—', w - 48), x + 24, y + 86);

    ctx.textBaseline = 'alphabetic';
    ctx.font = `700 60px ${DISPLAY}`;
    ctx.fillStyle = t.won ? '#ffffff' : C.onSurface;
    const score = String(t.score);
    ctx.fillText(score, x + 24, y + TEAM_H - 22);
    const sw = ctx.measureText(score).width;
    ctx.font = `500 21px ${BODY}`;
    ctx.fillStyle = C.muted;
    ctx.fillText(fit(ctx, t.scoreLabel, w - sw - 60), x + 24 + sw + 12, y + TEAM_H - 26);
  });
}

function drawFacts(ctx: CanvasRenderingContext2D, facts: ShareSummary['facts']) {
  const gap = 20;
  const w = (BOARD - gap * (facts.length - 1)) / facts.length;
  facts.forEach((f, i) => {
    const x = PAD + i * (w + gap);
    roundRect(ctx, x, FACTS_Y, w, FACT_H, 16);
    ctx.fillStyle = 'rgba(34, 42, 61, 0.7)';
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `700 16px ${BODY}`;
    ctx.fillStyle = C.muted;
    setLetterSpacing(ctx, '2px');
    ctx.fillText(f.label.toUpperCase(), x + 22, FACTS_Y + 38);
    setLetterSpacing(ctx, '0px');
    ctx.fillStyle = C.onSurface;
    const size = fitSize(ctx, f.value, (s) => `700 ${s}px ${DISPLAY}`, 34, 22, w - 44);
    ctx.font = `700 ${size}px ${DISPLAY}`;
    ctx.fillText(fit(ctx, f.value, w - 44), x + 22, FACTS_Y + 84);
  });
}

function drawFooter(ctx: CanvasRenderingContext2D, host: string) {
  ctx.fillStyle = C.outlineSubtle;
  ctx.fillRect(PAD, FOOTER_Y, BOARD, 1.5);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `500 22px ${BODY}`;
  ctx.fillStyle = C.muted;
  const lead = 'Play at ';
  ctx.fillText(lead, PAD, FOOTER_Y + 46);
  ctx.font = `700 22px ${DISPLAY}`;
  ctx.fillStyle = C.primary;
  ctx.fillText(host, PAD + ctx.measureText(lead).width + 4, FOOTER_Y + 46);
  ctx.textAlign = 'right';
  ctx.font = `500 20px ${BODY}`;
  ctx.fillStyle = C.muted;
  ctx.fillText(creditLine(), WIDTH - PAD, FOOTER_Y + 46);
}

/** Waits for the app's two typefaces, so the image never falls back to a system font. */
async function fontsReady() {
  if (typeof document === 'undefined' || !document.fonts) return;
  const loads = ['700 40px "Space Grotesk"', '600 26px "Space Grotesk"', '500 22px "Hanken Grotesk"', '600 24px "Hanken Grotesk"'].map((font) =>
    document.fonts.load(font).catch(() => []),
  );
  await Promise.race([Promise.all(loads), new Promise((resolve) => setTimeout(resolve, 2500))]);
}

/** Paints the share card for `summary` and returns it as a PNG. */
export async function drawShareImage(summary: ShareSummary, look: { deck: Deck; boardStyle: BoardStyle; host: string }): Promise<Blob> {
  await fontsReady();
  const canvas = document.createElement('canvas');
  canvas.width = SHARE_IMAGE_SIZE.width;
  canvas.height = SHARE_IMAGE_SIZE.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw the result image.');

  drawBackground(ctx, canvas.height, summary.winner);
  drawHeader(ctx, summary.title);
  drawHeadline(ctx, summary);
  drawBoard(ctx, summary.board, summary.sequences, summary.lastMove, { x: PAD, y: BOARD_Y, size: BOARD, deck: look.deck, style: look.boardStyle });
  drawTeams(ctx, summary.teams);
  drawFacts(ctx, summary.facts);
  drawFooter(ctx, look.host);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The result image could not be made.'))), 'image/png'),
  );
}
