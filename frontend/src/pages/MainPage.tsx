import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { createCall } from "../services/calls";

const SparkIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 2.75 10.34 9.3a.5.5 0 0 1-.36.36L3.5 11l6.48 1.34a.5.5 0 0 1 .36.36L12 19.25l1.66-6.55a.5.5 0 0 1 .36-.36L20.5 11l-6.48-1.34a.5.5 0 0 1-.36-.36Z"
      className="calls-icon-fill"
    />
  </svg>
);

const VideoIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M4.5 6.25h8.75a1.5 1.5 0 0 1 1.5 1.5v2.02l3.21-1.86a.5.5 0 0 1 .76.43v6.42a.5.5 0 0 1-.76.43l-3.21-1.86v2.02a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 14.85V7.75a1.5 1.5 0 0 1 1.5-1.5Z"
      className="calls-icon-stroke"
      strokeWidth="1.5"
    />
  </svg>
);

const UserPlusIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M14 18.5c0-2.21-1.79-4-4-4H7c-2.21 0-4 1.79-4 4"
      className="calls-icon-stroke"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle cx="9" cy="8" r="3.25" className="calls-icon-stroke" strokeWidth="1.5" />
    <path
      d="M17.5 7.25v4.5M15.25 9.5h4.5"
      className="calls-icon-stroke"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const PhoneArrowIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M13.5 6.5 16 4m0 0-2.5-2.5M16 4h-5a2 2 0 0 0-2 2v3"
      className="calls-icon-stroke"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9.9 13.08c1.45 1.45 3.02 2.53 3.93 3.09.42.25.94.21 1.36-.03l1.34-.82a2 2 0 0 1 2.47.35l1.03 1.03a.92.92 0 0 1-.02 1.32c-.67.62-1.7 1.38-3.08 1.83-1.94.63-4.58.36-7.9-2.96-3.32-3.32-3.59-5.96-2.96-7.9.45-1.38 1.2-2.41 1.83-3.08a.92.92 0 0 1 1.32-.02l1.03 1.03a2 2 0 0 1 .35 2.47l-.82 1.34c-.25.42-.28.94-.03 1.36Z"
      className="calls-icon-stroke"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SettingsButton: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Link to="/settings" className="calls-settings" aria-label={t("common.settings")}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 9.75a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z"
          className="calls-icon-stroke"
          strokeWidth="1.5"
        />
        <path
          d="m20 9.5-.86-.22a1 1 0 0 1-.72-.97c0-.2-.03-.41-.08-.61l-.16-.64a1 1 0 0 0-1.1-.74l-.88.14a1 1 0 0 1-.99-.51l-.3-.52a1 1 0 0 0-1.3-.38l-.8.35a1 1 0 0 1-1.2-.27l-.4-.49a1 1 0 0 0-1.48 0l-.4.49a1 1 0 0 1-1.2.27l-.8-.35a1 1 0 0 0-1.3.38l-.3.52a1 1 0 0 1-.99.51l-.88-.14a1 1 0 0 0-1.1.74l-.16.64c-.05.2-.08.4-.08.61a1 1 0 0 1-.72.97L4 9.5a1 1 0 0 0-.75.97v1.06c0 .46.31.86.75.97l.86.22a1 1 0 0 1 .72.97c0 .2.03.41.08.61l.16.64a1 1 0 0 0 1.1.74l.88-.14a1 1 0 0 1 .99.51l.3.52a1 1 0 0 0 1.3.38l.8-.35a1 1 0 0 1 1.2.27l.4.49a1 1 0 0 0 1.48 0l.4-.49a1 1 0 0 1 1.2-.27l.8.35a1 1 0 0 0 1.3-.38l.3-.52a1 1 0 0 1 .99-.51l.88.14a1 1 0 0 0 1.1-.74l.16-.64c.05-.2.08-.4.08-.61a1 1 0 0 1 .72-.97l.86-.22A1 1 0 0 0 21 11.53V10.5a1 1 0 0 0-.75-.97Z"
          className="calls-icon-stroke"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
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
    <div className="calls-shell">
      <div className="calls-aurora calls-aurora--purple" />
      <div className="calls-aurora calls-aurora--blue" />

      <div className="calls-container">
        <header className="calls-topbar">
          <div className="calls-brand" aria-hidden>
            <span className="calls-brand-icon">
              <SparkIcon />
            </span>
            <div className="calls-brand-text">
              <span className="calls-brand-name">TelCall</span>
              <span className="calls-brand-muted">mini app</span>
            </div>
          </div>
          <SettingsButton />
        </header>

        <main className="calls-panel" aria-labelledby="calls-title">
          <div className="calls-header">
            <p className="calls-kicker">{t("mainPage.title")}</p>
            <h1 id="calls-title" className="calls-title">
              {t("mainPage.createCall")}
            </h1>
            <p className="calls-subtitle">Быстрые созвоны, стильный интерфейс и мгновенные подключения.</p>
          </div>

          {error ? (
            <p className="calls-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="calls-actions">
            <button
              className="calls-primary"
              onClick={handleCreateCall}
              disabled={!user || isCreating || isAuthorizing}
            >
              <span className="calls-primary-icon">
                <VideoIcon />
              </span>
              <div className="calls-primary-text">
                <span className="calls-primary-label">
                  {isAuthorizing
                    ? t("mainPage.authorizing")
                    : isCreating
                      ? t("mainPage.creating")
                      : t("mainPage.createCall")}
                </span>
                <span className="calls-primary-helper">Создайте ссылку и поделитесь ею за секунды</span>
              </div>
            </button>

            <div className="calls-grid">
              <Link className="calls-card" to="/friends">
                <span className="calls-card-icon">
                  <UserPlusIcon />
                </span>
                <div className="calls-card-text">
                  <span className="calls-card-title">{t("mainPage.callFriend")}</span>
                  <span className="calls-card-subtitle">Быстрый доступ к контактам</span>
                </div>
              </Link>

              <Link className="calls-card" to="/join-call">
                <span className="calls-card-icon">
                  <PhoneArrowIcon />
                </span>
                <div className="calls-card-text">
                  <span className="calls-card-title">{t("mainPage.joinCall")}</span>
                  <span className="calls-card-subtitle">Вставьте ссылку и подключайтесь</span>
                </div>
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainPage;
