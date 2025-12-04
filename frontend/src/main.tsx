import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { WebAppConnectionProvider } from "./contexts/WebAppConnectionContext";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root container missing in index.html");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <WebAppConnectionProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </WebAppConnectionProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
