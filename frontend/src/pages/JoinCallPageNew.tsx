import React, { useState } from "react";
import { TopBar } from "../components/layout/TopBar";
import { useNavigate } from "react-router-dom";
import { MobileFrame } from "../components/layout/MobileFrame";
import { joinCallByCode } from "../services/calls";
import { useAuth } from "../contexts/AuthContext";

export default function JoinCallPageNew() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [callCode, setCallCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async () => {
    if (!user || !callCode.trim() || isJoining) return;

    setIsJoining(true);

    try {
      let extractedCallId = callCode.trim();

      // Извлекаем call_id из ссылки telegram
      if (callCode.includes("t.me") || callCode.includes("startapp=")) {
        const match = callCode.match(/startapp=([a-zA-Z0-9_-]+)/);
        if (match) {
          extractedCallId = match[1];
        }
      }

      const response = await joinCallByCode(extractedCallId);
      navigate(`/call/${response.call_id}`);
    } catch (err) {
      console.error("Failed to join call", err);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <MobileFrame>
      <div className="h-full w-full bg-gradient-to-b from-[#0f111a] to-black text-white font-sans flex flex-col">
        <TopBar showBack={true} backTo="/" />
        <div className="flex-1 px-4 flex items-center justify-center w-full max-w-md mx-auto">
          <div className="w-full bg-zinc-900/60 border border-zinc-800/60 rounded-[32px] p-6 space-y-6">
              <div>
                  <h1 className="text-3xl font-bold text-white mb-4 leading-tight">
                      Присоединиться к звонку
                  </h1>
                  <p className="text-zinc-500 text-[15px] leading-relaxed">
                      Вставьте ссылку или ID звонка, чтобы подключиться вручную.
                  </p>
              </div>
              <div className="space-y-2">
                  <label className="text-white font-medium text-sm">Ссылка или ID звонка</label>
                  <input
                      type="text"
                      placeholder="Например, https://t.me/bot?startapp=al"
                      value={callCode}
                      onChange={(e) => setCallCode(e.target.value)}
                      disabled={isJoining}
                      className="w-full h-12 bg-black border border-zinc-700 rounded-xl px-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#7C66DC] transition-colors text-sm"
                  />
              </div>
              <div className="flex gap-3 pt-2">
                  <button
                      onClick={handleJoin}
                      disabled={isJoining || !callCode.trim()}
                      className="flex-1 h-12 bg-[#7C66DC] hover:bg-[#6A55CA] text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                  >
                      {isJoining ? "Подключение..." : "Подключиться"}
                  </button>
                  <button
                      onClick={() => navigate("/")}
                      disabled={isJoining}
                      className="flex-1 h-12 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors"
                  >
                      Назад
                  </button>
              </div>
          </div>
        </div>
      </div>
    </MobileFrame>
  );
}
