import type { UiSoundAction } from '@/audio/audioAssets';
import type { ReactNode, CSSProperties } from "react";

export interface NavButtonProps {
  onClick: () => void;
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
  unstyled?: boolean;
  sound?: UiSoundAction;
}

const baseStyle: CSSProperties = {
  padding: "12px 24px",
  borderRadius: 8,
  fontWeight: 600,
  transition: "all 0.15s ease",
  minWidth: 180,
  fontSize: 16,
};

const primaryStyle: CSSProperties = {
  ...baseStyle,
  backgroundColor: "#2563eb",
  color: "#ffffff",
};

const secondaryStyle: CSSProperties = {
  ...baseStyle,
  backgroundColor: "#e5e7eb",
  color: "#1f2937",
};

export function NavButton({
  onClick,
  children,
  variant = "primary",
  className,
  unstyled = false,
  sound = 'click',
}: NavButtonProps) {
  const style = variant === "primary" ? primaryStyle : secondaryStyle;

  return (
    <button
      type="button"
      data-ui-sound={sound}
      className={className}
      onClick={onClick}
      style={unstyled ? undefined : style}
      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      {children}
    </button>
  );
}
