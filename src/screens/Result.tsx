import type { CSSProperties } from "react";
import { NavButton } from "@/components/NavButton";
import { ScreenLayout } from "@/components/ScreenLayout";
import type { GameResultPayload, ScreenName } from "@/app/navigationTypes";

interface ResultProps {
  onNavigate: (screen: ScreenName) => void;
  result?: GameResultPayload;
}

const scoreCardStyle: CSSProperties = {
  backgroundColor: "rgba(51, 65, 85, 0.5)",
  borderRadius: 12,
  padding: 24,
  textAlign: "center",
  marginBottom: 24,
};

const statCardStyle: CSSProperties = {
  backgroundColor: "rgba(51, 65, 85, 0.5)",
  borderRadius: 12,
  padding: 20,
  textAlign: "center",
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 16,
  paddingTop: 16,
  flexWrap: "wrap",
};

export function Result({ onNavigate, result }: ResultProps) {
  const score = result?.score ?? 0;
  const enemiesDefeated = result?.enemiesDefeated ?? 0;
  const duration = result?.durationSeconds ?? 0;
  const endReason = result?.endReason ?? "quit";

  const reasonLabel: Record<GameResultPayload["endReason"], string> = {
    time_expired: "Time Expired",
    player_defeated: "Ship Destroyed",
    quit: "Match Abandoned",
  };

  return (
    <ScreenLayout title="Match Results">
      <div>
        <div style={scoreCardStyle}>
          <p style={{ fontSize: 18, color: "#cbd5e1", marginBottom: 8 }}>
            {reasonLabel[endReason]}
          </p>
          <p
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: "#fbbf24",
              marginBottom: 8,
            }}
          >
            {score}
          </p>
          <p style={{ color: "#94a3b8" }}>Final Score</p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div style={statCardStyle}>
            <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 4 }}>
              Enemies Defeated
            </p>
            <p style={{ fontSize: 32, fontWeight: 700, color: "#60a5fa" }}>
              {enemiesDefeated}
            </p>
          </div>
          <div style={statCardStyle}>
            <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 4 }}>
              Survival Time
            </p>
            <p style={{ fontSize: 32, fontWeight: 700, color: "#4ade80" }}>
              {duration}s
            </p>
          </div>
        </div>

        <div style={buttonRowStyle}>
          <NavButton onClick={() => onNavigate("game")}>Play Again</NavButton>
          <NavButton onClick={() => onNavigate("ranking")} variant="secondary">
            Leaderboard
          </NavButton>
          <NavButton
            onClick={() => onNavigate("main-menu")}
            variant="secondary"
          >
            Main Menu
          </NavButton>
        </div>
      </div>
    </ScreenLayout>
  );
}
