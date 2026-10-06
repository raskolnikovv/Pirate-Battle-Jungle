import type { CSSProperties } from "react";
import { NavButton } from "@/components/NavButton";
import { ScreenLayout } from "@/components/ScreenLayout";
import type { ScreenName } from "@/app/navigationTypes";

interface OptionsProps {
  onNavigate: (screen: ScreenName) => void;
}

const sectionStyle: CSSProperties = {
  backgroundColor: "rgba(51, 65, 85, 0.5)",
  borderRadius: 12,
  padding: 20,
  marginBottom: 24,
};

const h2Style: CSSProperties = {
  fontSize: 20,
  fontWeight: 600,
  marginBottom: 12,
  color: "#fcd34d",
};

const rowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 0",
};

const selectStyle: CSSProperties = {
  backgroundColor: "#475569",
  color: "#f8fafc",
  border: "none",
  borderRadius: 6,
  padding: "6px 12px",
};

export function Options({ onNavigate }: OptionsProps) {
  return (
    <ScreenLayout title="Options">
      <div>
        <div style={sectionStyle}>
          <h2 style={h2Style}>Audio</h2>
          <div>
            <label style={rowStyle}>
              <span>Master Volume</span>
              <input
                type="range"
                min={0}
                max={100}
                defaultValue={70}
                style={{ width: 192 }}
              />
            </label>
            <label style={rowStyle}>
              <span>Music</span>
              <input
                type="range"
                min={0}
                max={100}
                defaultValue={50}
                style={{ width: 192 }}
              />
            </label>
            <label style={rowStyle}>
              <span>SFX</span>
              <input
                type="range"
                min={0}
                max={100}
                defaultValue={80}
                style={{ width: 192 }}
              />
            </label>
          </div>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Gameplay</h2>
          <div>
            <label style={rowStyle}>
              <span>Difficulty</span>
              <select defaultValue="normal" style={selectStyle}>
                <option value="easy">Easy</option>
                <option value="normal">Normal</option>
                <option value="hard">Hard</option>
              </select>
            </label>
            <label style={rowStyle}>
              <span>Fullscreen</span>
              <input type="checkbox" defaultChecked />
            </label>
          </div>
        </div>

        <div
          style={{ display: "flex", justifyContent: "center", paddingTop: 16 }}
        >
          <NavButton onClick={() => onNavigate("main-menu")}>Back</NavButton>
        </div>
      </div>
    </ScreenLayout>
  );
}
