import React from "react";
import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Call from "./pages/Call";
import CreateCall from "./pages/CreateCall";
import JoinCall from "./pages/JoinCall";
import Main from "./pages/Main";
import Settings from "./pages/Settings";
import { useTelegramWebApp } from "./hooks/useTelegramWebApp";

function App(): JSX.Element {
  const { isReady: isTelegramReady } = useTelegramWebApp();

  return (
    <Layout isTelegramReady={isTelegramReady}>
      <Routes>
        <Route path="/" element={<Main />} />
        <Route path="/create-call" element={<CreateCall />} />
        <Route path="/join-call" element={<JoinCall />} />
        <Route path="/call/:id" element={<Call />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
}

export default App;
