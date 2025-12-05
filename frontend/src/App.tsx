import React, { useCallback, useEffect } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Layout from "./components/Layout";
import MainPage from "./pages/MainPage";
import CreateCallPage from "./pages/CreateCallPage";
import JoinCallPage from "./pages/JoinCallPage";
import SettingsPage from "./pages/SettingsPage";
import CallPage from "./pages/CallPage";
import CallCreated from "./pages/CallCreated";
import { useTelegramBackButton } from "./hooks/useTelegramBackButton";
import { useTelegramWebApp } from "./hooks/useTelegramWebApp";
import { useAuth } from "./contexts/AuthContext";

function App(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { isReady: isTelegramReady, webApp } = useTelegramWebApp();
  const { user, authError, isAuthorizing, hasTriedAuth, loginWithTelegram } = useAuth();
  const handleBack = useCallback(() => navigate(-1), [navigate]);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("[App] Auth state:", {
      isTelegramReady,
      isAuthorizing,
      hasTriedAuth,
      hasUser: !!user,
    });

    if (!isTelegramReady || isAuthorizing || hasTriedAuth || user) {
      return;
    }

    // eslint-disable-next-line no-console
    console.log("[App] Starting automatic Telegram authorization");

    loginWithTelegram().catch((error) => {
      // eslint-disable-next-line no-console
      console.error("[App] Auto authorization failed", error);
    });
  }, [hasTriedAuth, isAuthorizing, isTelegramReady, loginWithTelegram, user]);

  useTelegramBackButton({
    webApp,
    pathname: location.pathname,
    onBack: handleBack,
  });

  return (
    <Layout>
      {authError ? (
        <p className="status status-offline" role="alert">
          {authError}
        </p>
      ) : null}

      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/create-call" element={<CreateCallPage />} />
        <Route path="/join-call" element={<JoinCallPage />} />
        <Route path="/call-created/:call_id" element={<CallCreated />} />
        <Route path="/call/:id" element={<CallPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
