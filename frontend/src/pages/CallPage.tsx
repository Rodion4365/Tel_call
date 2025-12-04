import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { fetchIceServers, getWebSocketBaseUrl } from "../services/webrtc";
import { logger } from "../utils/logger";

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
  hasRemoteAudio?: boolean;
  iceConnectionState?: RTCPeerConnectionState | null;
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

const hasActiveAudioTrack = (stream: MediaStream | null) =>
  stream?.getAudioTracks().some((track) => track.readyState === "live") ?? false;

const CallPage: React.FC = () => {
  const { id: callId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user } = useAuth();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const joinUrl =
    searchParams.get("join_url") ?? (location.state as LocationState | null)?.join_url ?? "";

  const [iceServers, setIceServers] = useState<RTCIceServer[]>([{ urls: "stun:stun.l.google.com:19302" }]);
  const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setCameraOn] = useState(false);
  const [isRequestingMic, setIsRequestingMic] = useState(false);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [audioUnlockNeeded, setAudioUnlockNeeded] = useState(false);
  const [isToastVisible, setToastVisible] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [callError, setCallError] = useState<string | null>(null);
  const [callConnected, setCallConnected] = useState(false);

  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
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
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const stopMediaStream = useCallback((stream: MediaStream | null) => {
    stream?.getTracks().forEach((track) => track.stop());
  }, []);

  const stopLocalMedia = useCallback(() => {
    stopMediaStream(localStreamRef.current);
    localStreamRef.current = null;
    setLocalStream(null);
    setVideoTrack(null);
  }, [stopMediaStream]);

  const attemptPlayAudio = useCallback((audio: HTMLAudioElement) => {
    audio.muted = false;
    audio.volume = Math.max(audio.volume, 0.8);

    const playPromise = audio.play();

    if (playPromise) {
      void playPromise.catch((error) => {
        logger.warn("[Call] failed to autoplay remote audio", error);
        setAudioUnlockNeeded(true);
      });
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

    remoteAudioElementsRef.current.forEach((audio) => {
      audio.srcObject = null;
      audio.remove();
    });
    remoteAudioElementsRef.current.clear();

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

      logger.log("[RTC][AudioDebug] peer audio status", {
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
        logger.log("[RTC] attaching local track", {
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
    if (localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0) {
      return localStreamRef.current;
    }

    setIsRequestingMic(true);
    setMediaError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      setLocalStream(stream);
      stream.getAudioTracks().forEach((t) => {
        t.enabled = true;
      });
      setIsMicOn(true);
      peersRef.current.forEach((peer) => {
        attachLocalTracks(peer, stream);
      });
      return stream;
    } catch (err) {
      logger.error("[Call] failed to get local audio", err);
      setMediaError("Нет доступа к микрофону");
      setIsMicOn(false);
      return null;
    } finally {
      setIsRequestingMic(false);
    }
  }, [attachLocalTracks]);

  const toggleMicrophone = async () => {
    micChangeByUserRef.current = true;

    if (!localStreamRef.current || localStreamRef.current.getAudioTracks().length === 0) {
      const stream = await ensureLocalAudioStream();
      if (!stream) {
        return;
      }
    }

    const stream = localStreamRef.current!;
    const audioTracks = stream.getAudioTracks();

    if (audioTracks.length === 0) {
      logger.warn("[Call] no audio tracks in local stream");
      return;
    }

    const next = !isMicOn;
    audioTracks.forEach((track) => {
      track.enabled = next;
    });

    setIsMicOn(next);
  };

  const toggleCamera = async () => {
    if (isCameraOn) {
      logger.log("[Media] turning camera off", { trackId: videoTrack?.id });
      const currentStream = localStreamRef.current;

      if (videoTrack) {
        videoTrack.stop();
      }

      if (currentStream) {
        currentStream.getVideoTracks().forEach((track) => currentStream.removeTrack(track));
      }

      const audioTracks = currentStream?.getAudioTracks() ?? [];
      const updatedStream = audioTracks.length ? new MediaStream(audioTracks) : null;

      localStreamRef.current = updatedStream;
      setLocalStream(updatedStream);
      setVideoTrack(null);
      setCameraOn(false);

      peersRef.current.forEach((peer) => {
        attachLocalTracks(peer, updatedStream);
      });
      return;
    }

    setIsRequestingCamera(true);

    try {
      await ensureLocalAudioStream();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      const [track] = stream.getVideoTracks();

      if (!track) {
        stopMediaStream(stream);
        return;
      }

      logger.log("[Media] acquired camera track", {
        id: track.id,
        label: track.label,
        settings: track.getSettings ? track.getSettings() : undefined,
      });

      const baseTracks = localStreamRef.current?.getTracks() ?? [];
      const mergedStream = new MediaStream([...baseTracks, track]);

      localStreamRef.current = mergedStream;
      setLocalStream(mergedStream);
      setVideoTrack(track);
      setCameraOn(true);

      peersRef.current.forEach((peer) => {
        attachLocalTracks(peer, mergedStream);
      });
    } catch (error) {
      logger.error("Failed to get camera access", error);
    } finally {
      setIsRequestingCamera(false);
    }
  };

  useEffect(() => {
    if (!callConnected) return;

    void ensureLocalAudioStream();
  }, [callConnected, ensureLocalAudioStream]);

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
      logger.warn("Failed to play toggle sound", error);
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
      stopLocalMedia();

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
  }, [stopLocalMedia]);

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
              hasRemoteAudio: participant.hasRemoteAudio ?? Boolean(participant.isCurrentUser),
              iceConnectionState: participant.iceConnectionState,
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
          hasRemoteAudio:
            participant.hasRemoteAudio ?? existing.hasRemoteAudio ?? existing.isCurrentUser ?? false,
          iceConnectionState: participant.iceConnectionState ?? existing.iceConnectionState,
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

      const audioElement = remoteAudioElementsRef.current.get(participantId);

      if (audioElement) {
        audioElement.srcObject = null;
        remoteAudioElementsRef.current.delete(participantId);
      }

      removeParticipant(participantId);
    },
    [removeParticipant],
  );

  const sendSignalingMessage = useCallback((message: OutgoingSignalingMessage) => {
    const socket = websocketRef.current;

    if (socket && socket.readyState === WebSocket.OPEN) {
      logger.log("[WS] sending signaling message", {
        type: message.type,
        to_user_id: "to_user_id" in message ? message.to_user_id : undefined,
      });
      socket.send(JSON.stringify(message));
      return;
    }

    logger.warn("[WS] unable to send signaling message; socket not open", {
      readyState: socket?.readyState,
      type: message.type,
    });
  }, []);

  const createPeerConnection = useCallback(
    async (participantId: string) => {
      let stream = localStreamRef.current;

      if (!hasActiveAudioTrack(stream)) {
        stream = await ensureLocalAudioStream();
      }

      if (!stream || !hasActiveAudioTrack(stream)) {
        logger.warn("[RTC] skip creating peer without active audio", { participantId });
        return null;
      }

      const existing = peersRef.current.get(participantId);

      if (existing) {
        attachLocalTracks(existing, stream);
        updateParticipant({ id: participantId, iceConnectionState: existing.iceConnectionState });

        return existing;
      }

      const peer = new RTCPeerConnection({ iceServers });
      const targetUserId = Number.parseInt(participantId, 10);

      logger.log("[RTC] creating peer connection", {
        participantId,
        targetUserId,
        iceServers,
      });

      peer.onicecandidate = (event) => {
        if (event.candidate && !Number.isNaN(targetUserId)) {
          logger.log("[ICE] sending candidate", event.candidate);
          sendSignalingMessage({ type: "ice_candidate", payload: event.candidate, to_user_id: targetUserId });
        }
      };

      peer.ontrack = (event) => {
        logger.log("[RTC] received remote track", {
          participantId,
          trackId: event.track.id,
          kind: event.track.kind,
          streams: event.streams.map((incoming) => ({ id: incoming.id, active: incoming.active })),
        });

        const existingStream = remoteStreamsRef.current.get(participantId);
        const remoteStream = existingStream ?? event.streams[0] ?? new MediaStream();

        if (!remoteStream.getTracks().includes(event.track)) {
          remoteStream.addTrack(event.track);
        }

        remoteStreamsRef.current.set(participantId, remoteStream);

        updateParticipant({
          id: participantId,
          color: getParticipantColor(participantId),
          hasVideo: remoteStream.getVideoTracks().some((track) => track.enabled),
          hasRemoteAudio: event.track.kind === "audio" || remoteStream.getAudioTracks().length > 0,
          stream: remoteStream,
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
            logger.error("Failed to restart ICE", error);
          }
        }, 1200);

        reconnectionTimersRef.current.set(participantId, timeout);
      };

      peer.oniceconnectionstatechange = () => {
        logger.log("[ICE] state changed", {
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

        updateParticipant({ id: participantId, iceConnectionState: peer.iceConnectionState });
      };

      attachLocalTracks(peer, stream);

      peersRef.current.set(participantId, peer);

      updateParticipant({ id: participantId, iceConnectionState: peer.iceConnectionState });

      return peer;
    },
    [
      attachLocalTracks,
      cleanupPeer,
      ensureLocalAudioStream,
      getParticipantColor,
      iceServers,
      sendSignalingMessage,
      updateParticipant,
    ],
  );

  const handleOffer = useCallback(
    async (fromUser: SignalingUser, payload: RTCSessionDescriptionInit) => {
      const participantId = String(fromUser.id);
      const peer = await createPeerConnection(participantId);
      const targetUserId = Number.parseInt(participantId, 10);

      if (!peer) {
        return;
      }

      try {
        await peer.setRemoteDescription(new RTCSessionDescription(payload));
      } catch (error) {
        logger.error("Failed to apply remote offer", error);
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
      createPeerConnection,
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
        logger.error("Failed to apply remote answer", error);
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
      logger.log("[ICE] received candidate", payload);
      await peer.addIceCandidate(new RTCIceCandidate(payload));
    } catch (error) {
      logger.error("Failed to add ICE candidate", error);
    }
  }, []);

  const startOfferFlow = useCallback(
    async (remoteUser: SignalingUser) => {
      const participantId = String(remoteUser.id);
      const peer = await createPeerConnection(participantId);

      if (!peer) {
        return;
      }

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
      logger.log("[Signaling] received", message.type, message);

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
      isSpeaking: isMicOn && hasActiveAudioTrack(localStreamRef.current),
      hasVideo: !!videoTrack && isCameraOn,
      stream: localStreamRef.current ?? localStream ?? undefined,
    });
  }, [
    callError,
    getParticipantColor,
    getParticipantHandle,
    getParticipantName,
    isCameraOn,
    isMicOn,
    localStream,
    updateParticipant,
    user,
    videoTrack,
  ]);

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

    logger.log("[Call] connecting to signaling", { url, hasToken: Boolean(token) });

    const socket = protocols ? new WebSocket(url, protocols) : new WebSocket(url);

    websocketRef.current = socket;

    socket.onopen = () => {
      logger.log("[WS] signaling socket opened", { url, protocols });
      setCallConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as SignalingMessage;
        logger.log("[WS] received signaling message", message);
        void handleSignalingMessageRef.current?.(message);
      } catch (error) {
        logger.error("Failed to parse signaling message", error);
      }
    };

    socket.onerror = () => {
      socket.close();
      handleConnectionErrorRef.current?.("Ошибка соединения с сервером", true);
    };

    socket.onclose = (event) => {
      logger.log("[Call] socket closed", {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });

      websocketRef.current = null;
      setCallConnected(false);

      if (!event.wasClean) {
        handleConnectionErrorRef.current?.("Соединение с сервером закрыто", true, true);
        return;
      }

      clearConnectionsRef.current?.();
    };

    return () => {
      socket.close();
      websocketRef.current = null;
      setCallConnected(false);

      clearConnectionsRef.current?.();
    };
  }, [callId, token]);

  const copyLink = async () => {
    if (!joinUrl) {
      return;
    }

    logger.log("[ShareCall] copy from call", joinUrl);

    try {
      await navigator.clipboard.writeText(joinUrl);
      setToastVisible(true);
    } catch (error) {
      logger.error("Failed to copy link", error);
      setToastVisible(true);
    }
  };

  const leaveCall = () => {
    websocketRef.current?.close();
    clearConnections();
    stopLocalMedia();

    navigate("/");
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase();

  const isMicrophoneActive = isMicOn && hasActiveAudioTrack(localStreamRef.current);

  return (
    <div className="panel call-panel">
      <div className="call-header">
        <div>
          <p className="eyebrow">Комната звонка</p>
          <h1 className="call-title">Звонок #{callId ?? "—"}</h1>
          <p className="muted">Видео выключено по умолчанию. Можно включить позже.</p>
          <div className="call-status" role="status" aria-live="polite">
            {isMicrophoneActive ? (
              <span className="call-status__badge" aria-label="Микрофон включён">
                <span className="call-status__icon" aria-hidden>
                  🎤
                </span>
                <span>Микрофон включён</span>
              </span>
            ) : (
              <span className="call-status__badge call-status__badge--muted" aria-label="Микрофон выключен">
                <span className="call-status__icon" aria-hidden>
                  🔇
                </span>
                <span>Микрофон выключен</span>
              </span>
            )}
          </div>
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

            {!participant.isCurrentUser && participant.stream ? (
              <audio
                autoPlay
                playsInline
                ref={(el) => {
                  if (!el) {
                    remoteAudioElementsRef.current.delete(participant.id);
                    return;
                  }

                  remoteAudioElementsRef.current.set(participant.id, el);

                  if (el.srcObject !== participant.stream) {
                    el.srcObject = participant.stream;
                  }

                  attemptPlayAudio(el);
                }}
              />
            ) : null}

            <div className="call-participant">
              <div>
                <p className="call-participant__name">{participant.name}</p>
                <p className="call-participant__handle">{participant.handle}</p>
              </div>
              {participant.isSpeaking ? <span className="call-speaking">Говорит</span> : null}
            </div>

            <div className="call-participant__diagnostics">
              <p className="muted">
                {participant.hasRemoteAudio ? "Аудио получено" : "Аудио не получено"}
              </p>
              <p className="muted">ICE: {participant.iceConnectionState ?? "n/a"}</p>
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
            onClick={() => ensureLocalAudioStream()}
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
