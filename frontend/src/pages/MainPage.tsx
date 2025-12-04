import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

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

  return (
    <div className="main-screen">
      <header className="top-bar">
        <div />
        <SettingsButton />
      </header>

      <header className="main-header">
        <h1 className="main-title">{t("mainPage.title")}</h1>
      </header>

      <div className="main-actions">
        <Link className="action-button action-primary" to="/create-call">
          <CameraIcon />
          <span>{t("mainPage.createCall")}</span>
        </Link>
        <Link className="action-button action-secondary" to="/join-call">
          <span>{t("mainPage.joinCall")}</span>
        </Link>
      </div>
    </div>
  );
};

export default MainPage;
