import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Video, UserPlus, Phone, Settings } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { createCall } from "../services/calls";
import { motion } from "framer-motion";

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
    <div className="h-full w-full bg-gradient-to-b from-[#0f111a] to-black text-white relative font-sans flex flex-col">
      {/* Settings Button */}
      <div className="absolute top-20 right-4 z-10">
        <button
          onClick={() => navigate("/settings")}
          className="bg-zinc-900/50 p-2.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all border border-zinc-800/50 cursor-pointer"
        >
          <Settings className="w-5 h-5 stroke-[1.5]" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 w-full max-w-md mx-auto z-0">
        {/* Title */}
        <div className="mb-12 text-center space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight text-white">{t("mainPage.title")}</h1>
        </div>

        {/* Error Message */}
        {error ? (
          <div className="w-full mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-center" role="alert">
            <p className="text-red-200">{error}</p>
          </div>
        ) : null}

        {/* Actions */}
        <div className="w-full space-y-4">
          {/* Primary Action - Create Call */}
          <motion.button
            onClick={handleCreateCall}
            disabled={!user || isCreating || isAuthorizing}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full h-[60px] text-[17px] font-medium bg-[#7C66DC] hover:bg-[#6A55CA] text-white rounded-2xl flex items-center justify-center gap-3 transition-colors shadow-[0_4px_20px_-4px_rgba(124,102,220,0.5)] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Video className="w-5 h-5 fill-white/20 stroke-[2]" />
            {isAuthorizing
              ? t("mainPage.authorizing")
              : isCreating
                ? t("mainPage.creating")
                : t("mainPage.createCall")}
          </motion.button>

          {/* Secondary Actions */}
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              onClick={() => navigate("/friends")}
              whileHover={{ scale: 1.01, backgroundColor: "rgba(39, 39, 42, 1)" }}
              whileTap={{ scale: 0.99 }}
              className="h-[100px] flex flex-col items-center justify-center gap-3 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl text-zinc-200 hover:border-zinc-700 transition-all group"
            >
              <div className="p-2.5 rounded-full bg-zinc-800 group-hover:bg-[#7C66DC]/20 group-hover:text-[#7C66DC] transition-colors">
                <UserPlus className="w-6 h-6 stroke-[1.5]" />
              </div>
              <span className="text-[15px] font-medium">{t("mainPage.callFriend")}</span>
            </motion.button>

            <motion.button
              onClick={() => navigate("/join-call")}
              whileHover={{ scale: 1.01, backgroundColor: "rgba(39, 39, 42, 1)" }}
              whileTap={{ scale: 0.99 }}
              className="h-[100px] flex flex-col items-center justify-center gap-3 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl text-zinc-200 hover:border-zinc-700 transition-all group"
            >
              <div className="p-2.5 rounded-full bg-zinc-800 group-hover:bg-[#7C66DC]/20 group-hover:text-[#7C66DC] transition-colors">
                <Phone className="w-6 h-6 stroke-[1.5]" />
              </div>
              <span className="text-[15px] font-medium">{t("mainPage.joinCall")}</span>
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainPage;
