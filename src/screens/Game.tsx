import type { CSSProperties } from "react";
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
  padding: "12px 24px",
  backgroundColor: "#1e293b",
  borderBottom: "1px solid #334155",
};

const statsStyle: CSSProperties = {
  display: "flex",
  gap: 24,
  fontSize: 14,
};

export function Game({ onNavigate }: GameProps) {
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
        <div style={statsStyle}>
          <span>
            Score: <strong style={{ color: "#fbbf24" }}>0</strong>
          </span>
          <span>
            Time: <strong style={{ color: "#fbbf24" }}>--</strong>
          </span>
          <span>
            HP: <strong style={{ color: "#4ade80" }}>--</strong>
          </span>
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
        <GameCanvas />
      </main>
    </div>
  );
}
