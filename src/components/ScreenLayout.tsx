import type { ReactNode, CSSProperties } from "react";

export interface ScreenLayoutProps {
  title: string;
  children: ReactNode;
}

const containerStyle: CSSProperties = {
  minHeight: "100vh",
  width: "100%",
  background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
  color: "#f8fafc",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
};

const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: 768,
  backgroundColor: "rgba(30, 41, 59, 0.7)",
  backdropFilter: "blur(8px)",
  borderRadius: 16,
  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
  border: "1px solid #334155",
  padding: 32,
};

const titleStyle: CSSProperties = {
  fontSize: 36,
  fontWeight: 700,
  marginBottom: 32,
  textAlign: "center",
  color: "#fbbf24",
};

export function ScreenLayout({ title, children }: ScreenLayoutProps) {
  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>{title}</h1>
        {children}
      </div>
    </div>
  );
}
