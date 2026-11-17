// Keyboard and pointer input for driving.
// WASD / arrows steer and accelerate/brake; one-shot presses (start, restart, pause) are queued
// as bit flags and taken once by the loop, so a press between two frames is never lost or doubled.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(target) {
  let up = false, down = false, left = false, right = false;
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  });
  // Keys released while the tab is hidden never send keyup: let go of everything on blur.
  window.addEventListener('blur', () => { up = false; down = false; left = false; right = false; });
  target.addEventListener('pointerdown', () => { actions |= ACTION_CONFIRM; });

  return {
    /** +1 forward (W/Up), -1 reverse/brake (S/Down), 0 neither. */
    throttle() { return (up ? 1 : 0) - (down ? 1 : 0); },
    /** +1 right (D/Right), -1 left (A/Left), 0 neither or both. */
    steer() { return (right ? 1 : 0) - (left ? 1 : 0); },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() { const taken = actions; actions = 0; return taken; },
  };
}
