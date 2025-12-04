import React from "react";
import "../styles.css";
import { ConnectionBanner } from "./ConnectionBanner";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="app-shell">
      <div className="app-container">
        <ConnectionBanner />
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
