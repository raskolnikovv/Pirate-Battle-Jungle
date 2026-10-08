import { useEffect, useRef, useState } from 'react';
import { OptionsForm } from '@/screens/Options';
import { pirateThemeStyle } from './pirateTheme';
import './PirateUI.css';

interface PauseDialogProps {
  paused: boolean;
  onResume: () => void;
  onQuit: () => void;
}

export function PauseDialog({ paused, onResume, onQuit }: PauseDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resumeRef = useRef<HTMLButtonElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const [showOptions, setShowOptions] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!paused || !dialog) return;
    setShowOptions(false);
    dialog.showModal();
    resumeRef.current?.focus();
    return () => dialog.close();
  }, [paused]);

  useEffect(() => {
    if (!paused) return;
    if (showOptions) optionsRef.current?.querySelector('input')?.focus();
    else resumeRef.current?.focus();
  }, [showOptions, paused]);

  return (
    <dialog ref={dialogRef} className="pause-dialog pirate-ui pirate-pause" style={pirateThemeStyle} aria-labelledby="pause-title"
      aria-describedby="pause-description" onCancel={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)');
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus();
        }
      }}>
      <div className="menu-panel">
        <h2 id="pause-title" className="pirate-title">{showOptions ? 'Options' : 'Game Paused'}</h2>
        <p id="pause-description">{showOptions ? 'The current match stays paused. Saved settings apply only to future matches.' : 'The match is frozen. Select Resume when you are ready to continue.'}</p>
        {showOptions ? <div ref={optionsRef}><OptionsForm onBack={() => setShowOptions(false)} /></div> :
          <div className="pause-navigation">
            <button ref={resumeRef} type="button" className="menu-button menu-button-primary" onClick={onResume}>Resume</button>
            <button type="button" className="menu-button menu-button-primary" onClick={() => setShowOptions(true)}>Options</button>
            <button type="button" className="menu-button menu-button-secondary" onClick={onQuit}>Main Menu</button>
          </div>}
      </div>
    </dialog>
  );
}
