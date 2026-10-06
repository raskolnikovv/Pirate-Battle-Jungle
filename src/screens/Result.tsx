import type { CSSProperties } from "react";
import { NavButton } from "@/components/NavButton";
import { ScreenLayout } from "@/components/ScreenLayout";
import type { GameResultPayload, ScreenName } from "@/app/navigationTypes";
import { useMatchRegistration } from "@/hooks/useApi";
import { PendingSubmissions } from '@/components/PendingSubmissions';
import { NetworkScenarioControls } from '@/components/NetworkScenarioControls';

interface ResultProps {
  onNavigate: (screen: ScreenName) => void;
  result?: GameResultPayload;
  storageError?: boolean;
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

export function Result({ onNavigate, result, storageError = false }: ResultProps) {
  const { data: registration } = useMatchRegistration(result?.matchId);
  const registrationLabels = {
    not_submitted: 'Not submitted in this session', pending: 'Pending registration', submitting: 'Submitting...',
    submitted: 'Submitted', failed: 'Submission failed',
  };
  if (!result) {
    return <ScreenLayout title="Match Results">
      <p role="status">No completed match is available.</p>
      <PendingSubmissions />
      <NetworkScenarioControls />
      <div style={buttonRowStyle}><NavButton onClick={() => onNavigate("main-menu")}>Main Menu</NavButton></div>
    </ScreenLayout>;
  }
  const score = result.score;
  const enemiesDefeated = result.enemiesDefeated;
  const duration = result.elapsedSeconds;
  const endReason = result.endReason;

  const reasonLabel: Record<GameResultPayload["endReason"], string> = {
    time_expired: "Time Expired",
    player_defeated: "Ship Destroyed",
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
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
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
              Active Time Played
            </p>
            <p style={{ fontSize: 32, fontWeight: 700, color: "#4ade80" }}>
              {Number(duration.toFixed(2))}s
            </p>
          </div>
        </div>

        <section aria-label="Match details" style={{ lineHeight: 1.8 }}>
          <p role="status" aria-atomic="true">Registration: <strong>{registrationLabels[registration?.status ?? 'not_submitted']}</strong></p>
          {registration?.status === 'submitted' && <p>The API confirmed this match in your history.</p>}
          {registration?.status === 'failed' && <p role="alert">{registration.message} You can still play another match.</p>}
          <p>Session time: {result.config.sessionDuration}s · Enemy spawn time: {result.config.enemySpawnInterval}s</p>
          <p>Completed: <time dateTime={result.completedAt}>{new Date(result.completedAt).toLocaleString('en-US')}</time></p>
          {storageError && <p role="alert">Unable to save this result locally. It remains available until you reload.</p>}
        </section>
        <PendingSubmissions />
        <NetworkScenarioControls />
        <div style={buttonRowStyle}>
          <NavButton onClick={() => onNavigate("game")}>Play Again</NavButton>
          <NavButton onClick={() => onNavigate("ranking")} variant="secondary">
            Ranking
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
