import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { createCall } from "../services/calls";

const CameraIcon: React.FC = () => (
  <svg className="action-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M4 6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1.382l3.105 1.553A1 1 0 0 0 20 15.277V8.723a1 1 0 0 0-1.895-.894L15 9.382V8a2 2 0 0 0-2-2Z" />
  </svg>
);

const SettingsButton: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Link to="/settings" className="settings-button" aria-label={t("common.settings")}>
      ⚙️
    </Link>
  );
};

const MainPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthorizing } = useAuth();
  const [isCreating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateCall = async () => {
    // eslint-disable-next-line no-console
    console.log("[MainPage] Creating call", { hasUser: !!user, isAuthorizing });

    if (!user) {
      // eslint-disable-next-line no-console
      console.error("[MainPage] User not authenticated");
      setError("Необходима авторизация. Пожалуйста, подождите...");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      // eslint-disable-next-line no-console
      console.log("[MainPage] Creating call...");

      const response = await createCall({ title: null, is_video_enabled: false });

      // eslint-disable-next-line no-console
      console.log("[MainPage] Call created successfully", response);

      const joinUrlParam = encodeURIComponent(response.join_url);

      navigate(`/call-created/${response.call_id}?join_url=${joinUrlParam}`, {
        state: { join_url: response.join_url },
        replace: true,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[MainPage] Failed to create call", err);

      const message =
        err instanceof Error && err.message
          ? `Не удалось создать звонок: ${err.message}`
          : "Не удалось создать звонок. Попробуйте еще раз.";

      setError(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="main-screen">
      <header className="top-bar">
        <div />
        <SettingsButton />
      </header>

      <header className="main-header">
        <h1 className="main-title">{t("mainPage.title")}</h1>
      </header>

      {error ? (
        <p className="status status-offline" role="alert" style={{ textAlign: "center", margin: "1rem" }}>
          {error}
        </p>
      ) : null}

      <div className="main-actions">
        <button
          className="action-button action-primary"
          onClick={handleCreateCall}
          disabled={!user || isCreating || isAuthorizing}
        >
          <CameraIcon />
          <span>
            {isAuthorizing
              ? "Авторизация..."
              : isCreating
                ? "Создаём..."
                : t("mainPage.createCall")}
          </span>
        </button>
        <Link className="action-button action-secondary" to="/friends">
          <span>Позвонить другу 👥</span>
        </Link>
        <Link className="action-button action-secondary" to="/join-call">
          <span>{t("mainPage.joinCall")}</span>
        </Link>
      </div>
    </div>
  );
};

export default MainPage;
