import React, { useCallback, useEffect, useMemo } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Layout from "./components/Layout";
import MainPage from "./pages/MainPage";
import CreateCallPage from "./pages/CreateCallPage";
import JoinCallPage from "./pages/JoinCallPage";
import SettingsPage from "./pages/SettingsPage";
import CallPage from "./pages/CallPage";
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
    if (!isTelegramReady || isAuthorizing || hasTriedAuth || user) {
      return;
    }

    loginWithTelegram().catch((error) => {
      // eslint-disable-next-line no-console
      console.error("Auto authorization failed", error);
    });
  }, [hasTriedAuth, isAuthorizing, isTelegramReady, loginWithTelegram, user]);

  useTelegramBackButton({
    webApp,
    pathname: location.pathname,
    onBack: handleBack,
  });

  const authStatus = useMemo(() => {
    if (isAuthorizing) {
      return { label: "Авторизация...", variant: "pending" as const };
    }

    if (authError) {
      return { label: "Ошибка авторизации", variant: "offline" as const };
    }

    if (user) {
      return { label: "Готово", variant: "online" as const };
    }

    return { label: "Авторизация не выполнена", variant: "offline" as const };
  }, [authError, isAuthorizing, user]);

  return (
    <Layout isTelegramReady={isTelegramReady} authStatus={authStatus}>
      {authError ? (
        <p className="status status-offline" role="alert">
          {authError}
        </p>
      ) : null}

      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/create-call" element={<CreateCallPage />} />
        <Route path="/join-call" element={<JoinCallPage />} />
        <Route path="/call/:id" element={<CallPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
