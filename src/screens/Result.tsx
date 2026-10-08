import { NavButton } from "@/components/NavButton";
import { PirateScreen } from "@/components/PirateScreen";
import type { GameResultPayload, ScreenName } from "@/app/navigationTypes";
import { useMatchRegistration } from "@/hooks/useApi";
import { PendingSubmissions } from '@/components/PendingSubmissions';
import { NetworkScenarioControls } from '@/components/NetworkScenarioControls';

interface ResultProps {
  onNavigate: (screen: ScreenName) => void;
  result?: GameResultPayload;
  storageError?: boolean;
}

export function Result({ onNavigate, result, storageError = false }: ResultProps) {
  const { data: registration } = useMatchRegistration(result?.matchId);
  const registrationLabels = {
    not_submitted: 'Not submitted in this session', pending: 'Pending registration', submitting: 'Submitting...',
    submitted: 'Submitted', failed: 'Submission failed',
  };
  if (!result) {
    return <PirateScreen title="Match Results">
      <p role="status">No completed match is available.</p>
      <div className="menu-secondary-content"><PendingSubmissions /><NetworkScenarioControls /></div>
      <div className="pirate-actions"><NavButton unstyled className="menu-button menu-button-primary" onClick={() => onNavigate("main-menu")}>Main Menu</NavButton></div>
    </PirateScreen>;
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
    <PirateScreen title="Match Results">
      <div>
        <div className="result-score-card">
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
          <p style={{ color: "#d9e3e6" }}>Final Score</p>
        </div>

        <div className="result-stats">
          <div className="result-stat-card">
            <p style={{ color: "#d9e3e6", fontSize: 14, marginBottom: 4 }}>
              Enemies Defeated
            </p>
            <p style={{ fontSize: 32, fontWeight: 700, color: "#60a5fa" }}>
              {enemiesDefeated}
            </p>
          </div>
          <div className="result-stat-card">
            <p style={{ color: "#d9e3e6", fontSize: 14, marginBottom: 4 }}>
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
        <div className="menu-secondary-content"><PendingSubmissions /><NetworkScenarioControls /></div>
        <div className="pirate-actions">
          <NavButton unstyled className="menu-button menu-button-primary" onClick={() => onNavigate("game")}>Play Again</NavButton>
          <NavButton unstyled className="menu-button menu-button-secondary" onClick={() => onNavigate("ranking")} variant="secondary">
            Ranking
          </NavButton>
          <NavButton unstyled className="menu-button menu-button-secondary" onClick={() => onNavigate("main-menu")} variant="secondary"
          >
            Main Menu
          </NavButton>
        </div>
      </div>
    </PirateScreen>
  );
}
