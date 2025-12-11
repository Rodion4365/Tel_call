import React, { useEffect, useState } from "react";
import { TopBar } from "../components/layout/TopBar";
import { useNavigate, useParams } from "react-router-dom";
import { Link2, Copy } from "lucide-react";
import { MobileFrame } from "../components/layout/MobileFrame";
import { getCallById } from "../services/calls";

export default function ShareCallPageNew() {
  const navigate = useNavigate();
  const params = useParams();
  const callId = params.callId;

  const [joinUrl, setJoinUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const loadCall = async () => {
      if (!callId) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await getCallById(callId);
        setJoinUrl(response.join_url);
      } catch (err) {
        console.error("Failed to load call", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadCall();
  }, [callId]);

  const handleCopy = async () => {
    if (!joinUrl) return;

    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const handleShare = async () => {
    if (!joinUrl) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Присоединяйтесь к звонку",
          text: "Присоединяйтесь к моему звонку",
          url: joinUrl,
        });
      } catch (err) {
        console.error("Failed to share", err);
      }
    } else {
      handleCopy();
    }
  };

  if (isLoading) {
    return (
      <MobileFrame>
        <div className="h-full w-full bg-gradient-to-b from-[#0f111a] to-black text-white font-sans flex flex-col items-center justify-center">
          <div className="text-zinc-500">Загрузка...</div>
        </div>
      </MobileFrame>
    );
  }

  return (
    <MobileFrame>
      <div className="h-full w-full bg-gradient-to-b from-[#0f111a] to-black text-white font-sans flex flex-col">
        <TopBar showBack={true} backTo="/" />
        <div className="flex-1 px-4 flex items-center justify-center w-full max-w-md mx-auto">
          <div className="w-full bg-zinc-900/60 border border-zinc-800/60 rounded-[32px] p-6 space-y-6">
              <div>
                  <div className="text-xs font-semibold tracking-widest text-zinc-500 uppercase mb-2">
                      Звонок создан
                  </div>
                  <h1 className="text-2xl font-bold text-white mb-4 leading-tight">
                      Поделитесь ссылкой и присоединитесь к звонку
                  </h1>
              </div>
              <div className="flex flex-col gap-3">
                  <button
                      onClick={() => navigate(`/call/${callId}`)}
                      className="w-full h-12 bg-[#8B78E6] hover:bg-[#7A67D5] text-white rounded-2xl font-medium transition-colors"
                  >
                      Присоединиться
                  </button>

                  <div className="flex gap-3">
                      <button
                          onClick={handleShare}
                          className="flex-1 h-12 bg-[#E5E5EA] hover:bg-white text-black rounded-2xl font-medium transition-colors flex items-center justify-center gap-2"
                      >
                          Поделиться
                          <Link2 className="w-4 h-4" />
                      </button>
                      <button
                          onClick={handleCopy}
                          className="flex-1 h-12 bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl font-medium transition-colors flex items-center justify-center gap-2 border border-zinc-700"
                      >
                          {copied ? "Скопировано!" : "Скопировать"}
                          <Copy className="w-4 h-4" />
                      </button>
                  </div>
              </div>
          </div>
        </div>
      </div>
    </MobileFrame>
  );
}
