import React, { useCallback, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import MainPage from "./pages/MainPage";
import JoinCallPage from "./pages/JoinCallPage";
import SettingsPage from "./pages/SettingsPage";
import TermsPage from "./pages/TermsPage";
import CallPage from "./pages/CallPage";
import CallCreated from "./pages/CallCreated";
import FriendsPage from "./pages/FriendsPage";
import CallEndedPage from "./pages/CallEndedPage";
import { useTelegramBackButton } from "./hooks/useTelegramBackButton";
import { useTelegramWebApp } from "./hooks/useTelegramWebApp";
import { useAuth } from "./contexts/AuthContext";
import { NavigationProvider, useNavigation } from "./contexts/NavigationContext";

function AppContent(): JSX.Element {
  const location = useLocation();
  const { isReady: isTelegramReady, webApp } = useTelegramWebApp();
  const { user, authError, isAuthorizing, hasTriedAuth, loginWithTelegram } = useAuth();
  const { navigateBack } = useNavigation();
  const handleBack = useCallback(() => navigateBack(), [navigateBack]);

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
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/join-call" element={<JoinCallPage />} />
        <Route path="/call-created/:call_id" element={<CallCreated />} />
        <Route path="/call/:id" element={<CallPage />} />
        <Route path="/call-ended" element={<CallEndedPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/terms" element={<TermsPage />} />
      </Routes>
    </Layout>
  );
}

function App(): JSX.Element {
  return (
    <NavigationProvider>
      <AppContent />
    </NavigationProvider>
  );
}

export default App;
