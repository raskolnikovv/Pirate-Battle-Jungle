import { NavButton } from '@/components/NavButton';
import type { ScreenName } from '@/app/navigationTypes';
import { PendingSubmissions } from '@/components/PendingSubmissions';
import { NetworkScenarioControls } from '@/components/NetworkScenarioControls';
import { MENU_ASSET_MANIFEST as assets } from '@/game/assets/menuAssets';
import { pirateThemeStyle } from '@/components/pirateTheme';
import '@/components/PirateUI.css';
import './MainMenu.css';

interface MainMenuProps {
  onNavigate: (screen: ScreenName) => void;
}

export function MainMenu({ onNavigate }: MainMenuProps) {
  return (
    <main className="main-menu pirate-ui" style={pirateThemeStyle}>
      <div className="menu-panel">
        <header className="menu-heading">
          <h1><span className="menu-sr-only">Pirate Battle</span>
            <img src={assets.title} alt="" width="768" height="256" />
          </h1>
          <p className="menu-tagline">Set sail. Take command.</p>
          <p>Navigate the islands. Defeat enemy ships. Survive the battle.</p>
        </header>
        <div className="menu-content">
          <nav className="menu-navigation" aria-label="Main navigation">
            <NavButton unstyled className="menu-button menu-button-primary" onClick={() => onNavigate('game')}>Start Game</NavButton>
            <NavButton unstyled className="menu-button menu-button-primary" onClick={() => onNavigate('options')}>Options</NavButton>
            <div className="menu-record-buttons">
              <NavButton unstyled className="menu-button menu-button-secondary" onClick={() => onNavigate('ranking')}>Ranking</NavButton>
              <NavButton unstyled className="menu-button menu-button-secondary" onClick={() => onNavigate('match-history')}>Match History</NavButton>
            </div>
          </nav>
          <section className="menu-instructions" aria-labelledby="menu-controls-title">
            <h2 id="menu-controls-title">How to play</h2>
            <div className="menu-control-columns">
              <section aria-labelledby="menu-keyboard-title">
                <h3 id="menu-keyboard-title">Keyboard</h3>
                <dl>
                  <div><dt><kbd>W</kbd> / <kbd aria-label="Arrow Up">↑</kbd></dt><dd>Move forward</dd></div>
                  <div><dt><kbd>A</kbd> / <kbd aria-label="Arrow Left">←</kbd></dt><dd>Rotate left</dd></div>
                  <div><dt><kbd>D</kbd> / <kbd aria-label="Arrow Right">→</kbd></dt><dd>Rotate right</dd></div>
                  <div><dt><kbd>Space</kbd></dt><dd>Front shot</dd></div>
                  <div><dt><kbd>Q</kbd></dt><dd>Left broadside</dd></div>
                  <div><dt><kbd>E</kbd></dt><dd>Right broadside</dd></div>
                </dl>
              </section>
              <section aria-labelledby="menu-touch-title">
                <h3 id="menu-touch-title">Touch</h3>
                <p>Drag the joystick in any direction to steer. Your ship gradually turns and sails forward.</p>
                <p>Hold <strong>Front shot</strong>, <strong>Left broadside</strong> or <strong>Right broadside</strong> to fire.</p>
                <p>Steer and fire with two thumbs. Release the joystick to stop.</p>
              </section>
            </div>
          </section>
        </div>
        <div className="menu-secondary-content">
          <PendingSubmissions />
          <NetworkScenarioControls />
        </div>
      </div>
    </main>
  );
}
