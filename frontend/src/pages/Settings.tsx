import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getTelegramUser } from "../services/telegram";

const MICROPHONE_STORAGE_KEY = "tel-call:microphone-enabled";

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const telegramUser = useMemo(() => getTelegramUser(), []);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(true);

  useEffect(() => {
    const storedValue = localStorage.getItem(MICROPHONE_STORAGE_KEY);

    if (storedValue !== null) {
      setIsMicrophoneEnabled(storedValue === "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(MICROPHONE_STORAGE_KEY, String(isMicrophoneEnabled));
  }, [isMicrophoneEnabled]);

  return (
    <div className="settings">
      <header className="settings__header">
        <div>
          <p className="eyebrow">Настройки</p>
          <h1 className="settings__title">Ваш профиль и звонки</h1>
        </div>
      </header>

      <section className="panel settings__section" aria-labelledby="profile-section">
        <div className="settings__section-header">
          <div>
            <p id="profile-section" className="eyebrow">
              Профиль
            </p>
            <h2 className="settings__section-title">Данные аккаунта</h2>
            <p className="muted">Информация передаётся из Telegram initData.</p>
          </div>
        </div>
        <div className="settings__rows">
          <div className="settings__row">
            <span className="settings__label">Имя</span>
            <span className="settings__value">{telegramUser?.first_name ?? "—"}</span>
          </div>
          <div className="settings__row">
            <span className="settings__label">Username</span>
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
              Настройки по умолчанию
            </p>
            <h2 className="settings__section-title">Параметры звонка</h2>
            <p className="muted">Управляйте поведением звонков по умолчанию.</p>
          </div>
        </div>
        <div className="settings__rows">
          <div className="settings__row">
            <div>
              <p className="settings__label">Видео</p>
              <p className="muted">Выключено всегда</p>
            </div>
            <button type="button" className="toggle toggle--disabled" disabled>
              <span className="toggle__thumb" />
            </button>
          </div>
          <div className="settings__row">
            <div>
              <p className="settings__label">Микрофон</p>
              <p className="muted">Включён по умолчанию</p>
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
              Безопасность
            </p>
            <h2 className="settings__section-title">Шифрование</h2>
          </div>
        </div>
        <p className="muted">
          Звонки защищены WebRTC (DTLS-SRTP). Видео и аудио не записываются.
        </p>
      </section>

      <div className="settings__actions">
        <button type="button" className="outline" onClick={() => navigate(-1)}>
          Назад
        </button>
      </div>
    </div>
  );
};

export default Settings;
