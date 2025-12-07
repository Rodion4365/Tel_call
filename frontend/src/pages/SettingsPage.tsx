import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useNavigation } from "../contexts/NavigationContext";
import { getTelegramUser } from "../services/telegram";

const MICROPHONE_STORAGE_KEY = "tel-call:microphone-enabled";

const SettingsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { registerCurrentPath } = useNavigation();
  const telegramUser = useMemo(() => getTelegramUser(), []);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(true);

  // Register this path in navigation stack
  useEffect(() => {
    registerCurrentPath();
  }, [registerCurrentPath]);

  useEffect(() => {
    const storedValue = localStorage.getItem(MICROPHONE_STORAGE_KEY);

    if (storedValue !== null) {
      setIsMicrophoneEnabled(storedValue === "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(MICROPHONE_STORAGE_KEY, String(isMicrophoneEnabled));
  }, [isMicrophoneEnabled]);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="settings">
      <header className="settings__header">
        <div>
          <p className="eyebrow">{t("settingsPage.title")}</p>
          <h1 className="settings__title">{t("settingsPage.subtitle")}</h1>
        </div>
      </header>

      <section className="panel settings__section" aria-labelledby="language-section">
        <div className="settings__section-header">
          <div>
            <p id="language-section" className="eyebrow">
              {t("settingsPage.language")}
            </p>
            <h2 className="settings__section-title">{t("settingsPage.language")}</h2>
          </div>
        </div>
        <div className="settings__rows">
          <div className="settings__row">
            <button
              type="button"
              className={`outline ${i18n.language === "ru" ? "primary" : ""}`}
              onClick={() => changeLanguage("ru")}
              style={{ marginRight: "8px" }}
            >
              {t("settingsPage.languageRu")}
            </button>
            <button
              type="button"
              className={`outline ${i18n.language === "en" ? "primary" : ""}`}
              onClick={() => changeLanguage("en")}
            >
              {t("settingsPage.languageEn")}
            </button>
          </div>
        </div>
      </section>

      <section className="panel settings__section" aria-labelledby="profile-section">
        <div className="settings__section-header">
          <div>
            <p id="profile-section" className="eyebrow">
              {t("settingsPage.profileSection")}
            </p>
            <h2 className="settings__section-title">{t("settingsPage.profileTitle")}</h2>
          </div>
        </div>
        <div className="settings__rows">
          <div className="settings__row">
            <span className="settings__label">{t("settingsPage.firstName")}</span>
            <span className="settings__value">{telegramUser?.first_name ?? "—"}</span>
          </div>
          <div className="settings__row">
            <span className="settings__label">{t("settingsPage.username")}</span>
            <span className="settings__value">
              {telegramUser?.username ? `@${telegramUser.username}` : "—"}
            </span>
          </div>
        </div>
      </section>

      <section
        className="panel settings__section"
        aria-labelledby="defaults-section"
      >
        <div className="settings__section-header">
          <div>
            <p id="defaults-section" className="eyebrow">
              {t("settingsPage.defaultsSection")}
            </p>
            <h2 className="settings__section-title">{t("settingsPage.defaultsTitle")}</h2>
          </div>
        </div>
        <div className="settings__rows">
          <div className="settings__row">
            <div>
              <p className="settings__label">{t("settingsPage.microphone")}</p>
              <p className="muted">{t("settingsPage.microphoneDefault")}</p>
            </div>
            <button
              type="button"
              className={`toggle ${isMicrophoneEnabled ? "toggle--on" : "toggle--off"}`}
              aria-pressed={isMicrophoneEnabled}
              onClick={() => setIsMicrophoneEnabled((previous) => !previous)}
            >
              <span className="toggle__thumb" />
            </button>
          </div>
        </div>
      </section>

      <section
        className="panel settings__section"
        aria-labelledby="security-section"
      >
        <div className="settings__section-header">
          <div>
            <p id="security-section" className="eyebrow">
              {t("settingsPage.securitySection")}
            </p>
            <h2 className="settings__section-title">{t("settingsPage.securityTitle")}</h2>
          </div>
        </div>
        <p className="muted">
          {t("settingsPage.securityDescription")}
        </p>
      </section>

      <div className="settings__actions">
        <button type="button" className="outline" onClick={() => navigate(-1)}>
          {t("common.back")}
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;
