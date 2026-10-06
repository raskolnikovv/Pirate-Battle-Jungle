import { useRef, useState, type CSSProperties } from "react";
import { formatRemainingTime, type GameHudSnapshot } from "@/game/core/GameHudSnapshot";
import { GameCanvas, type GameCanvasControls } from "@/components/GameCanvas";
import { PauseDialog } from "@/components/PauseDialog";
import { NavButton } from "@/components/NavButton";
import type { GameResultPayload, ScreenName } from "@/app/navigationTypes";
import { HUD_ASSET_MANIFEST } from "@/game/assets/hudAssets";
import { DEFAULT_GAME_CONFIG } from "@/config/gameConfig";
import { loadGameOptions } from "@/config/gameOptions";

interface GameProps {
  onNavigate: (screen: ScreenName, payload?: GameResultPayload) => void;
}

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 12,
  padding: "12px 24px",
  backgroundColor: "#1e293b",
  borderBottom: "1px solid #334155",
};

export function Game({ onNavigate }: GameProps) {
  // A fresh screen mount means a new match; never reread storage during gameplay.
  const [matchConfig] = useState(() => ({ ...DEFAULT_GAME_CONFIG, ...loadGameOptions() }));
  const [hud, setHud] = useState<GameHudSnapshot | null>(null);
  const gameControlsRef = useRef<GameCanvasControls>(null);
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
    onNavigate("result", {
      score: 0,
      enemiesDefeated: 0,
      durationSeconds: 0,
      endReason: "quit",
    });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0f172a",
        color: "#f8fafc",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header style={headerStyle}>
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
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <button className="pause-action" disabled={hud?.status !== "running"}
            onClick={() => gameControlsRef.current?.pause()}>Pause</button>
          <NavButton onClick={handleQuit} variant="secondary">
            Quit Match
          </NavButton>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <GameCanvas config={matchConfig} ref={gameControlsRef} onHudChange={setHud} />
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
      <PauseDialog paused={hud?.status === "paused"} onResume={() => gameControlsRef.current?.resume()} />
    </div>
  );
}
