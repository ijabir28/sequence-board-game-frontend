# Card decks

The designs a player can choose for the cards in their hand (src/decks/decks.ts). Each folder holds the 52 faces,
named after the game's cards (`7-Heart.svg`, `Q-Spade.svg`, as in src/engine/cards.ts), and `back.svg`.

| Folder | Source | Licence |
|---|---|---|
| `classic` | Byron Knoll's [vector-playing-cards](https://code.google.com/p/vector-playing-cards/), as packaged in [MattCain/svg-playing-cards](https://github.com/MattCain/svg-playing-cards) (`imgs/`) | Public domain (the MattCain repo itself is MIT) |
| `jumbo` | [saulspatz/SVGCards](https://github.com/saulspatz/SVGCards), `Decks/Vertical2/svgs` | Public domain |
| `four-colour` | [saulspatz/SVGCards](https://github.com/saulspatz/SVGCards), `Decks/Accessible/Vertical/svgs` | Public domain |

The deck called Original is the one the backend serves at `/images/card_deck/`, and Minimal is drawn by the app
(src/components/cards/DrawnCard.tsx), as is Numbered (src/components/cards/NumberedCard.tsx), so none of them has a
folder here.

## Regenerating

The files are the sources run through [SVGO](https://github.com/svg/svgo) 3.3.2, which more than halves them (the
SVGCards court cards are up to 1 MB each), then renamed and given a viewBox by `scripts/prepare-deck.mjs`:

```bash
npx svgo@3.3.2 -q --multipass -p 2 -f <svg-playing-cards>/imgs -o /tmp/classic
node scripts/prepare-deck.mjs knoll /tmp/classic classic

npx svgo@3.3.2 -q --multipass -p 1 -f <SVGCards>/Decks/Vertical2/svgs -o /tmp/jumbo
node scripts/prepare-deck.mjs spatz /tmp/jumbo jumbo

npx svgo@3.3.2 -q --multipass -p 1 -f <SVGCards>/Decks/Accessible/Vertical/svgs -o /tmp/four-colour
node scripts/prepare-deck.mjs spatz /tmp/four-colour four-colour
```

A new deck needs an entry in `DECKS` (src/decks/decks.ts) with its aspect ratio (width over height of its cards).
