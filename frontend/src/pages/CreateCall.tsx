import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { createCall } from "../services/calls";

const CreateCall: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateCall = async () => {
    if (!token) {
      setError("Авторизация не выполнена");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await createCall(token);
      navigate(`/call-created/${response.call_id}`, {
        state: { join_url: response.join_url },
        replace: true,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to create call", err);
      setError("Не удалось создать звонок. Попробуйте снова.");
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
        <button type="button" className="primary" onClick={handleCreateCall} disabled={isSubmitting || !token}>
          {isSubmitting ? "Создаем..." : "Создать звонок"}
        </button>
        <button type="button" className="outline" onClick={() => navigate(-1)} disabled={isSubmitting}>
          Назад
        </button>
      </div>
    </div>
  );
};

export default CreateCall;
