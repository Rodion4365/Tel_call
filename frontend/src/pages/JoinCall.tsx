import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { joinCallByCode } from "../services/calls";

const JoinCall: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [callCode, setCallCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    const normalizedCode = callCode.trim();

    if (!normalizedCode) {
      setErrorMessage("Введите ID звонка");
      return;
    }

    if (!token) {
      setErrorMessage("Авторизация не выполнена");
      return;
    }

    setSubmitting(true);

    try {
      const response = await joinCallByCode(normalizedCode, token);
      navigate(`/call/${response.call_id}`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to join call", error);
      setErrorMessage("Звонок не найден или недоступен");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="panel">
      <h1>Присоединиться к звонку</h1>
      <p>Введите ID звонка, чтобы подключиться вручную.</p>
      <form className="form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Введите ID звонка</span>
          <input
            type="text"
            placeholder="Например, abc-123"
            value={callCode}
            onChange={(event) => setCallCode(event.target.value)}
            autoComplete="off"
          />
        </label>

        {errorMessage ? (
          <p className="status status-offline" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="form-actions">
          <button
            type="submit"
            className="primary"
            disabled={!callCode.trim() || !token || isSubmitting}
          >
            Подключиться
          </button>
          <button type="button" className="outline" onClick={() => navigate(-1)}>
            Назад
          </button>
        </div>
      </form>
    </div>
  );
};

export default JoinCall;
