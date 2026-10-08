import { useEffect, useRef } from 'react';
import { pirateThemeStyle } from './pirateTheme';
import './PirateUI.css';

interface PauseDialogProps {
  paused: boolean;
  onResume: () => void;
}

export function PauseDialog({ paused, onResume }: PauseDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resumeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!paused || !dialog) return;
    dialog.showModal();
    resumeRef.current?.focus();
    return () => dialog.close();
  }, [paused]);

  return (
    <dialog ref={dialogRef} className="pause-dialog pirate-ui pirate-pause" style={pirateThemeStyle} aria-labelledby="pause-title"
      aria-describedby="pause-description" onCancel={(event) => event.preventDefault()}>
      <div className="menu-panel">
        <h2 id="pause-title" className="pirate-title">Game Paused</h2>
        <p id="pause-description">The match is frozen. Select Resume when you are ready to continue.</p>
        <button ref={resumeRef} type="button" className="menu-button menu-button-primary" onClick={onResume}>Resume</button>
      </div>
    </dialog>
  );
}
