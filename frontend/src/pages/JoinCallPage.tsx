import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getCallById } from "../services/calls";
import { extractCallId, isValidCallId } from "../utils/callId";

const JoinCallPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [callCode, setCallCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);

  const isSubmitDisabled = useMemo(
    () => !callCode.trim() || isSubmitting,
    [callCode, isSubmitting],
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    const normalizedCode = callCode.trim();

    if (!normalizedCode) {
      setErrorMessage(t("joinCallPage.errorEmpty"));
      return;
    }

    const extractedCallId = extractCallId(normalizedCode);

    if (!extractedCallId || !isValidCallId(extractedCallId)) {
      setErrorMessage(t("joinCallPage.errorInvalidId"));
      return;
    }

    setSubmitting(true);

    try {
      // eslint-disable-next-line no-console
      console.log("[JoinCall] resolving call", extractedCallId);

      const response = await getCallById(extractedCallId);

      // eslint-disable-next-line no-console
      console.log("[JoinCall] success", response);

      navigate(`/call/${response.call_id}`, { state: { join_url: response.join_url } });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[JoinCall] failed", error);
      const message = error instanceof Error ? error.message : "";
      if (message.includes("status 404")) {
        setErrorMessage(t("joinCallPage.errorNotFound"));
      } else {
        setErrorMessage(t("joinCallPage.errorConnect"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="panel">
      <h1>{t("joinCallPage.title")}</h1>
      <p>{t("joinCallPage.description")}</p>
      <form className="form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>{t("joinCallPage.inputLabel")}</span>
          <input
            type="text"
            placeholder={t("joinCallPage.inputPlaceholder")}
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
          <button type="submit" className="primary" disabled={isSubmitDisabled}>
            {t("joinCallPage.buttonJoin")}
          </button>
          <button type="button" className="outline" onClick={() => navigate(-1)}>
            {t("common.back")}
          </button>
        </div>
      </form>
    </div>
  );
};

export default JoinCallPage;
