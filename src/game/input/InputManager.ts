export interface InputSnapshot {
  // Screen-space direction: x points right, y points down; length is throttle.
  touchDirection: { x: number; y: number } | null;
  forward: boolean;
  turnLeft: boolean;
  turnRight: boolean;
  fireFront: boolean;
  fireLeft: boolean;
  fireRight: boolean;
}

const DEFAULT_SNAPSHOT: InputSnapshot = {
  touchDirection: null,
  forward: false,
  turnLeft: false,
  turnRight: false,
  fireFront: false,
  fireLeft: false,
  fireRight: false,
};

const GAMEPLAY_KEYS = [' ', 'q', 'e', 'w', 'arrowup', 'a', 'arrowleft', 'd', 'arrowright'];

export type InputAction = keyof Omit<InputSnapshot, 'touchDirection'>;
const KEY_ACTIONS: Record<string, InputAction> = {
  w: 'forward', arrowup: 'forward', a: 'turnLeft', arrowleft: 'turnLeft',
  d: 'turnRight', arrowright: 'turnRight', ' ': 'fireFront', q: 'fireLeft', e: 'fireRight',
};

// Native controls and editable content keep their own keyboard behavior.
function isInteractive(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest(
    'button, a[href], input, select, textarea, summary, [contenteditable]:not([contenteditable="false"]), '
    + '[role="button"], [role="link"], [role="textbox"], [role="slider"], [role="combobox"], '
    + '[role="checkbox"], [role="radio"], [role="switch"], [role="spinbutton"], [role="menuitem"], [role="listbox"]',
  );
}

export class InputManager {
  private readonly keys = new Set<string>();
  private readonly pointers = new Map<number, Partial<InputSnapshot>>();
  private target: Window | null = null;

  private readonly boundKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.composedPath().some(isInteractive)) return;
    // Held keys from before/during pause must require a fresh press after resume.
    if (event.repeat) {
      if (GAMEPLAY_KEYS.includes(event.key.toLowerCase())) event.preventDefault();
      return;
    }
    this.applyKey(event, true);
  };

  private readonly boundKeyUp = (event: KeyboardEvent) => {
    // Always release a held key, even if focus moved to a control before keyup.
    this.keys.delete(event.key.toLowerCase());
    if (!event.composedPath().some(isInteractive)) this.applyKey(event, false);
  };

  private readonly boundFocusIn = (event: FocusEvent) => {
    if (isInteractive(event.target)) this.keys.clear();
  };

  private readonly boundBlur = () => {
    this.reset();
  };

  attach(target: Window = window): void {
    if (this.target === target) return;
    this.detach();

    this.target = target;
    target.addEventListener('keydown', this.boundKeyDown);
    target.addEventListener('keyup', this.boundKeyUp);
    target.addEventListener('blur', this.boundBlur);
    target.addEventListener('focusin', this.boundFocusIn);
  }

  detach(): void {
    if (this.target) {
      this.target.removeEventListener('keydown', this.boundKeyDown);
      this.target.removeEventListener('keyup', this.boundKeyUp);
      this.target.removeEventListener('blur', this.boundBlur);
      this.target.removeEventListener('focusin', this.boundFocusIn);
      this.target = null;
    }

    this.reset();
  }

  snapshot(): InputSnapshot {
    const snapshot = { ...DEFAULT_SNAPSHOT };
    for (const key of this.keys) snapshot[KEY_ACTIONS[key]] = true;
    for (const intentions of this.pointers.values()) {
      for (const action of Object.values(KEY_ACTIONS)) {
        if (intentions[action]) snapshot[action] = true;
      }
      if (intentions.touchDirection) snapshot.touchDirection = { ...intentions.touchDirection };
    }
    return snapshot;
  }

  setPointerInput(pointerId: number, intentions: Partial<InputSnapshot>): void {
    if (this.target) this.pointers.set(pointerId, { ...intentions });
  }

  releasePointer(pointerId: number): void { this.pointers.delete(pointerId); }

  private applyKey(event: KeyboardEvent, pressed: boolean): void {
    const key = event.key.toLowerCase();
    if (!KEY_ACTIONS[key]) return;
    event.preventDefault();
    if (pressed) this.keys.add(key); else this.keys.delete(key);
  }

  private reset(): void {
    this.keys.clear();
    this.pointers.clear();
  }
}
