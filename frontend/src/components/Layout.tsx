import React from "react";
import "../styles.css";

interface LayoutProps {
  children: React.ReactNode;
  isTelegramReady: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, isTelegramReady }) => {
  return (
    <div className="app-shell">
      <div className="app-container">
        <div className="status-row">
          <span className={`status-pill ${isTelegramReady ? "status-online" : "status-offline"}`}>
            {isTelegramReady ? "Telegram WebApp connected" : "Telegram WebApp not detected"}
          </span>
        </div>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
