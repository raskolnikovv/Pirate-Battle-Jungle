import type { CSSProperties } from "react";
import { NavButton } from "@/components/NavButton";
import { ScreenLayout } from "@/components/ScreenLayout";
import { useRanking } from "@/hooks/useApi";
import type { RankingEntry } from "@/types/domain";
import type { ScreenName } from "@/app/navigationTypes";

interface RankingProps {
  onNavigate: (screen: ScreenName) => void;
}

const tableWrapStyle: CSSProperties = {
  overflow: "hidden",
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
  const { data, isLoading, error } = useRanking({ page: 1, pageSize: 20 });

  const rowStyle = (idx: number): CSSProperties => ({
    borderTop: "1px solid #334155",
    backgroundColor: idx % 2 === 0 ? "rgba(30, 41, 59, 0.4)" : "transparent",
  });

  return (
    <ScreenLayout title="Leaderboard">
      <div>
        {isLoading && <p style={centerColStyle}>Loading ranking...</p>}
        {error && (
          <p style={{ ...centerColStyle, color: "#f87171" }}>
            Failed to load ranking. Please try again.
          </p>
        )}
        {data && (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 64 }}>#</th>
                  <th style={thStyle}>Player</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>High Score</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Matches</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((entry: RankingEntry, idx: number) => (
                  <tr key={entry.rank} style={rowStyle(idx)}>
                    <td
                      style={{
                        padding: "12px 16px",
                        fontWeight: 700,
                        color: "#fbbf24",
                      }}
                    >
                      {entry.rank}
                    </td>
                    <td style={{ padding: "12px 16px" }}>{entry.playerName}</td>
                    <td
                      style={{
                        padding: "12px 16px",
                        textAlign: "right",
                        color: "#60a5fa",
                        fontWeight: 600,
                      }}
                    >
                      {entry.highScore.toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        textAlign: "right",
                        color: "#cbd5e1",
                      }}
                    >
                      {entry.matchesPlayed}
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={4} style={centerColStyle}>
                      No ranking entries yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div
          style={{ display: "flex", justifyContent: "center", paddingTop: 24 }}
        >
          <NavButton onClick={() => onNavigate("main-menu")}>Back</NavButton>
        </div>
      </div>
    </ScreenLayout>
  );
}
