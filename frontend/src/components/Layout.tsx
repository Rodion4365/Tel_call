import React from "react";
import "../styles.css";

interface LayoutProps {
  children: React.ReactNode;
  isTelegramReady: boolean;
  authStatus?: {
    label: string;
    variant: "online" | "offline" | "pending";
  };
}

const Layout: React.FC<LayoutProps> = ({ children, isTelegramReady, authStatus }) => {
  return (
    <div className="app-shell">
      <div className="app-container">
        <div className="status-row">
          <span className={`status-pill ${isTelegramReady ? "status-online" : "status-offline"}`}>
            {isTelegramReady ? "Telegram WebApp connected" : "Telegram WebApp not detected"}
          </span>
          {authStatus ? (
            <span className={`status-pill status-${authStatus.variant}`}>{authStatus.label}</span>
          ) : null}
        </div>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
