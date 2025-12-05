import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { createCall } from "../services/calls";

const CreateCallPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthorizing, loginWithTelegram } = useAuth();
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateCall = async () => {
    // eslint-disable-next-line no-console
    console.log("[CreateCall] click", { hasUser: !!user, isAuthorizing });

    if (!user) {
      // eslint-disable-next-line no-console
      console.error("[CreateCall] User not authenticated");
      setError("Необходима авторизация. Пожалуйста, подождите...");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // eslint-disable-next-line no-console
      console.log("[CreateCall] Creating call...");

      const response = await createCall({ title: null, is_video_enabled: false });

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
          ? t("createCallPage.errorCreateWithMessage", { message: err.message })
          : t("createCallPage.errorCreate");

      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="panel">
      <h1>{t("createCallPage.title")}</h1>
      <p>{t("createCallPage.description")}</p>

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
          disabled={!user || isSubmitting || isAuthorizing}
        >
          {isAuthorizing
            ? "Авторизация..."
            : isSubmitting
              ? t("createCallPage.buttonCreating")
              : t("createCallPage.buttonCreate")}
        </button>
        <button type="button" className="outline" onClick={() => navigate("/")} disabled={isSubmitting}>
          {t("common.back")}
        </button>
      </div>
    </div>
  );
};

export default CreateCallPage;
