import type { CSSProperties } from "react";
import { NavButton } from "@/components/NavButton";
import { ScreenLayout } from "@/components/ScreenLayout";
import { useHistory } from "@/hooks/useApi";
import type { MatchHistoryEntry, MatchEndReason } from "@/types/domain";
import type { ScreenName } from "@/app/navigationTypes";

interface MatchHistoryProps {
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

const reasonLabel: Record<MatchEndReason, string> = {
  time_expired: "Time Expired",
  player_defeated: "Defeated",
  quit: "Quit",
};

const reasonColor: Record<MatchEndReason, string> = {
  time_expired: "#4ade80",
  player_defeated: "#f87171",
  quit: "#94a3b8",
};

export function MatchHistory({ onNavigate }: MatchHistoryProps) {
  const { data, isLoading, error } = useHistory({ page: 1, pageSize: 20 });

  const rowStyle = (idx: number): CSSProperties => ({
    borderTop: "1px solid #334155",
    backgroundColor: idx % 2 === 0 ? "rgba(30, 41, 59, 0.4)" : "transparent",
  });

  return (
    <ScreenLayout title="Match History">
      <div>
        {isLoading && <p style={centerColStyle}>Loading history...</p>}
        {error && (
          <p style={{ ...centerColStyle, color: "#f87171" }}>
            Failed to load history. Please try again.
          </p>
        )}
        {data && (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Date</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Score</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Kills</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Duration</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Result</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((entry: MatchHistoryEntry, idx: number) => (
                  <tr key={entry.matchId} style={rowStyle(idx)}>
                    <td style={{ padding: "12px 16px", color: "#cbd5e1" }}>
                      {new Date(entry.completedAt).toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        textAlign: "right",
                        color: "#60a5fa",
                        fontWeight: 600,
                      }}
                    >
                      {entry.score.toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        textAlign: "right",
                        color: "#cbd5e1",
                      }}
                    >
                      {entry.enemiesDefeated}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        textAlign: "right",
                        color: "#cbd5e1",
                      }}
                    >
                      {entry.durationSeconds}s
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        textAlign: "right",
                        color:
                          reasonColor[
                            entry.endReason as MatchEndReason
                          ],
                      }}
                    >
                      {
                        reasonLabel[
                          entry.endReason as MatchEndReason
                        ]
                      }
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={5} style={centerColStyle}>
                      No matches played yet.
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
