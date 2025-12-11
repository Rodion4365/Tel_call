import React from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../../lib/utils";

interface TopBarProps {
  title?: string;
  showBack?: boolean;
  backTo?: string;
  className?: string;
}

export const TopBar: React.FC<TopBarProps> = ({ title, showBack = false, backTo = "/", className }) => {
  const navigate = useNavigate();

  return (
    <div className={cn("flex items-center justify-between px-4 py-4", className)}>
      {showBack ? (
        <button
          onClick={() => navigate(backTo)}
          className="text-white hover:text-zinc-300 transition-colors"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>
      ) : (
        <div className="w-7 h-7" />
      )}

      {title && (
        <h1 className="text-lg font-semibold text-white">{title}</h1>
      )}

      <div className="w-7 h-7" />
    </div>
  );
};
