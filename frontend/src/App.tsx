import React, { useCallback, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import CallsPage from "./pages/CallsPage";
import JoinCallPageNew from "./pages/JoinCallPageNew";
import SettingsPageNew from "./pages/SettingsPageNew";
import CallPage from "./pages/CallPage";
import ShareCallPageNew from "./pages/ShareCallPageNew";
import FriendsPageNew from "./pages/FriendsPageNew";
import TermsPage from "./pages/TermsPage";
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
      {authError ? (
        <p className="status status-offline" role="alert">
          {authError}
        </p>
      ) : null}

      <Routes>
        <Route path="/" element={<CallsPage />} />
        <Route path="/friends" element={<FriendsPageNew />} />
        <Route path="/join-call" element={<JoinCallPageNew />} />
        <Route path="/call-created/:callId" element={<ShareCallPageNew />} />
        <Route path="/call/:id" element={<CallPage />} />
        <Route path="/settings" element={<SettingsPageNew />} />
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
