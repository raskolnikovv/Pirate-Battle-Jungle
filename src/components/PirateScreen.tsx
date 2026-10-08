import type { ReactNode } from 'react';
import { pirateThemeStyle } from './pirateTheme';
import './PirateUI.css';

export function PirateScreen({ title, children }: { title: string; children: ReactNode }) {
  return <main className="pirate-ui pirate-screen" style={pirateThemeStyle}>
    <div className="menu-panel pirate-screen-panel">
      <h1 className="pirate-title">{title}</h1>
      {children}
    </div>
  </main>;
}
