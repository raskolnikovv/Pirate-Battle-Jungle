export interface InputSnapshot {
  forward: boolean;
  turnLeft: boolean;
  turnRight: boolean;
  fireFront: boolean;
  fireLeft: boolean;
  fireRight: boolean;
}

const DEFAULT_SNAPSHOT: InputSnapshot = {
  forward: false,
  turnLeft: false,
  turnRight: false,
  fireFront: false,
  fireLeft: false,
  fireRight: false,
};

const GAMEPLAY_KEYS = [' ', 'q', 'e', 'w', 'arrowup', 'a', 'arrowleft', 'd', 'arrowright'];

export class InputManager {
  private readonly state: InputSnapshot = { ...DEFAULT_SNAPSHOT };
  private target: Window | null = null;

  private readonly boundKeyDown = (event: KeyboardEvent) => {
    // Held keys from before/during pause must require a fresh press after resume.
    if (event.repeat) {
      if (GAMEPLAY_KEYS.includes(event.key.toLowerCase())) event.preventDefault();
      return;
    }
    this.applyKey(event, true);
  };

  private readonly boundKeyUp = (event: KeyboardEvent) => {
    this.applyKey(event, false);
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
  }

  detach(): void {
    if (this.target) {
      this.target.removeEventListener('keydown', this.boundKeyDown);
      this.target.removeEventListener('keyup', this.boundKeyUp);
      this.target.removeEventListener('blur', this.boundBlur);
      this.target = null;
    }

    this.reset();
  }

  snapshot(): InputSnapshot {
    return { ...this.state };
  }

  private applyKey(event: KeyboardEvent, pressed: boolean): void {
    switch (event.key.toLowerCase()) {
      case ' ':
        event.preventDefault();
        this.state.fireFront = pressed;
        break;
      case 'q':
        event.preventDefault();
        this.state.fireLeft = pressed;
        break;
      case 'e':
        event.preventDefault();
        this.state.fireRight = pressed;
        break;
      case 'w':
      case 'arrowup':
        event.preventDefault();
        this.state.forward = pressed;
        break;
      case 'a':
      case 'arrowleft':
        event.preventDefault();
        this.state.turnLeft = pressed;
        break;
      case 'd':
      case 'arrowright':
        event.preventDefault();
        this.state.turnRight = pressed;
        break;
      default:
        return;
    }
  }

  private reset(): void {
    Object.assign(this.state, DEFAULT_SNAPSHOT);
  }
}
