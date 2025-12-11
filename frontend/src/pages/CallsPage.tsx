import React, { useState } from "react";
import { Video, UserPlus, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
        {/* Minimal header without TopBar */}
        <div className="h-16" />

        <div className="flex-1 flex flex-col justify-center items-center px-6 w-full max-w-md mx-auto">
          <div className="mb-12 text-center">
              <h1 className="text-4xl font-semibold tracking-tight text-white">Звонки</h1>
          </div>

          <div className="w-full space-y-4">
            {/* Primary Action Button */}
            <button
              onClick={handleCreateCall}
              disabled={isCreating || !user}
              className="w-full h-[60px] text-[17px] font-medium bg-[#7C66DC] hover:bg-[#6A55CA] text-white rounded-2xl flex items-center justify-center gap-3 transition-colors shadow-[0_4px_20px_-4px_rgba(124,102,220,0.5)] disabled:opacity-50"
            >
              <Video className="w-5 h-5" />
              {isCreating ? "Создание..." : "Создать звонок"}
            </button>

            {/* Secondary Action Buttons - Vertical Layout */}
            <button
              onClick={() => navigate("/friends")}
              className="w-full h-[60px] text-[17px] font-medium bg-[#7C66DC] hover:bg-[#6A55CA] text-white rounded-2xl flex items-center justify-center gap-3 transition-colors"
            >
              <UserPlus className="w-5 h-5" />
              Позвонить другу
            </button>

            <button
              onClick={() => navigate("/join-call")}
              className="w-full h-[60px] text-[17px] font-medium bg-[#7C66DC] hover:bg-[#6A55CA] text-white rounded-2xl flex items-center justify-center gap-3 transition-colors"
            >
              <Phone className="w-5 h-5" />
              Присоединиться
            </button>
          </div>
        </div>
      </div>
    </MobileFrame>
  );
}
