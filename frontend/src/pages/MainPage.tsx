import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Video, UserPlus, Phone, Settings } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { createCall } from "../services/calls";

const SettingsButton: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Link to="/settings" className="settings-button" aria-label={t("common.settings")}>
      <Settings className="settings-icon" />
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
          className="primary-action"
          onClick={handleCreateCall}
          disabled={!user || isCreating || isAuthorizing}
        >
          <Video className="action-icon" />
          <div className="action-text">
            <span className="action-label">
              {isAuthorizing
                ? t("mainPage.authorizing")
                : isCreating
                  ? t("mainPage.creating")
                  : t("mainPage.createCall")}
            </span>
          </div>
        </button>

        <div className="secondary-actions">
          <Link className="action-tile" to="/friends">
            <span className="action-icon-badge">
              <UserPlus className="action-icon" />
            </span>
            <span className="action-tile-label">{t("mainPage.callFriend")}</span>
          </Link>
          <Link className="action-tile" to="/join-call">
            <span className="action-icon-badge">
              <Phone className="action-icon" />
            </span>
            <span className="action-tile-label">{t("mainPage.joinCall")}</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MainPage;
