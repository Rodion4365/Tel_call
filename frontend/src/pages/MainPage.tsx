import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { createCall } from "../services/calls";

const SettingsIcon: React.FC = () => (
  <svg className="settings-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
    <path
      d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M19.4 14a1 1 0 0 0 .19 1.09l.06.06a1.8 1.8 0 0 1-2.55 2.55l-.06-.06A1 1 0 0 0 16 17.4a6.1 6.1 0 0 1-1.1.64 1 1 0 0 0-.6.92V20a1.8 1.8 0 0 1-3.6 0v-.04a1 1 0 0 0-.6-.92A6.1 6.1 0 0 1 9 17.4a1 1 0 0 0-1.04.24l-.06.06a1.8 1.8 0 1 1-2.55-2.55l.06-.06A1 1 0 0 0 5 14a6.1 6.1 0 0 1-.64-1.1 1 1 0 0 0-.92-.6H3a1.8 1.8 0 0 1 0-3.6h.04a1 1 0 0 0 .92-.6A6.1 6.1 0 0 1 5 9a1 1 0 0 0-.24-1.04l-.06-.06A1.8 1.8 0 0 1 7.25 5.3l.06.06A1 1 0 0 0 8.4 5a6.1 6.1 0 0 1 1.1-.64 1 1 0 0 0 .6-.92V3a1.8 1.8 0 0 1 3.6 0v.04a1 1 0 0 0 .6.92A6.1 6.1 0 0 1 16 5a1 1 0 0 0 1.04-.24l.06-.06a1.8 1.8 0 1 1 2.55 2.55l-.06.06A1 1 0 0 0 19.4 9c.25.35.47.72.64 1.1a1 1 0 0 0 .92.6H21a1.8 1.8 0 0 1 0 3.6h-.04a1 1 0 0 0-.92.6 6.1 6.1 0 0 1-.64 1.1Z"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const VideoIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
    <rect x="3.5" y="5" width="12" height="14" rx="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M15.5 10.5 20 7.8v8.4l-4.5-2.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const UserPlusIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
    <circle cx="9" cy="8" r="3.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4.5 18.5C5.3 15.9 7.7 14 10 14c2.3 0 4.7 1.9 5.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M18 8v5M15.5 10.5H20.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PhoneIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
    <path
      d="M6.5 4.5 8.8 4a1.6 1.6 0 0 1 1.8 1l1 2.6a1.6 1.6 0 0 1-.5 1.8l-1.1.9a9.8 9.8 0 0 0 4.6 4.6l.9-1.1a1.6 1.6 0 0 1 1.8-.5l2.6 1a1.6 1.6 0 0 1 1 1.8l-.5 2.3a2 2 0 0 1-1.9 1.5A14.5 14.5 0 0 1 4.9 6.4a2 2 0 0 1 1.6-1.9Z"
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
    <div className="main-screen calls-layout">
      <header className="top-bar">
        <SettingsButton />
      </header>

      <div className="content-wrapper">
        <div className="title-block">
          <h1 className="main-title">{t("mainPage.title")}</h1>
        </div>

        {error ? (
          <p className="status status-offline" role="alert" style={{ textAlign: "center" }}>
            {error}
          </p>
        ) : null}

        <button
          className="primary-button"
          onClick={handleCreateCall}
          disabled={!user || isCreating || isAuthorizing}
          type="button"
        >
          <span className="primary-icon">
            <VideoIcon />
          </span>
          <span>
            {isAuthorizing
              ? t("mainPage.authorizing")
              : isCreating
                ? t("mainPage.creating")
                : t("mainPage.createCall")}
          </span>
        </button>

        <div className="actions-grid">
          <Link className="secondary-card" to="/friends">
            <span className="secondary-icon-wrapper">
              <UserPlusIcon />
            </span>
            <span>{t("mainPage.callFriend")}</span>
          </Link>

          <Link className="secondary-card" to="/join-call">
            <span className="secondary-icon-wrapper">
              <PhoneIcon />
            </span>
            <span>{t("mainPage.joinCall")}</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MainPage;
