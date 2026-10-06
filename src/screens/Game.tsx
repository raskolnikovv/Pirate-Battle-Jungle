import { useState, type CSSProperties } from "react";
import { formatRemainingTime, type GameHudSnapshot } from "@/game/core/GameHudSnapshot";
import { GameCanvas } from "@/components/GameCanvas";
import { NavButton } from "@/components/NavButton";
import type { GameResultPayload, ScreenName } from "@/app/navigationTypes";

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

const statsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px 24px",
  fontSize: 14,
};

export function Game({ onNavigate }: GameProps) {
  const [hud, setHud] = useState<GameHudSnapshot | null>(null);
  const matchLabel = !hud ? "Loading" : hud.status === "running" ? "Playing"
    : hud.finishReason === "defeated" ? "Ship Destroyed" : "Time Expired";
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
        <div style={statsStyle} role="group" aria-label="Match information">
          <span>
            Score: <strong style={{ color: "#fbbf24" }}>{hud?.score ?? "--"}</strong>
          </span>
          <span>
            Time: <strong style={{ color: "#fbbf24", fontVariantNumeric: "tabular-nums" }}>{hud ? formatRemainingTime(hud.remainingSeconds) : "--:--"}</strong>
          </span>
          <span>
            HP: <strong style={{ color: "#4ade80" }}>{hud ? `${hud.health} / ${hud.maxHealth}` : "-- / --"}</strong>
          </span>
          <span role="status">{matchLabel}</span>
        </div>
        <NavButton onClick={handleQuit} variant="secondary">
          Quit Match
        </NavButton>
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
        <GameCanvas onHudChange={setHud} />
      </main>
      <p style={{ padding: "8px 16px 16px", textAlign: "center", fontSize: 14 }}>
        W / ↑: Forward · A / ←: Left · D / →: Right · Space: Front shot · Q / E: Left / right broadside
      </p>
    </div>
  );
}
