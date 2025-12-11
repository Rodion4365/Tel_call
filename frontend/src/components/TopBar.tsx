import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

interface TopBarProps {
  title?: string;
  showBack?: boolean;
  backTo?: string;
}

const TopBar: React.FC<TopBarProps> = ({ title, showBack = false, backTo }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (backTo) {
      navigate(backTo);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-b from-[#0f111a] to-transparent">
      {showBack ? (
        <button
          onClick={handleBack}
          className="flex items-center text-white hover:text-zinc-300 transition-colors"
          aria-label="Назад"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      ) : (
        <div />
      )}
      {title && <h2 className="text-white font-semibold text-lg">{title}</h2>}
      <div />
    </div>
  );
};

export default TopBar;
