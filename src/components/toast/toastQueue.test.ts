import { describe, expect, it } from 'vitest';
import { MAX_TOASTS, toastReducer, type Toast } from './toastQueue';

const show = (id: string, text: string, tone: Toast['tone'] = 'info') =>
  ({ type: 'show', toast: { id, text, tone, durationMs: 4000 } }) as const;

describe('toastReducer', () => {
  it('adds toasts in order and dismisses them by id', () => {
    let toasts = toastReducer([], show('a', 'One'));
    toasts = toastReducer(toasts, show('b', 'Two', 'error'));
    expect(toasts.map((t) => t.text)).toEqual(['One', 'Two']);
    expect(toastReducer(toasts, { type: 'dismiss', id: 'a' }).map((t) => t.id)).toEqual(['b']);
  });

  it('replaces a toast shown again with the same id, restarting it', () => {
    let toasts = toastReducer([], show('form', 'Wrong password', 'error'));
    toasts = toastReducer(toasts, show('form', 'Signed in', 'success'));
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ text: 'Signed in', tone: 'success', version: 1 });
  });

  it('restarts a repeated message instead of stacking it', () => {
    let toasts = toastReducer([], show('a', 'Same'));
    toasts = toastReducer(toasts, show('b', 'Same'));
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ id: 'a', version: 1 });
  });

  it(`keeps at most ${MAX_TOASTS}, dropping the oldest`, () => {
    let toasts: Toast[] = [];
    for (let i = 0; i < MAX_TOASTS + 2; i++) toasts = toastReducer(toasts, show(String(i), `Message ${i}`));
    expect(toasts.map((t) => t.id)).toEqual(['2', '3', '4']);
  });
});
