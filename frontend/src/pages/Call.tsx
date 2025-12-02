import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

interface LocationState {
  join_url?: string;
}

interface Participant {
  id: string;
  name: string;
  handle: string;
  color: string;
  isCurrentUser?: boolean;
  isSpeaking?: boolean;
  hasVideo?: boolean;
}

const Call: React.FC = () => {
  const { call_id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const joinUrl =
    searchParams.get("join_url") ?? (location.state as LocationState | null)?.join_url ?? "";

  const [isMicOn, setMicOn] = useState(true);
  const [isToastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    if (isToastVisible) {
      timeout = setTimeout(() => setToastVisible(false), 1200);
    }

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [isToastVisible]);

  const participants: Participant[] = useMemo(
    () => [
      {
        id: "self",
        name: "Вы",
        handle: "@you",
        color: "linear-gradient(135deg, #1d4ed8, #60a5fa)",
        isCurrentUser: true,
        isSpeaking: isMicOn,
        hasVideo: false,
      },
      {
        id: "sofia",
        name: "София",
        handle: "@sofia",
        color: "linear-gradient(135deg, #0ea5e9, #38bdf8)",
        isSpeaking: true,
        hasVideo: false,
      },
      {
        id: "artem",
        name: "Артем",
        handle: "@artem",
        color: "linear-gradient(135deg, #a855f7, #7c3aed)",
        isSpeaking: false,
        hasVideo: false,
      },
      {
        id: "alice",
        name: "Алиса",
        handle: "@alisa",
        color: "linear-gradient(135deg, #22c55e, #16a34a)",
        isSpeaking: false,
        hasVideo: false,
      },
    ],
    [isMicOn],
  );

  const copyLink = async () => {
    if (!joinUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(joinUrl);
      setToastVisible(true);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to copy link", error);
      setToastVisible(true);
    }
  };

  const leaveCall = () => {
    navigate("/");
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase();

  return (
    <div className="panel call-panel">
      <div className="call-header">
        <div>
          <p className="eyebrow">Комната звонка</p>
          <h1 className="call-title">Звонок #{call_id ?? "—"}</h1>
          <p className="muted">Видео выключено по умолчанию. Можно включить позже.</p>
        </div>
        <div className="call-link">
          <p className="muted">Ссылка приглашения</p>
          <p className="call-link__value" title={joinUrl || "Нет ссылки"}>
            {joinUrl || "join_url не передан"}
          </p>
        </div>
      </div>

      <div className="call-grid" role="list">
        {participants.map((participant) => (
          <div
            key={participant.id}
            className={`call-tile ${participant.isSpeaking ? "call-tile--speaking" : ""}`}
            role="listitem"
            aria-label={`${participant.name}${participant.isSpeaking ? " говорит" : ""}`}
          >
            <div className="call-video">
              {participant.hasVideo ? (
                <div className="call-video__feed" aria-label={`Видео ${participant.name}`} />
              ) : (
                <div
                  className="call-avatar"
                  style={{ background: participant.color }}
                  aria-label={`Видео ${participant.name} выключено`}
                >
                  <span>{getInitials(participant.name)}</span>
                </div>
              )}
            </div>

            <div className="call-participant">
              <div>
                <p className="call-participant__name">{participant.name}</p>
                <p className="call-participant__handle">{participant.handle}</p>
              </div>
              {participant.isSpeaking ? <span className="call-speaking">Говорит</span> : null}
            </div>

            {participant.isCurrentUser ? <span className="call-badge">Вы</span> : null}
            {!participant.hasVideo ? <span className="call-video-off">Видео выключено</span> : null}
          </div>
        ))}
      </div>

      <div className="call-controls" aria-label="Панель управления звонком">
        <button
          type="button"
          className={`call-control ${isMicOn ? "call-control--active" : "call-control--muted"}`}
          onClick={() => setMicOn((prev) => !prev)}
        >
          <span className="call-control__icon" aria-hidden>
            {isMicOn ? "🎤" : "🔇"}
          </span>
          <span>{isMicOn ? "Микрофон включен" : "Микрофон выключен"}</span>
        </button>

        <button type="button" className="call-control call-control--disabled" disabled>
          <span className="call-control__icon" aria-hidden>
            🔒
          </span>
          <span>Камера недоступна</span>
        </button>

        <button
          type="button"
          className="call-control call-control--ghost"
          onClick={copyLink}
          disabled={!joinUrl}
        >
          <span className="call-control__icon" aria-hidden>
            🔗
          </span>
          <span>Скопировать ссылку</span>
        </button>

        <button type="button" className="call-control call-control--danger" onClick={leaveCall}>
          <span className="call-control__icon" aria-hidden>
            🚪
          </span>
          <span>Выйти</span>
        </button>
      </div>

      {isToastVisible && <div className="toast">Ссылка скопирована</div>}
    </div>
  );
};

export default Call;
