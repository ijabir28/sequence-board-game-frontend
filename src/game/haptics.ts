/*
 * Haptic feedback for phones. Android browsers have the Vibration API (once the page has had a tap). iOS Safari has
 * none, but toggling a native switch (`<input type="checkbox" switch>`, Safari 18+) makes the phone tick, so that is
 * the fallback there. Elsewhere both are no-ops.
 */

/** Your turn: two short buzzes, distinct from a notification's single one. */
const TURN_PATTERN = [120, 80, 120];

let iosSwitch: HTMLLabelElement | null = null;

function iosTick() {
  if (typeof document === 'undefined') return;
  if (!iosSwitch) {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:-9999px';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

/** Buzzes the phone when the turn passes to this player. */
export function vibrateTurn() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(TURN_PATTERN);
    } catch {
      // Refused (no tap on the page yet): nothing to do.
    }
    return;
  }
  // iOS: two ticks, like the buzz pattern.
  iosTick();
  setTimeout(iosTick, 200);
}
