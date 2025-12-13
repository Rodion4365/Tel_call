import React from "react";
import { useLocation } from "react-router-dom";
import "../styles.css";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const isCallPage = location.pathname.startsWith("/call/");

  return (
    <div className={`app-shell ${isCallPage ? "app-shell--call" : ""}`}>
      <div className={`app-container ${isCallPage ? "app-container--call" : ""}`}>
        <main className={`app-content ${isCallPage ? "app-content--call" : ""}`}>{children}</main>
      </div>
    </div>
  );
};

export default Layout;
