import type { AudioManager } from './AudioManager';
import { UI_ACTION_SOUNDS } from './audioAssets';

// One delegated set for all screens; no per-button listeners or React sound state.
export function attachUiSounds(audio: AudioManager): () => void {
  let keyboardNavigation = false;
  let pointerX: number | null = null;
  let pointerY: number | null = null;
  const control = (target: EventTarget | null): HTMLElement | null => {
    if (!(target instanceof Element)) return null;
    const element = target.closest<HTMLElement>('button, a[href], summary, input[type="checkbox"]');
    if (!element || element.closest('.touch-controls') || element.dataset.uiSound === 'none'
      || element.matches(':disabled, [aria-disabled="true"]')) return null;
    return element;
  };
  const hover = () => audio.playUi('uiHover');
  const pointerDown = (event: PointerEvent) => {
    keyboardNavigation = false;
    if (event.pointerType === 'mouse') { pointerX = event.clientX; pointerY = event.clientY; }
  };
  const keyDown = (event: KeyboardEvent) => { keyboardNavigation = event.key === 'Tab'; };
  const pointerOver = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    // Navigation can move a new button under a stationary cursor. That is not a hover gesture.
    const moved = event.clientX !== pointerX || event.clientY !== pointerY;
    pointerX = event.clientX; pointerY = event.clientY;
    if (!moved) return;
    const element = control(event.target);
    if (!element || (event.relatedTarget instanceof Node && element.contains(event.relatedTarget))) return;
    hover();
  };
  const focusIn = (event: FocusEvent) => {
    if (keyboardNavigation && control(event.target)) hover();
  };
  const click = (event: MouseEvent) => {
    const element = control(event.target);
    if (!element || event.defaultPrevented) return;
    if (element.tagName === 'SUMMARY') {
      const details = element.closest('details');
      audio.playUi(details?.open ? 'uiClose' : 'uiOpen');
      return;
    }
    const action = element.dataset.uiSound ?? 'click';
    if (action in UI_ACTION_SOUNDS) {
      audio.playUi(UI_ACTION_SOUNDS[action as keyof typeof UI_ACTION_SOUNDS]);
    }
  };
  // Click runs after React's handler: mute takes effect before audio, and navigation
  // cleanup finishes before the new UI cue starts. Native keyboard activation is a click too.
  window.addEventListener('pointerdown', pointerDown, true);
  window.addEventListener('keydown', keyDown, true);
  document.addEventListener('pointerover', pointerOver);
  document.addEventListener('focusin', focusIn);
  document.addEventListener('click', click);
  return () => {
    window.removeEventListener('pointerdown', pointerDown, true);
    window.removeEventListener('keydown', keyDown, true);
    document.removeEventListener('pointerover', pointerOver);
    document.removeEventListener('focusin', focusIn);
    document.removeEventListener('click', click);
  };
}
