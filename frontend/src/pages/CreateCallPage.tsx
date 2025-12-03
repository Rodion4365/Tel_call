import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AUTH_STORAGE_KEY, useAuth } from "../contexts/AuthContext";
import { createCall } from "../services/calls";

const CreateCallPage: React.FC = () => {
  const navigate = useNavigate();
  const { token, user, isAuthorizing, loginWithTelegram } = useAuth();
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("[Auth] token =", token);
  }, [token]);

  const handleCreateCall = async () => {
    // eslint-disable-next-line no-console
    console.log("[CreateCall] click");
    setSubmitting(true);
    setError(null);

    try {
      if (!user) {
        await loginWithTelegram();
      }

      let authToken = token;

      if (!authToken) {
        const rawAuth = localStorage.getItem(AUTH_STORAGE_KEY);

        if (rawAuth) {
          try {
            const parsedAuth = JSON.parse(rawAuth) as { token: string };
            authToken = parsedAuth.token;
          } catch (parseError) {
            // eslint-disable-next-line no-console
            console.error("[CreateCall] failed to parse stored auth", parseError);
          }
        }
      }

      if (!authToken) {
        // eslint-disable-next-line no-console
        console.error("[CreateCall] missing auth token");
        setError("Не удалось авторизоваться. Попробуйте снова.");
        return;
      }

      // eslint-disable-next-line no-console
      console.log("[CreateCall] using auth token", authToken);

      const response = await createCall(
        { title: null, is_video_enabled: false },
        authToken,
      );

      // eslint-disable-next-line no-console
      console.log("[CreateCall] success", response);

      const joinUrlParam = encodeURIComponent(response.join_url);

      navigate(`/call-created/${response.call_id}?join_url=${joinUrlParam}`, {
        state: { join_url: response.join_url },
        replace: true,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[CreateCall] failed to create call", err);

      const message =
        err instanceof Error && err.message
          ? `Не удалось создать звонок: ${err.message}`
          : "Не удалось создать звонок. Попробуйте снова.";

      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="panel">
      <h1>Создать звонок</h1>
      <p>Микрофон включен по умолчанию, видео выключено. Ссылка появится сразу после создания.</p>

      {error ? (
        <p className="status status-offline" role="alert">
          {error}
        </p>
      ) : null}

      <div className="form">
        <button
          type="button"
          className="primary"
          onClick={handleCreateCall}
          disabled={isSubmitting || isAuthorizing}
        >
          {isSubmitting ? "Создаём…" : "Создать звонок"}
        </button>
        <button type="button" className="outline" onClick={() => navigate("/")} disabled={isSubmitting}>
          Назад
        </button>
      </div>
    </div>
  );
};

export default CreateCallPage;
