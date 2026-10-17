#!/usr/bin/env node
// Copies one source deck's SVGs into public/decks/<id>/ under the app's card names (`<rank>-<Suit>.svg`, as in
// src/engine/cards.ts) plus `back.svg`, and gives each file a viewBox so it scales to any card size.
// Run the sources through SVGO first; see public/decks/README.md for the exact commands and where each deck is from.
//
//   node scripts/prepare-deck.mjs <knoll|spatz> <source dir> <deck id>

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SUITS = { club: 'Club', diamond: 'Diamond', heart: 'Heart', spade: 'Spade' };
const RANKS = { ace: 'A', jack: 'J', queen: 'Q', king: 'K' };

// Source file name to the app's card name, or null for files the game doesn't use (jokers, other backs).
const NAMING = {
  // Byron Knoll's set, as packaged by MattCain/svg-playing-cards: `7_of_hearts.svg`, `queen_of_spades.svg`, `back.svg`.
  knoll(file) {
    if (file === 'back.svg') return 'back';
    const match = /^(\w+)_of_(club|diamond|heart|spade)s\.svg$/.exec(file);
    return match ? `${RANKS[match[1]] ?? match[1]}-${SUITS[match[2]]}` : null;
  },
  // saulspatz/SVGCards: `heart7.svg`, `spadeQueen.svg`, `blueBack.svg`.
  spatz(file) {
    if (file === 'blueBack.svg') return 'back';
    const match = /^(club|diamond|heart|spade)(\w+)\.svg$/.exec(file);
    return match ? `${RANKS[match[2].toLowerCase()] ?? match[2]}-${SUITS[match[1]]}` : null;
  },
};

const [style, source, id] = process.argv.slice(2);
if (!NAMING[style] || !source || !id) {
  console.error('usage: node scripts/prepare-deck.mjs <knoll|spatz> <source dir> <deck id>');
  process.exit(1);
}

const target = join(import.meta.dirname, '..', 'public', 'decks', id);
mkdirSync(target, { recursive: true });
let count = 0;
for (const file of readdirSync(source)) {
  const name = NAMING[style](file);
  if (!name) continue;
  let svg = readFileSync(join(source, file), 'utf8');
  const root = /<svg\b[^>]*>/.exec(svg)[0];
  if (!/\sviewBox=/.test(root)) {
    const width = /\swidth="([\d.]+)/.exec(root)[1];
    const height = /\sheight="([\d.]+)/.exec(root)[1];
    svg = svg.replace(root, root.replace('<svg', `<svg viewBox="0 0 ${width} ${height}"`));
  }
  writeFileSync(join(target, `${name}.svg`), svg);
  count++;
}
console.log(`${count} cards written to public/decks/${id}`);
if (count !== 53) process.exitCode = 1;
