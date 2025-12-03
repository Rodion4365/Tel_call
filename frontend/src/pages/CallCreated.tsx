import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getTelegramWebApp } from "../services/telegram";

interface LocationState {
  join_url?: string;
}

const CallCreated: React.FC = () => {
  const { call_id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const joinUrl = searchParams.get("join_url") ?? (location.state as LocationState | null)?.join_url ?? "";

  const shareTitle = useMemo(() => {
    const displayName = user?.first_name || user?.username || "Пользователь";
    return `Звонок от "${displayName}"`;
  }, [user]);
  const shareText = useMemo(() => `${shareTitle}\nПрисоединиться к звонку:`, [shareTitle]);

  const [isToastVisible, setToastVisible] = useState(false);
  const [isShareModalOpen, setShareModalOpen] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (isToastVisible) {
      timeout = setTimeout(() => setToastVisible(false), 1000);
    }

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [isToastVisible]);

  const handleJoinCall = () => {
    if (!call_id) {
      return;
    }

    // eslint-disable-next-line no-console
    console.log("[JoinCall] from created screen", { call_id, joinUrl });

    navigate(`/call/${call_id}`, {
      state: {
        join_url: joinUrl,
        mediaPreferences: { video: false, audio: true },
      },
    });
  };

  const copyLink = async () => {
    if (!joinUrl) {
      return;
    }

    // eslint-disable-next-line no-console
    console.log("[ShareCall] copy join link");

    try {
      await navigator.clipboard.writeText(joinUrl);
      setToastVisible(true);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[ShareCall] failed to copy link", error);
      setShareModalOpen(true);
    }
  };

  const handleShare = async () => {
    if (!joinUrl) {
      return;
    }

    // eslint-disable-next-line no-console
    console.log("[ShareCall] share button click");

    if (shareViaTelegram()) {
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: joinUrl,
        });
        return;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[ShareCall] native share failed", error);
      }
    }

    setShareModalOpen(true);
  };

  const shareViaTelegram = () => {
    if (!joinUrl) {
      return false;
    }

    // eslint-disable-next-line no-console
    console.log("[ShareCall] telegram share");

    const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(joinUrl)}&text=${encodeURIComponent(
      shareText,
    )}`;

    const telegramWebApp = getTelegramWebApp();
    if (telegramWebApp?.openTelegramLink) {
      telegramWebApp.openTelegramLink(telegramShareUrl);
      return true;
    }

    const newWindow = window.open(telegramShareUrl, "_blank", "noreferrer");
    return Boolean(newWindow);
  };

  const handleTelegramShare = () => {
    if (shareViaTelegram()) {
      return;
    }

    setShareModalOpen(true);
  };

  const closeModal = () => setShareModalOpen(false);

  return (
    <div className="panel call-created">
      <div className="call-created__header">
        <div>
          <p className="eyebrow">Звонок создан</p>
          <h1>Поделитесь ссылкой или присоединяйтесь сами</h1>
        </div>
        <button className="ghost-button" onClick={() => navigate("/")}>Назад</button>
      </div>

      <div className="call-created__content">
        <div className="call-created__link-card">
          <div>
            <p className="muted">Ссылка для приглашения</p>
            <p className="call-created__link" title={joinUrl || "Нет ссылки"}>
              {joinUrl || "join_url не передан"}
            </p>
          </div>
          <button className="secondary" onClick={copyLink} disabled={!joinUrl}>
            Скопировать
          </button>
        </div>

        <div className="call-created__actions">
          <button className="primary" onClick={handleJoinCall} disabled={!call_id}>
            Присоединиться к звонку
          </button>
          <div className="call-created__actions-row">
            <button className="secondary" onClick={copyLink} disabled={!joinUrl}>
              Скопировать ссылку
            </button>
            <button className="outline" onClick={handleShare} disabled={!joinUrl}>
              Поделиться ссылкой
            </button>
          </div>
        </div>
      </div>

      {isToastVisible && <div className="toast">Ссылка скопирована</div>}

      {isShareModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal__header">
              <h2>Поделиться ссылкой</h2>
              <button className="ghost-button" onClick={closeModal} aria-label="Закрыть модалку">
                Закрыть
              </button>
            </div>

            <div className="modal__body">
              <label className="form-field">
                <span>Ссылка приглашения</span>
                <input type="url" value={joinUrl} readOnly />
              </label>
              <div className="modal__actions">
                <button className="secondary" onClick={copyLink} disabled={!joinUrl}>
                  Скопировать
                </button>
                <button className="outline" onClick={handleTelegramShare} disabled={!joinUrl}>
                  Отправить в Telegram
                </button>
              </div>
              <p className="muted">Можно отправить в WhatsApp, Telegram, Email...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallCreated;
