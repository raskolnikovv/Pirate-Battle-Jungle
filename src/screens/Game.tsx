import { useCallback, useRef, useState } from "react";
import { formatRemainingTime, type GameHudSnapshot } from "@/game/core/GameHudSnapshot";
import { GameCanvas, type GameCanvasControls } from "@/components/GameCanvas";
import { PauseDialog } from "@/components/PauseDialog";
import type { GameResultPayload, ScreenName } from "@/app/navigationTypes";
import { HUD_ASSET_MANIFEST } from "@/game/assets/hudAssets";
import { DEFAULT_GAME_CONFIG } from "@/config/gameConfig";
import { loadGameOptions } from "@/config/gameOptions";
import { TouchControls } from '@/components/TouchControls';
import type { InputSnapshot } from '@/game/input/InputManager';
import { pirateThemeStyle } from '@/components/pirateTheme';
import '@/components/PirateUI.css';

interface GameProps {
  onNavigate: (screen: ScreenName, payload?: GameResultPayload) => void;
}

export function Game({ onNavigate }: GameProps) {
  // A fresh screen mount means a new match; never reread storage during gameplay.
  const [matchConfig] = useState(() => ({ ...DEFAULT_GAME_CONFIG, ...loadGameOptions() }));
  const [hud, setHud] = useState<GameHudSnapshot | null>(null);
  const gameControlsRef = useRef<GameCanvasControls>(null);
  const handlePointerInput = useCallback((id: number, intentions: Partial<InputSnapshot>) => {
    gameControlsRef.current?.setPointerInput(id, intentions);
  }, []);
  const handlePointerRelease = useCallback((id: number) => gameControlsRef.current?.releasePointer(id), []);
  const matchLabel = !hud ? "Loading" : hud.status === "running" ? "Playing"
    : hud.status === "paused" ? "Paused"
    : hud.finishReason === "defeated" ? "Ship Destroyed" : "Time Expired";
  const stats = [
    { label: "Health (HP)", icon: HUD_ASSET_MANIFEST.healthIcon,
      value: hud ? `${hud.health} / ${hud.maxHealth}` : "-- / --" },
    { label: "Score", icon: HUD_ASSET_MANIFEST.scoreIcon, value: hud?.score ?? "--" },
    { label: "Remaining time", icon: HUD_ASSET_MANIFEST.timeIcon,
      value: hud ? formatRemainingTime(hud.remainingSeconds) : "--:--" },
  ];
  const handleQuit = () => {
    onNavigate("main-menu");
  };

  return (
    <div className="game-screen">
      <header className="game-header pirate-ui" style={pirateThemeStyle}>
        <section aria-label="Match information">
          <dl className="match-hud">
            {stats.map(({ label, icon, value }) => (
              <div className="match-hud-stat" key={label}>
                <dt>{label}</dt>
                <dd className="match-hud-counter">
                  <img className="match-hud-panel" src={HUD_ASSET_MANIFEST.counterPanel} alt=""
                    onError={(event) => { event.currentTarget.hidden = true; }} />
                  <img className="match-hud-icon" src={icon} alt="" width={28} height={28}
                    onError={(event) => { event.currentTarget.hidden = true; }} />
                  <strong>{value}</strong>
                </dd>
              </div>
            ))}
            <div className="match-hud-state">
              <dt>Match state</dt>
              <dd role="status" aria-atomic="true">{matchLabel}</dd>
            </div>
          </dl>
        </section>
        <div className="game-header-actions">
          <button type="button" className="menu-button menu-button-primary" disabled={hud?.status !== "running"}
            data-ui-sound="none" onClick={() => gameControlsRef.current?.pause()}><img src={HUD_ASSET_MANIFEST.pauseIcon} width={18} height={18} alt="" />Pause</button>
          <button type="button" className="menu-button menu-button-secondary" data-ui-sound="back" onClick={handleQuit}>Quit Match</button>
        </div>
      </header>

      <main className="game-arena-space">
        <div className="game-playfield">
          <div className="game-canvas-space">
            <GameCanvas config={matchConfig} ref={gameControlsRef} onHudChange={setHud}
              onMatchComplete={(result) => onNavigate("result", result)} />
          </div>
          {hud?.status === 'running' && <TouchControls onInput={handlePointerInput} onRelease={handlePointerRelease} />}
        </div>
      </main>
      <section className="match-controls" aria-labelledby="keyboard-controls-title">
        <h2 id="keyboard-controls-title">Keyboard controls</h2>
        <ul>
          <li><kbd>W</kbd> / <kbd aria-label="Arrow Up">↑</kbd> Move forward</li>
          <li><kbd>A</kbd> / <kbd aria-label="Arrow Left">←</kbd> Rotate left</li>
          <li><kbd>D</kbd> / <kbd aria-label="Arrow Right">→</kbd> Rotate right</li>
          <li><kbd>Space</kbd> Front shot</li>
          <li><kbd>Q</kbd> Left broadside</li>
          <li><kbd>E</kbd> Right broadside</li>
        </ul>
      </section>
      <PauseDialog paused={hud?.status === "paused"} onResume={() => gameControlsRef.current?.resume()} onQuit={handleQuit} />
    </div>
  );
}
