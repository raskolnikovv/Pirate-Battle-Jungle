import { useState, type CSSProperties } from "react";
import { NavButton } from "@/components/NavButton";
import { PirateScreen } from "@/components/PirateScreen";
import { useRanking } from "@/hooks/useApi";
import { DEFAULT_GAME_CONFIG } from '@/config/gameConfig';
import { loadGameOptions } from '@/config/gameOptions';
import { getGameConfigKey } from '@/config/gameConfigKey';
import { PaginationControls } from '@/components/PaginationControls';
import { LOCAL_PLAYER } from '@/config/localPlayer';
import type { ScreenName } from "@/app/navigationTypes";

interface RankingProps {
  onNavigate: (screen: ScreenName) => void;
}

const tableWrapStyle: CSSProperties = {
  overflowX: "auto",
  borderRadius: 12,
  border: "1px solid #334155",
};

const tableStyle: CSSProperties = {
  width: "100%",
  textAlign: "left",
  borderCollapse: "collapse",
};

const thStyle: CSSProperties = {
  padding: "12px 16px",
  backgroundColor: "rgba(51, 65, 85, 0.7)",
  fontWeight: 600,
};

const centerColStyle: CSSProperties = {
  textAlign: "center",
  padding: "32px 16px",
  color: "#94a3b8",
};

export function Ranking({ onNavigate }: RankingProps) {
  const [config] = useState(() => ({ ...DEFAULT_GAME_CONFIG, ...loadGameOptions() }));
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching, error } = useRanking({ page, pageSize: 5, configKey: getGameConfigKey(config) });

  return (
    <PirateScreen title="Ranking">
      <div>
        <p style={{ marginBottom: 16 }}>Matches using your saved settings: {config.sessionDuration}s session · {config.enemySpawnInterval}s spawn interval. All gameplay parameters must match.</p>
        <p className="log-caption">“You” marks your records. Other captains are demo players.</p>
        {isLoading && <p role="status" style={centerColStyle}>Loading ranking...</p>}
        {!isLoading && isFetching && <p role="status">Updating ranking...</p>}
        {error && (
          <p role="alert" style={{ ...centerColStyle, color: "#f87171" }}>
            Failed to load ranking. Reopen this screen to try again.
          </p>
        )}
        {data && (
          <div className="captains-log" style={tableWrapStyle}>
            <table className="log-table" style={tableStyle}>
              <thead>
                <tr>
                  <th scope="col" style={{ ...thStyle, width: 64 }}>#</th>
                  <th scope="col" style={thStyle}>Player</th>
                  <th scope="col" style={{ ...thStyle, textAlign: "right" }}>Score</th>
                  <th scope="col" style={{ ...thStyle, textAlign: "right" }}>Duration</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((entry) => (
                  <tr key={entry.matchId}>
                    <td data-label="Position"
                      style={{
                        padding: "12px 16px",
                        fontWeight: 700,
                        color: "#fbbf24",
                      }}
                    >
                      {entry.rank}
                    </td>
                    <td data-label="Player" style={{ padding: "12px 16px" }}>{entry.playerName}
                      {entry.playerId === LOCAL_PLAYER.id && <small style={{ display: 'block', color: '#cbd5e1' }}>You</small>}
                    </td>
                    <td data-label="Score"
                      style={{
                        padding: "12px 16px",
                        textAlign: "right",
                        color: "#60a5fa",
                        fontWeight: 600,
                      }}
                    >
                      {entry.score.toLocaleString()}
                    </td>
                    <td data-label="Duration"
                      style={{
                        padding: "12px 16px",
                        textAlign: "right",
                        color: "#cbd5e1",
                      }}
                    >
                      {entry.durationSeconds.toFixed(2)}s
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr>
                    <td data-label="" colSpan={4} style={centerColStyle}>
                      No completed matches for these settings yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {data && <PaginationControls page={data.page} pageSize={data.pageSize} total={data.total} totalPages={data.totalPages} busy={isFetching} onPageChange={setPage} />}

        <div
          style={{ display: "flex", justifyContent: "center", paddingTop: 24 }}
        >
          <NavButton unstyled className="menu-button menu-button-primary" onClick={() => onNavigate("main-menu")}>Back</NavButton>
        </div>
      </div>
    </PirateScreen>
  );
}
