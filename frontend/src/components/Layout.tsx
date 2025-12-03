import React from "react";
import { type AuthStatus } from "../contexts/AuthContext";
import "../styles.css";

interface LayoutProps {
  children: React.ReactNode;
  isTelegramReady: boolean;
  authStatus: AuthStatus;
  authError?: string | null;
}

const getAuthLabel = (status: AuthStatus): string => {
  switch (status) {
    case "authorized":
      return "Готово";
    case "authorizing":
      return "Авторизация...";
    case "error":
      return "Ошибка авторизации";
    default:
      return "Ожидание авторизации";
  }
};

const getAuthClassName = (status: AuthStatus): string => {
  if (status === "authorized") {
    return "status-pill status-online";
  }

  if (status === "error") {
    return "status-pill status-offline";
  }

  return "status-pill";
};

const Layout: React.FC<LayoutProps> = ({
  children,
  isTelegramReady,
  authStatus,
  authError,
}) => {
  return (
    <div className="app-shell">
      <div className="app-container">
        <div className="status-row" aria-live="polite" aria-atomic>
          <span className={`status-pill ${isTelegramReady ? "status-online" : "status-offline"}`}>
            {isTelegramReady ? "Telegram WebApp connected" : "Telegram WebApp not detected"}
          </span>
          <span className={getAuthClassName(authStatus)}>{getAuthLabel(authStatus)}</span>
        </div>
        {authError ? (
          <p className="status status-offline" role="alert">
            {authError}
          </p>
        ) : null}
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
