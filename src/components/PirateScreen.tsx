import type { ReactNode } from 'react';
import { pirateThemeStyle } from './pirateTheme';
import './PirateUI.css';
import { MENU_ASSET_MANIFEST } from '@/game/assets/menuAssets';

export function PirateScreen({ title, children, menuBackground = false }: { title: string; children: ReactNode; menuBackground?: boolean }) {
  return <main className="pirate-ui pirate-screen" style={{ ...pirateThemeStyle,
    ...(menuBackground
      ? { '--menu-background': `url("${MENU_ASSET_MANIFEST.mainMenuBackground}")` } : {}),
  }}>
    <div className="menu-panel pirate-screen-panel">
      <h1 className="pirate-title">{title}</h1>
      {children}
    </div>
  </main>;
}
