import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { fetchIceServers, getWebSocketBaseUrl } from "../services/webrtc";

interface SignalingUser {
  id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
}

type SignalingMessage =
  | { type: "user_joined"; user: SignalingUser }
  | { type: "user_left"; user: SignalingUser }
  | { type: "call_ended"; reason: string }
  | { type: "error"; detail: string }
  | { type: "offer"; payload: RTCSessionDescriptionInit; from_user: SignalingUser }
  | { type: "answer"; payload: RTCSessionDescriptionInit; from_user: SignalingUser }
  | { type: "ice_candidate"; payload: RTCIceCandidateInit; from_user: SignalingUser };

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
  stream?: MediaStream;
}

const PARTICIPANT_COLORS = [
  "linear-gradient(135deg, #1d4ed8, #60a5fa)",
  "linear-gradient(135deg, #0ea5e9, #38bdf8)",
  "linear-gradient(135deg, #a855f7, #7c3aed)",
  "linear-gradient(135deg, #22c55e, #16a34a)",
  "linear-gradient(135deg, #f97316, #fb923c)",
  "linear-gradient(135deg, #e11d48, #fb7185)",
];

const CallPage: React.FC = () => {
  const { id: callId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user } = useAuth();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const joinUrl =
    searchParams.get("join_url") ?? (location.state as LocationState | null)?.join_url ?? "";

  const [iceServers, setIceServers] = useState<RTCIceServer[]>([{ urls: "stun:stun.l.google.com:19302" }]);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [audioTrack, setAudioTrack] = useState<MediaStreamTrack | null>(null);
  const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMicOn, setMicOn] = useState(true);
  const [isCameraOn, setCameraOn] = useState(false);
  const [isRequestingMic, setIsRequestingMic] = useState(false);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isToastVisible, setToastVisible] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [callError, setCallError] = useState<string | null>(null);

  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const websocketRef = useRef<WebSocket | null>(null);
  const homeRedirectTimeoutRef = useRef<number | null>(null);

  const stopMediaStream = useCallback((stream: MediaStream | null) => {
    stream?.getTracks().forEach((track) => track.stop());
  }, []);

  const clearConnections = useCallback(() => {
    peersRef.current.forEach((peer) => peer.close());
    peersRef.current.clear();

    remoteStreamsRef.current.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });
    remoteStreamsRef.current.clear();

    setParticipants((current) => current.filter((participant) => participant.isCurrentUser));
  }, []);

  const attachLocalTracks = useCallback(
    (peer: RTCPeerConnection, stream: MediaStream | null) => {
      if (!stream) {
        return;
      }

      const tracks = stream.getTracks();

      tracks.forEach((track) => {
        const existingSender = peer.getSenders().find((sender) => sender.track?.kind === track.kind);

        if (existingSender) {
          existingSender.replaceTrack(track);
        } else {
          peer.addTrack(track, stream);
        }
      });

      peer.getSenders().forEach((sender) => {
        if (sender.track && !tracks.includes(sender.track)) {
          peer.removeTrack(sender);
        }
      });
    },
    [],
  );

  const scheduleNavigateHome = useCallback(() => {
    if (homeRedirectTimeoutRef.current) {
      clearTimeout(homeRedirectTimeoutRef.current);
    }

    homeRedirectTimeoutRef.current = window.setTimeout(() => navigate("/"), 1500);
  }, [navigate]);

  const handleConnectionError = useCallback(
    (message: string, navigateHome = false, preserveExistingMessage = false) => {
      setCallError((current) => (preserveExistingMessage && current ? current : message));
      clearConnections();

      if (navigateHome) {
        scheduleNavigateHome();
      }
    },
    [clearConnections, scheduleNavigateHome],
  );

  const requestMicrophone = useCallback(async () => {
    setIsRequestingMic(true);
    setMediaError(null);

    if (audioTrack) {
      audioTrack.stop();
    }

    stopMediaStream(mediaStream);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const [track] = stream.getAudioTracks();

      if (!track) {
        throw new Error("No audio track available");
      }

      track.enabled = true;
      setMediaStream(stream);
      setAudioTrack(track);
      setMicOn(true);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to get microphone access", error);
      setMediaError("Нет доступа к микрофону");
      setMicOn(false);
    } finally {
      setIsRequestingMic(false);
    }
  }, [audioTrack, mediaStream, stopMediaStream]);

  const toggleMicrophone = () => {
    if (!audioTrack && !isRequestingMic) {
      requestMicrophone();
      return;
    }

    setMicOn((prev) => !prev);
  };

  const toggleCamera = async () => {
    if (isCameraOn) {
      videoTrack?.stop();
      setVideoTrack(null);
      setCameraOn(false);
      return;
    }

    setIsRequestingCamera(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      const [track] = stream.getVideoTracks();

      if (!track) {
        stopMediaStream(stream);
        return;
      }

      setVideoTrack(track);
      setCameraOn(true);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to get camera access", error);
    } finally {
      setIsRequestingCamera(false);
    }
  };

  useEffect(() => {
    requestMicrophone();
  }, [requestMicrophone]);

  useEffect(() => {
    if (audioTrack) {
      audioTrack.enabled = isMicOn;
    }
  }, [audioTrack, isMicOn]);

  useEffect(() => {
    return () => {
      audioTrack?.stop();
      videoTrack?.stop();
      stopMediaStream(mediaStream);
    };
  }, [audioTrack, mediaStream, stopMediaStream, videoTrack]);

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

  useEffect(() => {
    return () => {
      if (homeRedirectTimeoutRef.current) {
        clearTimeout(homeRedirectTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    fetchIceServers().then(setIceServers);
  }, []);

  useEffect(() => {
    if (!audioTrack && !videoTrack) {
      setLocalStream(null);
      return;
    }

    const tracks = [audioTrack, videoTrack].filter(Boolean) as MediaStreamTrack[];

    if (!tracks.length) {
      setLocalStream(null);
      return;
    }

    setLocalStream(new MediaStream(tracks));
  }, [audioTrack, videoTrack]);

  useEffect(() => {
    if (!localStream) {
      peersRef.current.forEach((peer) => {
        peer.getSenders().forEach((sender) => peer.removeTrack(sender));
      });
      return;
    }

    peersRef.current.forEach((peer) => attachLocalTracks(peer, localStream));
  }, [attachLocalTracks, localStream]);

  const getParticipantName = useCallback(
    (person?: Partial<SignalingUser> & { id?: number | string | null }) => {
      if (!person) {
        return "Участник";
      }

      const parts = [person.first_name, person.last_name].filter(Boolean) as string[];

      if (parts.length) {
        return parts.join(" ");
      }

      if (person.username) {
        return person.username;
      }

      if (person.id !== undefined && person.id !== null) {
        return `Участник ${person.id}`;
      }

      return "Участник";
    },
    [],
  );

  const getParticipantHandle = useCallback((person?: Partial<SignalingUser>) => {
    if (person?.username) {
      return `@${person.username}`;
    }

    return "@participant";
  }, []);

  const getParticipantColor = useCallback((id: string) => {
    const numericId = Number.parseInt(id, 10);

    if (Number.isNaN(numericId)) {
      return PARTICIPANT_COLORS[0];
    }

    const index = Math.abs(numericId) % PARTICIPANT_COLORS.length;
    return PARTICIPANT_COLORS[index];
  }, []);

  const updateParticipant = useCallback(
    (participant: Partial<Participant> & { id: string }) => {
      setParticipants((current) => {
        const existingIndex = current.findIndex((item) => item.id === participant.id);

        if (existingIndex === -1) {
          return [
            ...current,
            {
              id: participant.id,
              name: participant.name ?? getParticipantName({ id: participant.id }),
              handle: participant.handle ?? getParticipantHandle({}),
              color: participant.color ?? getParticipantColor(participant.id),
              isCurrentUser: participant.isCurrentUser,
              isSpeaking: participant.isSpeaking,
              hasVideo: participant.hasVideo,
              stream: participant.stream,
            },
          ];
        }

        const existing = current[existingIndex];
        const updated: Participant = {
          ...existing,
          ...participant,
          name: participant.name ?? existing.name,
          handle: participant.handle ?? existing.handle,
          color: participant.color ?? existing.color,
        };

        const result = [...current];
        result[existingIndex] = updated;
        return result;
      });
    },
    [getParticipantColor, getParticipantHandle, getParticipantName],
  );

  const removeParticipant = useCallback((participantId: string) => {
    setParticipants((current) => current.filter((participant) => participant.id !== participantId));
  }, []);

  const cleanupPeer = useCallback(
    (participantId: string) => {
      const peer = peersRef.current.get(participantId);
      const remoteStream = remoteStreamsRef.current.get(participantId);

      if (peer) {
        peer.close();
        peersRef.current.delete(participantId);
      }

      if (remoteStream) {
        remoteStream.getTracks().forEach((track) => track.stop());
        remoteStreamsRef.current.delete(participantId);
      }

      removeParticipant(participantId);
    },
    [removeParticipant],
  );

  const sendSignalingMessage = useCallback((message: Omit<SignalingMessage, "from_user">) => {
    const socket = websocketRef.current;

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }, []);

  const createPeerConnection = useCallback(
    (participantId: string) => {
      const existing = peersRef.current.get(participantId);

      if (existing) {
        return existing;
      }

      const peer = new RTCPeerConnection({ iceServers });

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignalingMessage({ type: "ice_candidate", payload: event.candidate });
        }
      };

      peer.ontrack = (event) => {
        const [stream] = event.streams;

        if (!stream) {
          return;
        }

        remoteStreamsRef.current.set(participantId, stream);

        updateParticipant({
          id: participantId,
          color: getParticipantColor(participantId),
          hasVideo: stream.getVideoTracks().some((track) => track.enabled),
          isSpeaking: stream.getAudioTracks().some((track) => track.enabled !== false),
          stream,
        });
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "failed") {
          websocketRef.current?.close();
          handleConnectionError("Ошибка WebRTC соединения", true);
        } else if (peer.connectionState === "disconnected") {
          handleConnectionError("WebRTC соединение потеряно", true);
        }
      };

      peer.onnegotiationneeded = async () => {
        try {
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          sendSignalingMessage({ type: "offer", payload: offer });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error("Failed to renegotiate connection", error);
        }
      };

      attachLocalTracks(peer, localStream);
      peersRef.current.set(participantId, peer);

      return peer;
    },
    [attachLocalTracks, getParticipantColor, handleConnectionError, iceServers, localStream, sendSignalingMessage, updateParticipant],
  );

  const handleOffer = useCallback(
    async (fromUser: SignalingUser, payload: RTCSessionDescriptionInit) => {
      const participantId = String(fromUser.id);
      const peer = createPeerConnection(participantId);

      try {
        await peer.setRemoteDescription(new RTCSessionDescription(payload));
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to apply remote offer", error);
        return;
      }
      attachLocalTracks(peer, localStream);

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      sendSignalingMessage({ type: "answer", payload: answer });

      updateParticipant({
        id: participantId,
        name: getParticipantName(fromUser),
        handle: getParticipantHandle(fromUser),
        color: getParticipantColor(participantId),
      });
    },
    [attachLocalTracks, createPeerConnection, getParticipantColor, getParticipantHandle, getParticipantName, localStream, sendSignalingMessage, updateParticipant],
  );

  const handleAnswer = useCallback(
    async (fromUser: SignalingUser, payload: RTCSessionDescriptionInit) => {
      const participantId = String(fromUser.id);
      const peer = peersRef.current.get(participantId);

      if (!peer) {
        return;
      }

      try {
        await peer.setRemoteDescription(new RTCSessionDescription(payload));
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to apply remote answer", error);
      }

      updateParticipant({
        id: participantId,
        name: getParticipantName(fromUser),
        handle: getParticipantHandle(fromUser),
        color: getParticipantColor(participantId),
      });
    },
    [getParticipantColor, getParticipantHandle, getParticipantName, updateParticipant],
  );

  const handleIceCandidate = useCallback(async (fromUser: SignalingUser, payload: RTCIceCandidateInit) => {
    const participantId = String(fromUser.id);
    const peer = peersRef.current.get(participantId);

    if (!peer) {
      return;
    }

    try {
      await peer.addIceCandidate(new RTCIceCandidate(payload));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to add ICE candidate", error);
    }
  }, []);

  const startOfferFlow = useCallback(
    async (remoteUser: SignalingUser) => {
      const participantId = String(remoteUser.id);
      const peer = createPeerConnection(participantId);

      attachLocalTracks(peer, localStream);

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      sendSignalingMessage({ type: "offer", payload: offer });

      updateParticipant({
        id: participantId,
        name: getParticipantName(remoteUser),
        handle: getParticipantHandle(remoteUser),
        color: getParticipantColor(participantId),
      });
    },
    [attachLocalTracks, createPeerConnection, getParticipantColor, getParticipantHandle, getParticipantName, localStream, sendSignalingMessage, updateParticipant],
  );

  const handleSignalingMessage = useCallback(
    async (message: SignalingMessage) => {
      if (message.type === "user_joined") {
        await startOfferFlow(message.user);
        return;
      }

      if (message.type === "user_left") {
        cleanupPeer(String(message.user.id));
        return;
      }

      if (message.type === "call_ended") {
        websocketRef.current?.close();
        handleConnectionError(message.reason, true);
        return;
      }

      if (message.type === "error") {
        setCallError(message.detail);
        return;
      }

      const sender = "from_user" in message ? message.from_user : null;

      if (!sender) {
        return;
      }

      if (message.type === "offer") {
        await handleOffer(sender, message.payload);
      } else if (message.type === "answer") {
        await handleAnswer(sender, message.payload);
      } else if (message.type === "ice_candidate") {
        await handleIceCandidate(sender, message.payload);
      }
    },
    [cleanupPeer, handleAnswer, handleConnectionError, handleIceCandidate, handleOffer, startOfferFlow],
  );

  useEffect(() => {
    if (!user) {
      setCallError("Авторизация не выполнена");
      return;
    }

    if (callError === "Авторизация не выполнена") {
      setCallError(null);
    }

    const participantId = String(user.id);

    updateParticipant({
      id: participantId,
      name: getParticipantName(user),
      handle: getParticipantHandle(user),
      color: getParticipantColor(participantId),
      isCurrentUser: true,
      isSpeaking: !!audioTrack && isMicOn,
      hasVideo: !!videoTrack && isCameraOn,
      stream: localStream ?? undefined,
    });
  }, [audioTrack, callError, getParticipantColor, getParticipantHandle, getParticipantName, isCameraOn, isMicOn, localStream, updateParticipant, user, videoTrack]);

  useEffect(() => {
    if (!callId || !token) {
      return;
    }

    const baseUrl = getWebSocketBaseUrl();

    if (!baseUrl) {
      setCallError("Не удалось определить адрес WebSocket сервера");
      return;
    }

    const url = `${baseUrl}/ws/calls/${callId}`;
    const protocols = token ? [`token.${token}`] : undefined;

    // eslint-disable-next-line no-console
    console.log("[Call] connecting to signaling", { url, hasToken: Boolean(token) });

    const socket = protocols ? new WebSocket(url, protocols) : new WebSocket(url);

    websocketRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as SignalingMessage;
        void handleSignalingMessage(message);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to parse signaling message", error);
      }
    };

    socket.onerror = () => {
      socket.close();
      handleConnectionError("Ошибка соединения с сервером", true);
    };

    socket.onclose = (event) => {
      // eslint-disable-next-line no-console
      console.log("[Call] socket closed", {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });

      websocketRef.current = null;

      if (!event.wasClean) {
        handleConnectionError("Соединение с сервером закрыто", true, true);
        return;
      }

      clearConnections();
    };

    return () => {
      socket.close();
      websocketRef.current = null;

      clearConnections();
    };
  }, [callId, clearConnections, handleConnectionError, handleSignalingMessage, token]);

  const copyLink = async () => {
    if (!joinUrl) {
      return;
    }

    // eslint-disable-next-line no-console
    console.log("[ShareCall] copy from call", joinUrl);

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
    websocketRef.current?.close();
    clearConnections();

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
          <h1 className="call-title">Звонок #{callId ?? "—"}</h1>
          <p className="muted">Видео выключено по умолчанию. Можно включить позже.</p>
        </div>
        <div className="call-link">
          <p className="muted">Ссылка приглашения</p>
          <p className="call-link__value" title={joinUrl || "Нет ссылки"}>
            {joinUrl || "join_url не передан"}
          </p>
        </div>
      </div>

      {callError ? (
        <div className="alert" role="alert">
          <p className="alert__title">{callError}</p>
          <p className="alert__description">Попробуйте переподключиться или вернуться назад.</p>
        </div>
      ) : null}

      <div className="call-grid" role="list">
        {participants.map((participant) => (
          <div
            key={participant.id}
            className={`call-tile ${participant.isSpeaking ? "call-tile--speaking" : ""}`}
            role="listitem"
            aria-label={`${participant.name}${participant.isSpeaking ? " говорит" : ""}`}
          >
            <div className="call-video">
              {participant.hasVideo && participant.stream ? (
                <video
                  className="call-video__feed"
                  aria-label={`Видео ${participant.name}`}
                  autoPlay
                  playsInline
                  muted={participant.isCurrentUser}
                  ref={(element) => {
                    if (element && participant.stream) {
                      if (element.srcObject !== participant.stream) {
                        element.srcObject = participant.stream;
                      }

                      void element.play().catch(() => undefined);
                    }
                  }}
                />
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
            {!participant.isCurrentUser && participant.stream ? (
              <audio
                autoPlay
                playsInline
                ref={(element) => {
                  if (element && participant.stream) {
                    element.srcObject = participant.stream;
                  }
                }}
              />
            ) : null}
          </div>
        ))}
      </div>

      <div className="call-controls" aria-label="Панель управления звонком">
        <button
          type="button"
          className={`call-control ${isMicOn ? "call-control--active" : "call-control--muted"}`}
          onClick={toggleMicrophone}
          disabled={isRequestingMic}
        >
          <span className="call-control__icon" aria-hidden>
            {isMicOn ? "🎤" : "🔇"}
          </span>
          <span>{isMicOn ? "Микрофон включен" : "Микрофон выключен"}</span>
        </button>

        <button
          type="button"
          className={`call-control ${isCameraOn ? "call-control--active" : "call-control--ghost"}`}
          onClick={toggleCamera}
          disabled={isRequestingCamera}
        >
          <span className="call-control__icon" aria-hidden>
            {isCameraOn ? "🎥" : "📷"}
          </span>
          <span>{isCameraOn ? "Камера включена" : "Камера выключена"}</span>
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

      {mediaError ? (
        <div className="alert" role="alert">
          <p className="alert__title">{mediaError}</p>
          <p className="alert__description">Предоставьте доступ, чтобы мы включили микрофон.</p>
          <button type="button" className="outline" onClick={requestMicrophone} disabled={isRequestingMic}>
            Разрешить микрофон
          </button>
        </div>
      ) : null}

      {isToastVisible && <div className="toast">Ссылка скопирована</div>}
    </div>
  );
};

export default CallPage;
