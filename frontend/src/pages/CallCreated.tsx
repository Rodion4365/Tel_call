import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getTelegramWebApp } from "../services/telegram";
import { Copy, Link2, Video } from "lucide-react";
import { motion } from "framer-motion";
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

  const secondaryBtn =
    "flex items-center justify-center gap-2 flex-1 max-w-[400px] h-[50px] rounded-xl border border-zinc-800/60 bg-zinc-900/50 px-3 text-zinc-200 transition-all hover:border-zinc-700 hover:bg-zinc-900 text-[13px] font-medium disabled:opacity-50 disabled:cursor-not-allowed";

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
      <div className="relative flex h-full flex-col justify-start text-white pt-5">
        {/* Контент */}
        <div className="w-full max-w-md px-6 mx-auto">
          <div className="flex flex-col items-center gap-6 text-center">
            <div>
              <h1 className="text-[28px] font-semibold leading-tight tracking-tight mb-2">
                {t("callCreatedPage.title")}
              </h1>
              <p className="text-[15px] text-zinc-400">
                {t("callCreatedPage.description")}
              </p>
            </div>

            <div className="w-full flex flex-col gap-4 items-center">
              {/* Primary кнопка - Присоединиться */}
              <motion.button
                onClick={handleJoinCall}
                disabled={!call_id}
                whileHover={!call_id ? undefined : { scale: 1.01 }}
                whileTap={!call_id ? undefined : { scale: 0.98 }}
                className={[
                  "flex items-center justify-center gap-2",
                  "w-full max-w-[400px] h-[60px]",
                  "rounded-2xl border border-zinc-800/60 bg-zinc-900/50",
                  "text-zinc-200 text-[16px] font-medium",
                  "transition hover:border-zinc-700 hover:bg-zinc-900",
                  "active:scale-[0.98]",
                  !call_id ? "cursor-not-allowed opacity-50" : "",
                ].join(" ")}
              >
                <Video className="w-5 h-5" />
                {t("callCreatedPage.joinButton")}
              </motion.button>

              {/* Secondary кнопки в ряд */}
              <div className="flex gap-4 w-full justify-center">
                <motion.button
                  onClick={handleShare}
                  disabled={!joinUrl}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className={secondaryBtn}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  {t("callCreatedPage.shareButton")}
                </motion.button>

                <motion.button
                  onClick={copyLink}
                  disabled={!joinUrl}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className={secondaryBtn}
                >
                  <Copy className="w-3.5 h-3.5" />
                  {t("callCreatedPage.copyLinkButton")}
                </motion.button>
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
