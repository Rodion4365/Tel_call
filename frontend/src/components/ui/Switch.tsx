import React from "react";
import { cn } from "../../lib/utils";

interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
}

const Switch: React.FC<SwitchProps> = ({
  checked,
  defaultChecked = false,
  onCheckedChange,
  className,
  disabled = false,
}) => {
  const [isChecked, setIsChecked] = React.useState(defaultChecked);

  const currentChecked = checked !== undefined ? checked : isChecked;

  const handleToggle = () => {
    if (disabled) return;

    const newValue = !currentChecked;

    if (checked === undefined) {
      setIsChecked(newValue);
    }

    onCheckedChange?.(newValue);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={currentChecked}
      disabled={disabled}
      onClick={handleToggle}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        currentChecked ? "bg-[#7C66DC]" : "bg-zinc-700",
        className
      )}
    >
      <span
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
          currentChecked ? "translate-x-6" : "translate-x-0.5"
        )}
      />
    </button>
  );
};

export default Switch;
