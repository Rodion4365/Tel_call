import React from "react";

interface MobileFrameProps {
  children: React.ReactNode;
}

const MobileFrame: React.FC<MobileFrameProps> = ({ children }) => {
  return (
    <div className="h-screen w-full overflow-hidden">
      {children}
    </div>
  );
};

export default MobileFrame;
