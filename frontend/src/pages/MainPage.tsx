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

const UserPlusIcon: React.FC = () => (
  <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
    <path
      d="M5 20v-1a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v1"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M22 11h-6"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PhoneIcon: React.FC = () => (
  <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
    <path
      d="M17.25 2.75h2a2 2 0 0 1 2 2v3.5a2 2 0 0 1-2 2h-2.5a2 2 0 0 0-1.9 1.37l-.6 1.8a2 2 0 0 1-2.44 1.28A13.35 13.35 0 0 1 3.27 9.7a2 2 0 0 1 1.28-2.44l1.8-.6A2 2 0 0 0 7.72 4.8V2.25a2 2 0 0 1 2-2h3.5a2 2 0 0 1 2 2Z"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SettingsIcon: React.FC = () => (
  <svg className="settings-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
    <path
      d="M19.4 13.5a7.94 7.94 0 0 0 .06-.97 7.94 7.94 0 0 0-.06-.97l2.11-1.65a.5.5 0 0 0 .12-.63l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a7.98 7.98 0 0 0-1.68-.97l-.38-2.65a.5.5 0 0 0-.5-.42h-4a.5.5 0 0 0-.5.42l-.38 2.65a7.98 7.98 0 0 0-1.68.97l-2.49-1a.5.5 0 0 0-.6.22l-2 3.46a.5.5 0 0 0 .12.63L4.6 11.56a7.94 7.94 0 0 0-.06.97c0 .33.02.65.06.97l-2.11 1.65a.5.5 0 0 0-.12.63l2 3.46a.5.5 0 0 0 .6.22l2.49-1c.52.4 1.09.73 1.68.97l.38 2.65a.5.5 0 0 0 .5.42h4a.5.5 0 0 0 .5-.42l.38-2.65c.59-.24 1.16-.57 1.68-.97l2.49 1a.5.5 0 0 0 .6-.22l2-3.46a.5.5 0 0 0-.12-.63ZM12 15.25a3.25 3.25 0 1 1 0-6.5 3.25 3.25 0 0 1 0 6.5Z"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SettingsButton: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Link to="/settings" className="settings-button" aria-label={t("common.settings")}>
      <SettingsIcon />
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
      setError(t("mainPage.errorAuthRequired"));
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
          ? t("mainPage.errorCreateCallWithMessage", { message: err.message })
          : t("mainPage.errorCreateCall");

      setError(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="main-screen">
      <div className="main-screen__inner">
        <header className="top-bar">
          <div />
          <SettingsButton />
        </header>

        <header className="main-header">
          <h1 className="main-title">{t("mainPage.title")}</h1>
        </header>

        {error ? (
          <p className="status status-offline main-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="main-actions">
          <button
            className="action-button action-primary action-primary--elevated"
            onClick={handleCreateCall}
            disabled={!user || isCreating || isAuthorizing}
          >
            <CameraIcon />
            <span>
              {isAuthorizing
                ? t("mainPage.authorizing")
                : isCreating
                  ? t("mainPage.creating")
                  : t("mainPage.createCall")}
            </span>
          </button>
          <div className="main-secondary-grid">
            <Link className="action-button action-secondary main-secondary-card" to="/friends">
              <span className="main-card__icon" aria-hidden="true">
                <UserPlusIcon />
              </span>
              <span className="main-card__label">{t("mainPage.callFriend")}</span>
            </Link>
            <Link className="action-button action-secondary main-secondary-card" to="/join-call">
              <span className="main-card__icon" aria-hidden="true">
                <PhoneIcon />
              </span>
              <span className="main-card__label">{t("mainPage.joinCall")}</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainPage;
