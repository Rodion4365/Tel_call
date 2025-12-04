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
  | { type: "participants_snapshot"; participants: SignalingUser[] }
  | { type: "user_joined"; user: SignalingUser }
  | { type: "user_left"; user: SignalingUser }
  | { type: "call_ended"; reason: string }
  | { type: "error"; detail: string }
  | { type: "offer"; payload: RTCSessionDescriptionInit; from_user: SignalingUser }
  | { type: "answer"; payload: RTCSessionDescriptionInit; from_user: SignalingUser }
  | { type: "ice_candidate"; payload: RTCIceCandidateInit; from_user: SignalingUser };

type OutgoingSignalingMessage =
  | { type: "offer"; payload: RTCSessionDescriptionInit; to_user_id: number }
  | { type: "answer"; payload: RTCSessionDescriptionInit; to_user_id: number }
  | { type: "ice_candidate"; payload: RTCIceCandidateInit; to_user_id: number };

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
  const [audioTrack, setAudioTrack] = useState<MediaStreamTrack | null>(null);
  const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMicOn, setMicOn] = useState(true);
  const [isCameraOn, setCameraOn] = useState(false);
  const [isRequestingMic, setIsRequestingMic] = useState(false);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [audioUnlockNeeded, setAudioUnlockNeeded] = useState(false);
  const [isToastVisible, setToastVisible] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [callError, setCallError] = useState<string | null>(null);

  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const websocketRef = useRef<WebSocket | null>(null);
  const homeRedirectTimeoutRef = useRef<number | null>(null);
  const userInteractedRef = useRef(false);
  const toggleSoundContextRef = useRef<AudioContext | null>(null);
  const micChangeByUserRef = useRef(false);
  const reconnectionTimersRef = useRef<Map<string, number>>(new Map());
  const handleSignalingMessageRef = useRef<(message: SignalingMessage) => Promise<void>>();
  const handleConnectionErrorRef = useRef<
    ((message: string, navigateHome?: boolean, preserveExistingMessage?: boolean) => void) | undefined
  >();
  const clearConnectionsRef = useRef<(() => void) | undefined>();
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioContainerRef = useRef<HTMLDivElement | null>(null);

  const rebuildLocalStream = useCallback(
    (audio: MediaStreamTrack | null = audioTrack, video: MediaStreamTrack | null = videoTrack) => {
      const tracks = [audio, video].filter(Boolean) as MediaStreamTrack[];

      if (!tracks.length) {
        localStreamRef.current = null;
        setLocalStream(null);
        return null;
      }

      const stream = new MediaStream(tracks);
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    },
    [audioTrack, videoTrack],
  );

  const stopMediaStream = useCallback((stream: MediaStream | null) => {
    stream?.getTracks().forEach((track) => track.stop());
  }, []);

  const attemptPlayAudio = useCallback((audio: HTMLAudioElement) => {
    audio.muted = false;
    audio.volume = Math.max(audio.volume, 0.8);

    const playPromise = audio.play();

    if (playPromise) {
      void playPromise.catch((error) => {
        // eslint-disable-next-line no-console
        console.warn("[Call] failed to autoplay remote audio", error);
        setAudioUnlockNeeded(true);
      });
    }
  }, []);

  const ensureRemoteAudioElement = useCallback(
    (participantId: string) => {
      const container = remoteAudioContainerRef.current;

      if (!container) {
        return null;
      }

      let audioElement = remoteAudioElementsRef.current.get(participantId) ?? null;

      if (!audioElement) {
        audioElement = document.createElement("audio");
        audioElement.autoplay = true;
        audioElement.playsInline = true;
        audioElement.controls = false;
        audioElement.muted = false;
        audioElement.volume = 1;
        audioElement.dataset.participantId = participantId;
        container.appendChild(audioElement);
        remoteAudioElementsRef.current.set(participantId, audioElement);
      }

      return audioElement;
    },
    [],
  );

  const removeRemoteAudioElement = useCallback((participantId: string) => {
    const existing = remoteAudioElementsRef.current.get(participantId);

    if (existing) {
      existing.srcObject = null;
      existing.remove();
      remoteAudioElementsRef.current.delete(participantId);
    }
  }, []);

  const unlockRemoteAudio = useCallback(() => {
    setAudioUnlockNeeded(false);

    remoteAudioElementsRef.current.forEach((audio) => {
      attemptPlayAudio(audio);
    });
  }, [attemptPlayAudio]);

  const clearConnections = useCallback(() => {
    reconnectionTimersRef.current.forEach((timeout) => clearTimeout(timeout));
    reconnectionTimersRef.current.clear();

    peersRef.current.forEach((peer) => peer.close());
    peersRef.current.clear();

    remoteStreamsRef.current.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });
    remoteStreamsRef.current.clear();

    setParticipants((current) => current.filter((participant) => participant.isCurrentUser));
  }, []);

  const setPreferredAudioCodec = useCallback((peer: RTCPeerConnection, sender: RTCRtpSender) => {
    const transceiver = peer.getTransceivers().find((item) => item.sender === sender);
    const audioCapabilities = RTCRtpSender.getCapabilities("audio");

    if (!audioCapabilities || !audioCapabilities.codecs.length) {
      return;
    }

    const opusCodecs = audioCapabilities.codecs.filter((codec) =>
      codec.mimeType.toLowerCase().includes("opus"),
    );

    if (!transceiver || !transceiver.setCodecPreferences || !opusCodecs.length) {
      return;
    }

    const otherCodecs = audioCapabilities.codecs.filter((codec) => !opusCodecs.includes(codec));
    transceiver.setCodecPreferences([...opusCodecs, ...otherCodecs]);
  }, []);

  const logPeerAudioDebug = useCallback(
    (peer: RTCPeerConnection, participantId: string, context: string) => {
      const audioReceivers = peer
        .getReceivers()
        .filter((receiver) => receiver.track?.kind === "audio")
        .map((receiver) => ({
          trackId: receiver.track?.id,
          readyState: receiver.track?.readyState,
          muted: receiver.track?.muted,
          enabled: receiver.track?.enabled,
        }));

      const audioTransceivers = peer
        .getTransceivers()
        .filter((transceiver) => transceiver.receiver.track?.kind === "audio")
        .map((transceiver) => ({
          mid: transceiver.mid,
          direction: transceiver.direction,
          currentDirection: transceiver.currentDirection,
          receiverTrackId: transceiver.receiver.track?.id,
          senderTrackId: transceiver.sender.track?.id,
          receiverState: transceiver.receiver.track?.readyState,
        }));

      const remoteStream = remoteStreamsRef.current.get(participantId);
      const remoteAudio = remoteAudioElementsRef.current.get(participantId);

      const remoteAudioTracks = remoteStream
        ? remoteStream.getAudioTracks().map((track) => ({
            id: track.id,
            label: track.label,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
          }))
        : [];

      // eslint-disable-next-line no-console
      console.log("[RTC][AudioDebug] peer audio status", {
        participantId,
        context,
        signalingState: peer.signalingState,
        connectionState: peer.connectionState,
        iceConnectionState: peer.iceConnectionState,
        remoteDescription: peer.remoteDescription?.type,
        audioReceivers,
        audioTransceivers,
        remoteAudioTracks,
        remoteAudioElement: remoteAudio
          ? {
              present: true,
              hasSrcObject: Boolean(remoteAudio.srcObject),
              paused: remoteAudio.paused,
              readyState: remoteAudio.readyState,
              volume: remoteAudio.volume,
            }
          : { present: false },
      });
    },
    [],
  );

  const attachLocalTracks = useCallback(
    (peer: RTCPeerConnection, stream: MediaStream | null) => {
      if (!stream) {
        return;
      }

      const tracks = stream.getTracks();

      tracks.forEach((track) => {
        // eslint-disable-next-line no-console
        console.log("[RTC] attaching local track", {
          kind: track.kind,
          id: track.id,
          enabled: track.enabled,
          peerConnectionId: peer.connectionState,
        });
        const existingSender = peer.getSenders().find((sender) => sender.track?.kind === track.kind);

        if (existingSender) {
          existingSender.replaceTrack(track);
          if (track.kind === "audio") {
            setPreferredAudioCodec(peer, existingSender);
          }
        } else {
          const sender = peer.addTrack(track, stream);

          if (track.kind === "audio") {
            setPreferredAudioCodec(peer, sender);
          }
        }
      });

      peer.getSenders().forEach((sender) => {
        if (sender.track && !tracks.includes(sender.track)) {
          peer.removeTrack(sender);
        }
      });
    },
    [setPreferredAudioCodec],
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

  const ensureLocalAudioStream = useCallback(async (): Promise<MediaStream | null> => {
    // если уже есть стрим с аудио — просто возвращаем
    if (localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0) {
      return localStreamRef.current;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const [track] = stream.getAudioTracks();

      if (!track) {
        throw new Error("No audio track");
      }

      // eslint-disable-next-line no-console
      console.log("[Media] ensureLocalAudioStream acquired track", {
        id: track.id,
        label: track.label,
      });

      setMediaError(null);
      setAudioTrack(track);
      localStreamRef.current = stream;
      setLocalStream(stream);
      setMicOn(true);

      return stream;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[Media] ensureLocalAudioStream failed", error);
      setMediaError("Нет доступа к микрофону");
      return null;
    }
  }, [setAudioTrack, setLocalStream, setMediaError, setMicOn]);

  const requestMicrophone = useCallback(
    async (userInitiated = false) => {
      micChangeByUserRef.current = userInitiated;
      setIsRequestingMic(true);
      setMediaError(null);

      if (audioTrack) {
        audioTrack.stop();
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const [track] = stream.getAudioTracks();

        if (!track) {
          throw new Error("No audio track available");
        }

        track.enabled = true;
        // eslint-disable-next-line no-console
        console.log("[Media] acquired microphone track", {
          id: track.id,
          label: track.label,
          settings: track.getSettings ? track.getSettings() : undefined,
          userInitiated,
        });

        setAudioTrack(track);
        const newStream = rebuildLocalStream(track, videoTrack);
        setMicOn(true);

        // 👉 сразу перевешиваем треки на все активные peer'ы
        if (newStream) {
          peersRef.current.forEach((peer) => {
            attachLocalTracks(peer, newStream);
          });
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to get microphone access", error);
        setMediaError("Нет доступа к микрофону");
        setAudioTrack(null);
        rebuildLocalStream(null, videoTrack);
        setMicOn(false);
      } finally {
        setIsRequestingMic(false);
      }
    },
    [audioTrack, rebuildLocalStream, videoTrack, attachLocalTracks],
  );

  const toggleMicrophone = () => {
    // пользователь кликнул кнопку
    micChangeByUserRef.current = true;

    const track = audioTrack;

    // Если трека нет или он уже закончился — пересоздаём микрофон и перевешиваем на все peer'ы
    if (!track || track.readyState === "ended") {
      // eslint-disable-next-line no-console
      console.log("[Media] toggle microphone: no valid track, reacquiring...");
      void (async () => {
        await requestMicrophone(true);
        const stream = localStreamRef.current;

        if (stream) {
          peersRef.current.forEach((peer) => {
            attachLocalTracks(peer, stream);
          });
        }
      })();

      return;
    }

    // Нормальный случай: живой трек есть — просто включаем/выключаем
    setMicOn((prev) => {
      const next = !prev;

      // сразу применяем к треку, чтобы не ждать useEffect
      track.enabled = next;

      // eslint-disable-next-line no-console
      console.log("[Media] toggle microphone", {
        nextState: next,
        trackId: track.id,
        readyState: track.readyState,
      });

      return next;
    });
  };

  const toggleCamera = async () => {
    if (isCameraOn) {
      // eslint-disable-next-line no-console
      console.log("[Media] turning camera off", { trackId: videoTrack?.id });
      videoTrack?.stop();
      setVideoTrack(null);
      setCameraOn(false);
      rebuildLocalStream(audioTrack, null);
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

      // eslint-disable-next-line no-console
      console.log("[Media] acquired camera track", {
        id: track.id,
        label: track.label,
        settings: track.getSettings ? track.getSettings() : undefined,
      });
      setVideoTrack(track);
      setCameraOn(true);
      rebuildLocalStream(audioTrack, track);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to get camera access", error);
    } finally {
      setIsRequestingCamera(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const [track] = stream.getAudioTracks();

      if (!track) {
        throw new Error("No audio track");
      }

      // eslint-disable-next-line no-console
      console.log("[Media] initial microphone ready", {
        id: track.id,
        label: track.label,
        settings: track.getSettings ? track.getSettings() : undefined,
      });
      setAudioTrack(track);
      localStreamRef.current = stream;
      setLocalStream(stream);
      setMicOn(true);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[Call] failed to get local audio", err);
        setMediaError("Нет доступа к микрофону");
      }
    })();
  }, []);

  useEffect(() => {
    const handleUserInteraction = () => {
      userInteractedRef.current = true;
      unlockRemoteAudio();
    };

    document.addEventListener("click", handleUserInteraction, { once: true });
    document.addEventListener("touchstart", handleUserInteraction, { once: true });

    return () => {
      document.removeEventListener("click", handleUserInteraction);
      document.removeEventListener("touchstart", handleUserInteraction);
    };
  }, [unlockRemoteAudio]);

  const playToggleSound = useCallback(() => {
    try {
      if (!toggleSoundContextRef.current) {
        toggleSoundContextRef.current = new AudioContext();
      }

      const context = toggleSoundContextRef.current;

      void context.resume();

      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gain.gain.value = 0.05;

      oscillator.connect(gain);
      gain.connect(context.destination);

      const now = context.currentTime;
      const duration = 0.15;
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("Failed to play toggle sound", error);
    }
  }, []);

  useEffect(() => {
    if (!micChangeByUserRef.current) {
      return;
    }

    micChangeByUserRef.current = false;
    playToggleSound();
  }, [isMicOn, playToggleSound]);

  useEffect(() => {
    const remoteAudioElements = remoteAudioElementsRef.current;

    return () => {
      audioTrack?.stop();
      videoTrack?.stop();
      stopMediaStream(localStreamRef.current);

      remoteAudioElements.forEach((audio) => {
        audio.srcObject = null;
        audio.remove();
      });
      remoteAudioElements.clear();

      if (toggleSoundContextRef.current?.state !== "closed") {
        void toggleSoundContextRef.current?.close();
      }
      toggleSoundContextRef.current = null;
    };
  }, [audioTrack, stopMediaStream, videoTrack]);

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
    rebuildLocalStream();
  }, [rebuildLocalStream]);

  useEffect(() => {
    const participantIds = new Set<string>();

    participants.forEach((participant) => {
      if (participant.isCurrentUser || !participant.stream) {
        removeRemoteAudioElement(participant.id);
        return;
      }

      participantIds.add(participant.id);
      const audioElement = ensureRemoteAudioElement(participant.id);

      if (!audioElement) {
        return;
      }

      if (audioElement.srcObject !== participant.stream) {
        audioElement.srcObject = participant.stream;
      }

      attemptPlayAudio(audioElement);
    });

    remoteAudioElementsRef.current.forEach((_, participantId) => {
      if (!participantIds.has(participantId)) {
        removeRemoteAudioElement(participantId);
      }
    });
  }, [attemptPlayAudio, ensureRemoteAudioElement, participants, removeRemoteAudioElement]);

  useEffect(() => {
    if (!localStream) {
      peersRef.current.forEach((peer) => {
        peer.getSenders().forEach((sender) => peer.removeTrack(sender));
      });
      return;
    }

    const stream = localStreamRef.current ?? localStream;

    peersRef.current.forEach((peer) => attachLocalTracks(peer, stream));
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
      const timeout = reconnectionTimersRef.current.get(participantId);

      if (timeout) {
        clearTimeout(timeout);
        reconnectionTimersRef.current.delete(participantId);
      }

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

  const sendSignalingMessage = useCallback((message: OutgoingSignalingMessage) => {
    const socket = websocketRef.current;

    if (socket && socket.readyState === WebSocket.OPEN) {
      // eslint-disable-next-line no-console
      console.log("[WS] sending signaling message", {
        type: message.type,
        to_user_id: "to_user_id" in message ? message.to_user_id : undefined,
      });
      socket.send(JSON.stringify(message));
      return;
    }

    // eslint-disable-next-line no-console
    console.warn("[WS] unable to send signaling message; socket not open", {
      readyState: socket?.readyState,
      type: message.type,
    });
  }, []);

  const createPeerConnection = useCallback(
    (participantId: string, stream?: MediaStream) => {
      const existing = peersRef.current.get(participantId);

      if (existing) {
        if (stream) {
          attachLocalTracks(existing, stream);
        }

        return existing;
      }

      const peer = new RTCPeerConnection({ iceServers });
      const targetUserId = Number.parseInt(participantId, 10);

      // eslint-disable-next-line no-console
      console.log("[RTC] creating peer connection", {
        participantId,
        targetUserId,
        iceServers,
      });

      ensureRemoteAudioElement(participantId);

      peer.onicecandidate = (event) => {
        if (event.candidate && !Number.isNaN(targetUserId)) {
          // eslint-disable-next-line no-console
          console.log("[ICE] sending candidate", event.candidate);
          sendSignalingMessage({ type: "ice_candidate", payload: event.candidate, to_user_id: targetUserId });
        }
      };

      peer.ontrack = (event) => {
        // eslint-disable-next-line no-console
        console.log("[RTC] received remote track", {
          participantId,
          trackId: event.track.id,
          kind: event.track.kind,
          streams: event.streams.map((stream) => ({ id: stream.id, active: stream.active })),
        });

        const existingStream = remoteStreamsRef.current.get(participantId);
        const stream = existingStream ?? event.streams[0] ?? new MediaStream();

        if (!stream.getTracks().includes(event.track)) {
          stream.addTrack(event.track);
        }

        remoteStreamsRef.current.set(participantId, stream);

        const audioElement = ensureRemoteAudioElement(participantId);

        if (audioElement && audioElement.srcObject !== stream) {
          audioElement.srcObject = stream;
        }

        if (audioElement) {
          attemptPlayAudio(audioElement);
        }

        updateParticipant({
          id: participantId,
          color: getParticipantColor(participantId),
          hasVideo: stream.getVideoTracks().some((track) => track.enabled),
          stream,
        });
      };

      const scheduleRecovery = () => {
        if (Number.isNaN(targetUserId)) {
          return;
        }

        const existingTimeout = reconnectionTimersRef.current.get(participantId);

        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        const timeout = window.setTimeout(async () => {
          try {
            const offer = await peer.createOffer({ iceRestart: true });
            await peer.setLocalDescription(offer);
            sendSignalingMessage({ type: "offer", payload: offer, to_user_id: targetUserId });
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error("Failed to restart ICE", error);
          }
        }, 1200);

        reconnectionTimersRef.current.set(participantId, timeout);
      };

      peer.oniceconnectionstatechange = () => {
        // eslint-disable-next-line no-console
        console.log("[ICE] state changed", {
          participantId,
          state: peer.iceConnectionState,
        });
        if (peer.iceConnectionState === "connected" || peer.iceConnectionState === "completed") {
          const timeout = reconnectionTimersRef.current.get(participantId);

          if (timeout) {
            clearTimeout(timeout);
            reconnectionTimersRef.current.delete(participantId);
          }
        } else if (peer.iceConnectionState === "failed" || peer.iceConnectionState === "disconnected") {
          scheduleRecovery();
        } else if (peer.iceConnectionState === "closed") {
          cleanupPeer(participantId);
        }
      };

      peer.onnegotiationneeded = async () => {
        try {
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);

          if (!Number.isNaN(targetUserId)) {
            sendSignalingMessage({ type: "offer", payload: offer, to_user_id: targetUserId });
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error("Failed to renegotiate connection", error);
        }
      };

      if (stream) {
        attachLocalTracks(peer, stream);
      }

      peersRef.current.set(participantId, peer);

      return peer;
    },
    [
      attachLocalTracks,
      attemptPlayAudio,
      cleanupPeer,
      ensureRemoteAudioElement,
      getParticipantColor,
      iceServers,
      sendSignalingMessage,
      updateParticipant,
    ],
  );

  const handleOffer = useCallback(
    async (fromUser: SignalingUser, payload: RTCSessionDescriptionInit) => {
      const participantId = String(fromUser.id);
      let stream = localStreamRef.current;

      if (!stream || stream.getTracks().length === 0) {
        stream = await ensureLocalAudioStream();
      }

      if (!stream) {
        return;
      }

      const peer = createPeerConnection(participantId);
      attachLocalTracks(peer, stream);
      const targetUserId = Number.parseInt(participantId, 10);

      try {
        await peer.setRemoteDescription(new RTCSessionDescription(payload));
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to apply remote offer", error);
        return;
      }

      logPeerAudioDebug(peer, participantId, "after-set-remote-offer+local-audio");
      window.setTimeout(
        () => logPeerAudioDebug(peer, participantId, "delayed-offer-audio-check"),
        2000,
      );

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      if (!Number.isNaN(targetUserId)) {
        sendSignalingMessage({ type: "answer", payload: answer, to_user_id: targetUserId });
      }

      updateParticipant({
        id: participantId,
        name: getParticipantName(fromUser),
        handle: getParticipantHandle(fromUser),
        color: getParticipantColor(participantId),
      });
    },
    [
      attachLocalTracks,
      createPeerConnection,
      ensureLocalAudioStream,
      getParticipantColor,
      getParticipantHandle,
      getParticipantName,
      logPeerAudioDebug,
      sendSignalingMessage,
      updateParticipant,
    ],
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

      logPeerAudioDebug(peer, participantId, "after-set-remote-answer");
      window.setTimeout(() => logPeerAudioDebug(peer, participantId, "delayed-answer-audio-check"), 2000);

      updateParticipant({
        id: participantId,
        name: getParticipantName(fromUser),
        handle: getParticipantHandle(fromUser),
        color: getParticipantColor(participantId),
      });
    },
    [getParticipantColor, getParticipantHandle, getParticipantName, logPeerAudioDebug, updateParticipant],
  );

  const handleIceCandidate = useCallback(async (fromUser: SignalingUser, payload: RTCIceCandidateInit) => {
    const participantId = String(fromUser.id);
    const peer = peersRef.current.get(participantId);

    if (!peer) {
      return;
    }

    try {
      // eslint-disable-next-line no-console
      console.log("[ICE] received candidate", payload);
      await peer.addIceCandidate(new RTCIceCandidate(payload));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to add ICE candidate", error);
    }
  }, []);

  const startOfferFlow = useCallback(
    async (remoteUser: SignalingUser) => {
      const participantId = String(remoteUser.id);
      let stream = localStreamRef.current;

      if (!stream || stream.getAudioTracks().length === 0) {
        stream = await ensureLocalAudioStream();
      }

      if (!stream || stream.getAudioTracks().length === 0) {
        // eslint-disable-next-line no-console
        console.warn("[Media] Unable to start offer without local audio stream");
        return;
      }

      const peer = createPeerConnection(participantId, stream);

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      sendSignalingMessage({ type: "offer", payload: offer, to_user_id: remoteUser.id });

      updateParticipant({
        id: participantId,
        name: getParticipantName(remoteUser),
        handle: getParticipantHandle(remoteUser),
        color: getParticipantColor(participantId),
      });
    },
  [
    createPeerConnection,
    ensureLocalAudioStream,
    getParticipantColor,
    getParticipantHandle,
    getParticipantName,
    sendSignalingMessage,
    updateParticipant,
  ],
  );

  const shouldInitiateOffer = useCallback(
    (remoteUser: SignalingUser) => (user?.id ? user.id < remoteUser.id : false),
    [user?.id],
  );

  const ensureParticipant = useCallback(
    (remoteUser: SignalingUser) => {
      const participantId = String(remoteUser.id);

      updateParticipant({
        id: participantId,
        name: getParticipantName(remoteUser),
        handle: getParticipantHandle(remoteUser),
        color: getParticipantColor(participantId),
      });
    },
    [getParticipantColor, getParticipantHandle, getParticipantName, updateParticipant],
  );

  const connectToParticipantIfNeeded = useCallback(
    async (remoteUser: SignalingUser) => {
      ensureParticipant(remoteUser);

      const participantId = String(remoteUser.id);

      if (peersRef.current.has(participantId)) {
        return;
      }

      if (!shouldInitiateOffer(remoteUser)) {
        return;
      }

      await startOfferFlow(remoteUser);
    },
    [ensureParticipant, shouldInitiateOffer, startOfferFlow],
  );

  const handleSignalingMessage = useCallback(
    async (message: SignalingMessage) => {
      // eslint-disable-next-line no-console
      console.log("[Signaling] received", message.type, message);

      if (message.type === "participants_snapshot") {
        await Promise.all(message.participants.map((participant) => connectToParticipantIfNeeded(participant)));
        return;
      }

      if (message.type === "user_joined") {
        await connectToParticipantIfNeeded(message.user);
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
    [cleanupPeer, connectToParticipantIfNeeded, handleAnswer, handleConnectionError, handleIceCandidate, handleOffer],
  );

  useEffect(() => {
    handleSignalingMessageRef.current = handleSignalingMessage;
    handleConnectionErrorRef.current = handleConnectionError;
    clearConnectionsRef.current = clearConnections;
  });

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
      stream: localStreamRef.current ?? localStream ?? undefined,
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

    socket.onopen = () => {
      // eslint-disable-next-line no-console
      console.log("[WS] signaling socket opened", { url, protocols });
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as SignalingMessage;
        // eslint-disable-next-line no-console
        console.log("[WS] received signaling message", message);
        void handleSignalingMessageRef.current?.(message);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to parse signaling message", error);
      }
    };

    socket.onerror = () => {
      socket.close();
      handleConnectionErrorRef.current?.("Ошибка соединения с сервером", true);
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
        handleConnectionErrorRef.current?.("Соединение с сервером закрыто", true, true);
        return;
      }

      clearConnectionsRef.current?.();
    };

    return () => {
      socket.close();
      websocketRef.current = null;

      clearConnectionsRef.current?.();
    };
  }, [callId, token]);

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
      <div
        ref={remoteAudioContainerRef}
        aria-hidden
        style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
      />

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
          <button
            type="button"
            className="outline"
            onClick={() => requestMicrophone(true)}
            disabled={isRequestingMic}
          >
            Разрешить микрофон
          </button>
        </div>
      ) : null}

      {audioUnlockNeeded ? (
        <div className="alert" role="alert">
          <p className="alert__title">Нажмите, чтобы включить звук</p>
          <p className="alert__description">Мы не смогли автоматически включить звук удалённых участников.</p>
          <button type="button" className="outline" onClick={unlockRemoteAudio}>
            Включить звук
          </button>
        </div>
      ) : null}

      {isToastVisible && <div className="toast">Ссылка скопирована</div>}
    </div>
  );
};

export default CallPage;
