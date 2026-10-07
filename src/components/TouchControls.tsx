import { useEffect, useRef, type PointerEvent, type KeyboardEvent } from 'react';
import type { InputSnapshot, InputAction } from '@/game/input/InputManager';
import { TOUCH_ASSET_MANIFEST } from '@/game/assets/touchAssets';

interface TouchControlsProps {
  onInput: (pointerId: number, intentions: Partial<InputSnapshot>) => void;
  onRelease: (pointerId: number) => void;
}
const attacks = [
  { action: 'fireLeft', label: 'Left broadside', icon: TOUCH_ASSET_MANIFEST.left },
  { action: 'fireFront', label: 'Front shot', icon: TOUCH_ASSET_MANIFEST.front },
  { action: 'fireRight', label: 'Right broadside', icon: TOUCH_ASSET_MANIFEST.right },
] as const;
const DEAD_ZONE = 0.22;

export function TouchControls({ onInput, onRelease }: TouchControlsProps) {
  const pointers = useRef(new Map<number, HTMLButtonElement>());
  const joystickPointer = useRef<number | null>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const activePointers = pointers.current;
    const thumb = thumbRef.current;
    function clear() {
      for (const [id, button] of activePointers) {
        onRelease(id);
        button.dataset.pressed = 'false';
        if (button.hasPointerCapture(id)) button.releasePointerCapture(id);
      }
      activePointers.clear();
      joystickPointer.current = null;
      if (thumb) thumb.style.transform = 'translate(0px, 0px)';
    }
    window.addEventListener('blur', clear);
    window.addEventListener('resize', clear);
    const hidden = () => { if (document.hidden) clear(); };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      clear();
      window.removeEventListener('blur', clear);
      window.removeEventListener('resize', clear);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [onRelease]);

  function updateJoystick(event: PointerEvent<HTMLButtonElement>) {
    if (joystickPointer.current !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    let x = (event.clientX - bounds.left - bounds.width / 2) / (bounds.width / 2);
    let y = (event.clientY - bounds.top - bounds.height / 2) / (bounds.height / 2);
    const length = Math.max(1, Math.hypot(x, y));
    x /= length; y /= length;
    onInput(event.pointerId, { touchDirection: Math.hypot(x, y) > DEAD_ZONE ? { x, y } : null });
    if (thumbRef.current) {
      thumbRef.current.style.transform = `translate(${x * bounds.width * 0.3}px, ${y * bounds.height * 0.3}px)`;
    }
  }

  function press(event: PointerEvent<HTMLButtonElement>, action?: InputAction) {
    if (event.button !== 0 || (!action && joystickPointer.current !== null)) return;
    event.preventDefault();
    pointers.current.set(event.pointerId, event.currentTarget);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.pressed = 'true';
    if (action) onInput(event.pointerId, { [action]: true });
    else { joystickPointer.current = event.pointerId; updateJoystick(event); }
  }

  function release(event: PointerEvent<HTMLButtonElement>) {
    if (pointers.current.get(event.pointerId) !== event.currentTarget) return;
    releaseId(event.pointerId, event.currentTarget);
  }

  function releaseId(id: number, button: HTMLButtonElement) {
    onRelease(id);
    pointers.current.delete(id);
    if (![...pointers.current.values()].includes(button)) button.dataset.pressed = 'false';
    if (joystickPointer.current === id) {
      joystickPointer.current = null;
      if (thumbRef.current) thumbRef.current.style.transform = 'translate(0px, 0px)';
    }
    if (button.hasPointerCapture(id)) button.releasePointerCapture(id);
  }

  function keyboardAttack(event: KeyboardEvent<HTMLButtonElement>, action: InputAction, id: number, held: boolean) {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    if (held) {
      if (event.repeat) return;
      pointers.current.set(id, event.currentTarget);
      event.currentTarget.dataset.pressed = 'true';
      onInput(id, { [action]: true });
    } else releaseId(id, event.currentTarget);
  }

  return <section className="touch-controls" aria-label="Touch gameplay controls">
    <div className="touch-movement">
      <button type="button" className="touch-joystick" aria-label="Move and steer" aria-describedby="touch-instructions"
        onPointerDown={(event) => press(event)} onPointerMove={updateJoystick}
        onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
        <span ref={thumbRef} className="joystick-thumb" />
      </button>
      <p id="touch-instructions">Drag to steer</p>
    </div>
    <div className="touch-attacks" role="group" aria-label="Hold to attack">
      {attacks.map(({ action, label, icon }, index) => <button type="button" key={action} className="touch-attack" aria-label={label}
        onKeyDown={(event) => keyboardAttack(event, action, -index - 1, true)}
        onKeyUp={(event) => keyboardAttack(event, action, -index - 1, false)}
        onBlur={(event) => releaseId(-index - 1, event.currentTarget)}
        onPointerDown={(event) => press(event, action)} onPointerUp={release}
        onPointerCancel={release} onLostPointerCapture={release}>
        <span className="touch-attack-art" aria-hidden="true">
          <img className="control-normal" src={TOUCH_ASSET_MANIFEST.buttonNormal} alt="" />
          <img className="control-pressed" src={TOUCH_ASSET_MANIFEST.buttonPressed} alt="" />
          <img className="touch-attack-icon" src={icon} alt="" />
        </span>
        <span>{label}</span>
      </button>)}
      <p>Hold to fire</p>
    </div>
  </section>;
}
