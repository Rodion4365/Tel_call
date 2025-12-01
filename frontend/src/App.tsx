import React, { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Call from "./pages/Call";
import CreateCall from "./pages/CreateCall";
import JoinCall from "./pages/JoinCall";
import Main from "./pages/Main";
import Settings from "./pages/Settings";
import { initTelegramWebApp } from "./services/telegram";

function App(): JSX.Element {
  const [isTelegramReady, setTelegramReady] = useState(false);

  useEffect(() => {
    const webApp = initTelegramWebApp();
    setTelegramReady(Boolean(webApp));
  }, []);

  return (
    <BrowserRouter>
      <Layout isTelegramReady={isTelegramReady}>
        <Routes>
          <Route path="/" element={<Main />} />
          <Route path="/create-call" element={<CreateCall />} />
          <Route path="/join-call" element={<JoinCall />} />
          <Route path="/call/:id" element={<Call />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
