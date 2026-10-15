import { describe, expect, it } from 'vitest';
import { describeHint } from './describeHint';

describe('describeHint', () => {
  const hand = ['6-Diamond', 'J-Club', 'J-Spade', '7-Heart'] as const;

  it('words each kind of suggestion', () => {
    const at = { row: 0, column: 1 }; // the 6♦ cell
    expect(describeHint({ type: 'play', handIndex: 0, target: at, reason: { kind: 'sequence' } }, hand)).toBe('Play 6♦ on 6♦: it completes a sequence.');
    expect(describeHint({ type: 'play', handIndex: 1, target: at, reason: { kind: 'extend', length: 3 } }, hand)).toBe(
      'Play wild J♣ on 6♦: it builds your line to 3.',
    );
    expect(describeHint({ type: 'play', handIndex: 0, target: at, reason: { kind: 'block', length: 4, team: 1 } }, hand)).toBe(
      "Play 6♦ on 6♦: it blocks Team Blue's line of 4.",
    );
    expect(describeHint({ type: 'play', handIndex: 0, target: at, reason: { kind: 'block', length: 5, team: 2 } }, hand)).toBe(
      'Play 6♦ on 6♦: otherwise Team Red can complete a sequence there.',
    );
    expect(describeHint({ type: 'play', handIndex: 2, target: at, reason: { kind: 'break', length: 3, team: 1 } }, hand)).toBe(
      "Use J♠ to remove Team Blue's chip on 6♦. It breaks up their line of 3.",
    );
    expect(describeHint({ type: 'exchange', handIndex: 3, reason: { kind: 'dead' } }, hand)).toMatch(/^7♥ is dead/);
    expect(describeHint({ type: 'pass', reason: { kind: 'pass' } }, hand)).toMatch(/Pass your turn/);
  });
});
