import React from "react";
import { useWebAppConnection } from "../contexts/WebAppConnectionContext";

export const ConnectionBanner: React.FC = () => {
  const { status, retry } = useWebAppConnection();

  if (status !== "error") return null;

  return (
    <button className="connection-banner" onClick={retry}>
      <span className="connection-banner__icon" role="img" aria-label="retry">
        🔄
      </span>
      <span className="connection-banner__text">
        Ошибка подключения к Telegram. Нажмите, чтобы обновить.
      </span>
    </button>
  );
};
