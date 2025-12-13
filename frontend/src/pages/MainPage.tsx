import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Video, UserPlus, Phone, Settings, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { createCall } from "../services/calls";
import MobileFrame from "../components/MobileFrame";

const MainPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthorizing, authError } = useAuth();

  const [isCreating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const secondaryBtn =
    "flex h-[50px] items-center justify-center gap-2 flex-1 max-w-[400px] rounded-xl border border-zinc-800/60 bg-zinc-900/50 px-3 text-zinc-200 transition-all hover:border-zinc-700 hover:bg-zinc-900 text-[13px] font-medium";

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

  const handleRefresh = () => {
    window.location.reload();
  };

  const primaryLabel = isAuthorizing
    ? t("mainPage.authorizing")
    : isCreating
      ? t("mainPage.creating")
      : t("mainPage.createCall");

  const isPrimaryDisabled = !user || isCreating || isAuthorizing;
  return (
    <MobileFrame>
      <div className="relative flex h-full flex-col justify-start text-white pt-5">
        {/* Header row: Заголовок по центру, Settings справа */}
        <div className="relative flex items-center justify-center px-6 mb-8">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            {t("mainPage.title")}
          </h1>
          <div className="absolute right-5">
            <Link
              to="/settings"
              aria-label={t("common.settings")}
              className="bg-zinc-900/50 p-2.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all border border-zinc-800/50 inline-flex"
            >
              <Settings className="w-5 h-5 stroke-[1.5]" />
            </Link>
          </div>
        </div>

        {/* Кнопки */}
        <div className="w-full max-w-md px-6 mx-auto">
          <div className="flex flex-col items-center gap-6">
            <div className="w-full flex flex-col gap-4 items-center">
              <motion.button
                onClick={handleCreateCall}
                disabled={isPrimaryDisabled}
                whileHover={isPrimaryDisabled ? undefined : { scale: 1.01 }}
                whileTap={isPrimaryDisabled ? undefined : { scale: 0.99 }}
                className={[
                  "flex h-[60px] w-full max-w-[400px] items-center justify-center gap-3 rounded-2xl text-[17px] font-medium transition-colors",
                  "shadow-[0_4px_20px_-4px_rgba(124,102,220,0.5)]",
                  isPrimaryDisabled
                    ? "cursor-not-allowed bg-[#7C66DC]/50 text-white/80"
                    : "bg-[#7C66DC] text-white hover:bg-[#6A55CA]",
                ].join(" ")}
              >
                <Video className="h-5 w-5 fill-white/20 stroke-[2]" />
                {primaryLabel}
              </motion.button>

              <div className="flex gap-4 w-full justify-center">
                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                  <Link to="/friends" className={secondaryBtn}>
                    <UserPlus className="h-3.5 w-3.5 stroke-[1.5]" />
                    <span>{t("mainPage.callFriend")}</span>
                  </Link>
                </motion.div>

                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                  <Link to="/join-call" className={secondaryBtn}>
                    <Phone className="h-3.5 w-3.5 stroke-[1.5]" />
                    <span>{t("mainPage.joinCall")}</span>
                  </Link>
                </motion.div>
              </div>

              {/* Статус авторизации - показывать только при ошибке авторизации */}
              {authError ? (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <p className="text-center text-[13px] text-red-400">
                    {t("mainPage.errorAuthRequired")}
                  </p>
                  <button
                    onClick={handleRefresh}
                    className="text-red-400 hover:text-red-300 transition-colors flex-shrink-0"
                    aria-label="Обновить страницу"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </MobileFrame>
  );
};

export default MainPage;
