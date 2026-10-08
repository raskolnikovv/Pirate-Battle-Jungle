import { useEffect, useState, type ReactNode } from 'react';
import { LoadingScreen } from './LoadingScreen';
import { loadMenuAssets, subscribeMenuAssetProgress } from '@/game/assets/menuAssets';

export function MenuAssetLoader({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [progress, setProgress] = useState(0);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribeMenuAssetProgress((loaded, total) => { if (!cancelled) setProgress(loaded / total); });
    void loadMenuAssets().then(() => {
      if (!cancelled) setStatus('ready');
    }).catch(() => {
      if (!cancelled) setStatus('error');
    });
    return () => { cancelled = true; unsubscribe(); };
  }, [attempt]);
  if (status === 'ready') return children;
  return <main aria-label="Pirate Battle loading">
    <LoadingScreen className="menu-loader" progress={progress} error={status === 'error'}
      title={status === 'loading' ? 'Loading Pirate Battle...' : 'Unable to load menu images. Check your connection and try again.'}>
      {status === 'error' && <button type="button" onClick={() => { setProgress(0); setStatus('loading'); setAttempt(value => value + 1); }}>Retry loading</button>}
    </LoadingScreen>
  </main>;
}
