import type { CSSProperties, ReactNode } from 'react';
import { MENU_ASSET_MANIFEST } from '@/game/assets/menuAssets';

export function LoadingScreen({ title, progress, className = '', error, children }: {
  title: string; progress?: number; className?: string; error?: boolean; children?: ReactNode;
}) {
  return <div className={`loading-screen ${className}`} style={{
    '--loading-background': `url("${MENU_ASSET_MANIFEST.mainMenuBackground}")`,
  } as CSSProperties}>
    <div className="loading-card">
      <p role={error ? 'alert' : 'status'}>{title}</p>
      {!error && <>
        <progress aria-label={title} max={1} value={progress} />
        <p className="loading-percentage" aria-hidden="true">{progress === undefined ? 'Preparing...' : `${Math.round(progress * 100)}%`}</p>
      </>}
      {children}
    </div>
  </div>;
}
