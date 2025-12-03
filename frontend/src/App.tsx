import React, { useCallback } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Layout from "./components/Layout";
import MainPage from "./pages/MainPage";
import CreateCallPage from "./pages/CreateCallPage";
import JoinCallPage from "./pages/JoinCallPage";
import SettingsPage from "./pages/SettingsPage";
import CallPage from "./pages/CallPage";
import { useTelegramBackButton } from "./hooks/useTelegramBackButton";
import { useTelegramWebApp } from "./hooks/useTelegramWebApp";

function App(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { isReady: isTelegramReady, webApp } = useTelegramWebApp();
  const handleBack = useCallback(() => navigate(-1), [navigate]);

  useTelegramBackButton({
    webApp,
    pathname: location.pathname,
    onBack: handleBack,
  });

  return (
    <Layout isTelegramReady={isTelegramReady}>
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
