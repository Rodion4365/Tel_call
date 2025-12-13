import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getTelegramWebApp } from "../services/telegram";
import { Copy, Link2 } from "lucide-react";
import MobileFrame from "../components/MobileFrame";

interface LocationState {
  join_url?: string;
}

const CallCreated: React.FC = () => {
  const { t } = useTranslation();
  const { call_id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const joinUrl = searchParams.get("join_url") ?? (location.state as LocationState | null)?.join_url ?? "";

  const shareTitle = useMemo(() => {
    const displayName = user?.first_name || user?.username || t("friendsPage.nameless");
    return t("callCreatedPage.callFromUser", { displayName });
  }, [user, t]);
  const shareText = useMemo(() => `${shareTitle}\n${t("callCreatedPage.joinCallMessage")}`, [shareTitle, t]);

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
      // Fallback: show modal if clipboard API fails
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
    if (!joinUrl || !call_id) {
      return false;
    }

    // eslint-disable-next-line no-console
    console.log("[ShareCall] telegram share via inline query");

    const telegramWebApp = getTelegramWebApp();

    // Используем switchInlineQuery для отправки сообщения с кнопкой через inline mode
    if (telegramWebApp?.switchInlineQuery) {
      // Формируем inline query с ID звонка
      const inlineQuery = `call_${call_id}`;

      try {
        telegramWebApp.switchInlineQuery(inlineQuery, ["users", "groups", "channels"]);
        return true;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[ShareCall] switchInlineQuery failed", error);
      }
    }

    // Fallback: используем старый способ через share URL
    const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(joinUrl)}&text=${encodeURIComponent(
      shareText,
    )}`;

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
    <MobileFrame>
      <div className="call-created-screen">
        <div className="call-created-top-bar">
          <span className="call-created-top-bar__indicator" aria-hidden="true" />
        </div>

        <div className="call-created-layout">
          <div className="call-created-card">
            <div>
              <p className="call-created-eyebrow">{t("callCreatedPage.title")}</p>
              <h1 className="call-created-title">{t("callCreatedPage.description")}</h1>
            </div>

            <div className="call-created-actions">
              <button className="call-created-button call-created-button--primary" onClick={handleJoinCall} disabled={!call_id}>
                {t("callCreatedPage.joinButton")}
              </button>

              <div className="call-created-actions__row">
                <button className="call-created-button call-created-button--secondary" onClick={handleShare} disabled={!joinUrl}>
                  {t("callCreatedPage.shareButton")}
                  <Link2 className="call-created-button__icon" aria-hidden="true" />
                </button>
                <button className="call-created-button call-created-button--outline" onClick={copyLink} disabled={!joinUrl}>
                  {t("callCreatedPage.copyLinkButton")}
                  <Copy className="call-created-button__icon" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {isToastVisible && <div className="toast call-created-toast">{t("callCreatedPage.linkCopied")}</div>}

        {isShareModalOpen && (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="modal">
              <div className="modal__header">
                <h2>{t("callCreatedPage.modalTitle")}</h2>
                <button className="ghost-button" onClick={closeModal} aria-label={t("callCreatedPage.modalCloseAria")}>
                  {t("callCreatedPage.modalClose")}
                </button>
              </div>

              <div className="modal__body">
                <label className="form-field">
                  <span>{t("callCreatedPage.invitationLink")}</span>
                  <input type="url" value={joinUrl} readOnly />
                </label>
                <div className="modal__actions">
                  <button className="secondary" onClick={copyLink} disabled={!joinUrl}>
                    {t("callCreatedPage.copyLinkButton")}
                  </button>
                  <button className="outline" onClick={handleTelegramShare} disabled={!joinUrl}>
                    {t("callCreatedPage.sendToTelegram")}
                  </button>
                </div>
                <p className="muted">{t("callCreatedPage.shareDescription")}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </MobileFrame>
  );
};

export default CallCreated;
