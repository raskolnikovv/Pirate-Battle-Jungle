export const DISPLAY_STORAGE_KEY = 'pirate-battle:display:v1';
let showFps: boolean | null = null;
const listeners = new Set<() => void>();

function loadShowFps(): boolean {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(DISPLAY_STORAGE_KEY) ?? 'null');
    if (value && typeof value === 'object' && 'version' in value && value.version === 1
      && 'showFps' in value && typeof value.showFps === 'boolean') return value.showFps;
  } catch { /* Missing, corrupt or unavailable storage uses the default. */ }
  return false;
}

export function getShowFps(): boolean { return showFps ??= loadShowFps(); }
export function subscribeDisplayPreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function saveShowFps(enabled: boolean): boolean {
  let saved = true;
  try { localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify({ version: 1, showFps: enabled })); }
  catch { saved = false; }
  showFps = enabled;
  for (const listener of listeners) listener();
  return saved;
}
