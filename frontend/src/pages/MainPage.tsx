import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Video, UserPlus, Phone } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { createCall } from "../services/calls";
import MobileFrame from "../components/MobileFrame";

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

  const primaryLabel = isAuthorizing
    ? t("mainPage.authorizing")
    : isCreating
      ? t("mainPage.creating")
      : t("mainPage.createCall");

  const isPrimaryDisabled = !user || isCreating || isAuthorizing;
  return (
    <MobileFrame>
      <div className="flex h-full items-center justify-center bg-gradient-to-b from-[#0f111a] to-black text-white">
        <div className="w-full max-w-md px-6">
          <div className="flex flex-col items-center gap-6 text-center">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              {t("mainPage.title")}
            </h1>

            {error ? (
              <p
                className="w-full rounded-2xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-center text-[14px] text-red-300"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <div className="w-full space-y-4">
              <motion.button
                onClick={handleCreateCall}
                disabled={isPrimaryDisabled}
                whileHover={isPrimaryDisabled ? undefined : { scale: 1.01 }}
                whileTap={isPrimaryDisabled ? undefined : { scale: 0.99 }}
                className={[
                  "flex h-[60px] w-full items-center justify-center gap-3 rounded-2xl text-[17px] font-medium transition-colors",
                  "shadow-[0_4px_20px_-4px_rgba(124,102,220,0.5)]",
                  isPrimaryDisabled
                    ? "cursor-not-allowed bg-[#7C66DC]/50 text-white/80"
                    : "bg-[#7C66DC] text-white hover:bg-[#6A55CA]",
                ].join(" ")}
              >
                <Video className="h-5 w-5 fill-white/20 stroke-[2]" />
                {primaryLabel}
              </motion.button>

              <div className="grid grid-cols-2 gap-3">
                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                  <Link
                    to="/friends"
                    className="group flex h-[84px] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-zinc-800/60 bg-zinc-900/60 text-zinc-200 transition-all hover:border-zinc-700"
                  >
                    <div className="rounded-full bg-zinc-800 p-2 transition-colors group-hover:bg-[#7C66DC]/20 group-hover:text-[#7C66DC]">
                      <UserPlus className="h-5 w-5 stroke-[1.5]" />
                    </div>
                    <span className="text-[14px] font-medium">{t("mainPage.callFriend")}</span>
                  </Link>
                </motion.div>

                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                  <Link
                    to="/join-call"
                    className="group flex h-[84px] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-zinc-800/60 bg-zinc-900/60 text-zinc-200 transition-all hover:border-zinc-700"
                  >
                    <div className="rounded-full bg-zinc-800 p-2 transition-colors group-hover:bg-[#7C66DC]/20 group-hover:text-[#7C66DC]">
                      <Phone className="h-5 w-5 stroke-[1.5]" />
                    </div>
                    <span className="text-[14px] font-medium">{t("mainPage.joinCall")}</span>
                  </Link>
                </motion.div>
              </div>

              {!user && !error ? (
                <p className="pt-2 text-center text-[13px] text-zinc-400">
                  {t("mainPage.errorAuthRequired")}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </MobileFrame>
  );
};

export default MainPage;
