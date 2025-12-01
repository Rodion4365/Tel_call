import React from "react";
import { NavLink } from "react-router-dom";
import "../styles.css";

interface LayoutProps {
  children: React.ReactNode;
  isTelegramReady: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, isTelegramReady }) => {
  const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
    isActive ? "active" : undefined;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="app-title">Tel Call</p>
          <p className="app-subtitle">Telegram Mini App prototype</p>
        </div>
        <div className={`status ${isTelegramReady ? "status-online" : "status-offline"}`}>
          {isTelegramReady ? "Telegram WebApp connected" : "Telegram WebApp not detected"}
        </div>
      </header>

      <nav className="app-nav">
        <NavLink to="/" end className={navLinkClassName}>
          Main
        </NavLink>
        <NavLink to="/create-call" className={navLinkClassName}>
          Create call
        </NavLink>
        <NavLink to="/join-call" className={navLinkClassName}>
          Join call
        </NavLink>
        <NavLink to="/call/preview" className={navLinkClassName}>
          Call
        </NavLink>
        <NavLink to="/settings" className={navLinkClassName}>
          Settings
        </NavLink>
      </nav>

      <section className="app-content">{children}</section>
    </div>
  );
};

export default Layout;
