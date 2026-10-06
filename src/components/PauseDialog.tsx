import { useEffect, useRef } from 'react';

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
    <dialog ref={dialogRef} className="pause-dialog" aria-labelledby="pause-title"
      aria-describedby="pause-description" onCancel={(event) => event.preventDefault()}>
      <h2 id="pause-title">Game Paused</h2>
      <p id="pause-description">The match is frozen. Select Resume when you are ready to continue.</p>
      <button ref={resumeRef} className="pause-action" onClick={onResume}>Resume</button>
    </dialog>
  );
}
