import React, { useState } from "react";
import { Video, UserPlus, Phone, Settings } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { TopBar } from "../components/layout/TopBar";
import { MobileFrame } from "../components/layout/MobileFrame";
import { createCall } from "../services/calls";
import { useAuth } from "../contexts/AuthContext";

export default function CallsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isCreating, setCreating] = useState(false);

  const handleCreateCall = async () => {
    if (!user || isCreating) return;

    setCreating(true);
    try {
      const response = await createCall({ title: null, is_video_enabled: false });
      const joinUrlParam = encodeURIComponent(response.join_url);
      navigate(`/call-created/${response.call_id}?join_url=${joinUrlParam}`);
    } catch (err) {
      console.error("Failed to create call", err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <MobileFrame>
      <div className="h-full w-full bg-gradient-to-b from-[#0f111a] to-black text-white relative font-sans flex flex-col">
        <TopBar />

        {/* Кнопка настроек */}
        <div className="absolute top-20 right-4 z-10">
          <button
            onClick={() => navigate("/settings")}
            className="bg-zinc-900/50 p-2.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all border border-zinc-800/50 cursor-pointer"
          >
            <Settings className="w-5 h-5 stroke-[1.5]" />
          </button>
        </div>

        {/* Центральный контент */}
        <div className="flex-1 flex flex-col justify-center items-center px-6 w-full max-w-md mx-auto z-0">
          <div className="mb-12 text-center space-y-2">
            <h1 className="text-4xl font-semibold tracking-tight text-white">
              Звонки
            </h1>
          </div>

          <div className="w-full space-y-4">
            {/* Создать звонок */}
            <motion.button
              onClick={handleCreateCall}
              disabled={isCreating || !user}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full h-[60px] text-[17px] font-medium bg-[#7C66DC] hover:bg-[#6A55CA] text-white rounded-2xl flex items-center justify-center gap-3 transition-colors shadow-[0_4px_20px_-4px_rgba(124,102,220,0.5)] disabled:opacity-50"
            >
              <Video className="w-5 h-5 fill-white/20 stroke-[2]" />
              {isCreating ? "Создание..." : "Создать звонок"}
            </motion.button>

            {/* Позвонить другу + Присоединиться */}
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
                <span className="text-[15px] font-medium">Позвонить другу</span>
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
                <span className="text-[15px] font-medium">Присоединиться</span>
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </MobileFrame>
  );
}
