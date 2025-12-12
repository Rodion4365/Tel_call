import React from "react";

interface MobileFrameProps {
  children: React.ReactNode;
}

const MobileFrame: React.FC<MobileFrameProps> = ({ children }) => {
  return (
    <div className="mobile-frame">
      <div className="mobile-frame__safe-area">{children}</div>
    </div>
  );
};

export default MobileFrame;
