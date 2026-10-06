import { NavButton } from "@/components/NavButton";
import { ScreenLayout } from "@/components/ScreenLayout";
import type { ScreenName } from "@/app/navigationTypes";
import { PendingSubmissions } from '@/components/PendingSubmissions';

interface MainMenuProps {
  onNavigate: (screen: ScreenName) => void;
}

export function MainMenu({ onNavigate }: MainMenuProps) {
  return (
    <ScreenLayout title="Pirate Battle">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <p
          style={{
            color: "#cbd5e1",
            marginBottom: 16,
            textAlign: "center",
            maxWidth: 420,
            lineHeight: 1.5,
          }}
        >
          A top-down naval shooter. Defeat enemies, survive the session, and
          climb the ranking!
        </p>
        <NavButton onClick={() => onNavigate("game")}>Start Game</NavButton>
        <NavButton onClick={() => onNavigate("ranking")} variant="secondary">
          Leaderboard
        </NavButton>
        <NavButton
          onClick={() => onNavigate("match-history")}
          variant="secondary"
        >
          Match History
        </NavButton>
        <NavButton onClick={() => onNavigate("options")} variant="secondary">
          Options
        </NavButton>
        <PendingSubmissions />
      </div>
    </ScreenLayout>
  );
}
