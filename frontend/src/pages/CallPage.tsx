import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useWebSocketToken } from "../hooks/useWebSocketToken";
import { fetchIceServers, getWebSocketBaseUrl } from "../services/webrtc";
import { Mic, MicOff, Video, VideoOff, Link2, Phone } from "lucide-react";
import defaultAvatar from "../assets/default-avatar.svg";

interface SignalingUser {
  id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
}

type SignalingMessage =
  | { type: "call_metadata"; room_start_time: string }
  | { type: "participants_snapshot"; participants: SignalingUser[] }
  | { type: "user_joined"; user: SignalingUser }
  | { type: "user_left"; user: SignalingUser; left_at?: string; reason?: string }
  | { type: "user_disconnected"; user: SignalingUser; disconnected_at: string; grace_period_sec: number }
  | { type: "user_reconnected"; user: SignalingUser; reconnected_at: string }
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
  photoUrl?: string | null;
  isCurrentUser?: boolean;
  isSpeaking?: boolean;
  hasVideo?: boolean;
  hasRemoteAudio?: boolean;
  iceConnectionState?: RTCPeerConnectionState | null;
  stream?: MediaStream;
  isReconnecting?: boolean;
  reconnectDeadline?: number; // timestamp когда истекает grace period
  gracePeriodSeconds?: number; // длительность grace period
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
  const { getToken } = useWebSocketToken();
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
  const [gridColumns, setGridColumns] = useState(1);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [callDurationMinutes, setCallDurationMinutes] = useState(0);
  const [isConnecting, setIsConnecting] = useState(true);

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
  const audioContextsRef = useRef<Map<string, { context: AudioContext; analyser: AnalyserNode; dataArray: Uint8Array }>>(new Map());
  const speakingCheckIntervalRef = useRef<number | null>(null);
  const connectionSoundPlayedRef = useRef(false);
  const [reconnectTimers, setReconnectTimers] = useState<Map<string, number>>(new Map());

  // eslint-disable-next-line no-console
  console.log("[CallPage] Rendering", {
    callId,
    hasUser: !!user,
    hasJoinUrl: !!joinUrl,
    hasToken: !!token,
    callConnected,
    callError,
  });

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
        // eslint-disable-next-line no-console
        console.warn("[Call] failed to autoplay remote audio", error);
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
    // Clear all reconnection timers
    reconnectionTimersRef.current.forEach((timeout) => clearTimeout(timeout));
    reconnectionTimersRef.current.clear();

    // Close all peer connections
    peersRef.current.forEach((peer) => peer.close());
    peersRef.current.clear();

    // Stop all remote stream tracks
    remoteStreamsRef.current.forEach((stream) => {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
    });
    remoteStreamsRef.current.clear();

    // Properly cleanup remote audio elements
    remoteAudioElementsRef.current.forEach((audio) => {
      audio.pause();
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

  const scheduleNavigateToCallEnded = useCallback(() => {
    if (homeRedirectTimeoutRef.current) {
      clearTimeout(homeRedirectTimeoutRef.current);
    }

    homeRedirectTimeoutRef.current = window.setTimeout(() => navigate("/call-ended"), 1500);
  }, [navigate]);

  const handleConnectionError = useCallback(
    (message: string, navigateHome = false, preserveExistingMessage = false) => {
      setCallError((current) => (preserveExistingMessage && current ? current : message));
      clearConnections();
      setCallStartTime(null);
      setCallDurationMinutes(0);

      if (navigateHome) {
        // Проверяем, является ли это ошибкой "звонок не найден" или "звонок завершен"
        const isCallEndedError =
          message.toLowerCase().includes("call not found") ||
          message.toLowerCase().includes("звонок завершен") ||
          message.toLowerCase().includes("звонок больше не активен") ||
          message === "Звонок завершён";

        if (isCallEndedError) {
          scheduleNavigateToCallEnded();
        } else {
          scheduleNavigateHome();
        }
      }
    },
    [clearConnections, scheduleNavigateHome, scheduleNavigateToCallEnded],
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
      // eslint-disable-next-line no-console
      console.error("[Call] failed to get local audio", err);
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
      // eslint-disable-next-line no-console
      console.warn("[Call] no audio tracks in local stream");
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
      // eslint-disable-next-line no-console
      console.log("[Media] turning camera off", { trackId: videoTrack?.id });
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

      // Renegotiate all peer connections to notify others about video removal
      const renegotiatePromises: Promise<void>[] = [];
      peersRef.current.forEach((peer, participantId) => {
        const targetUserId = Number.parseInt(participantId, 10);
        if (!Number.isNaN(targetUserId)) {
          const renegotiatePromise = (async () => {
            try {
              const offer = await peer.createOffer();
              await peer.setLocalDescription(offer);
              sendSignalingMessage({ type: "offer", payload: offer, to_user_id: targetUserId });
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error("[RTC] failed to renegotiate peer", { participantId, error });
            }
          })();
          renegotiatePromises.push(renegotiatePromise);
        }
      });
      await Promise.all(renegotiatePromises);
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

      // eslint-disable-next-line no-console
      console.log("[Media] acquired camera track", {
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

      // Renegotiate all peer connections to notify others about new video track
      const renegotiatePromises: Promise<void>[] = [];
      peersRef.current.forEach((peer, participantId) => {
        const targetUserId = Number.parseInt(participantId, 10);
        if (!Number.isNaN(targetUserId)) {
          const renegotiatePromise = (async () => {
            try {
              const offer = await peer.createOffer();
              await peer.setLocalDescription(offer);
              sendSignalingMessage({ type: "offer", payload: offer, to_user_id: targetUserId });
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error("[RTC] failed to renegotiate peer", { participantId, error });
            }
          })();
          renegotiatePromises.push(renegotiatePromise);
        }
      });
      await Promise.all(renegotiatePromises);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to get camera access", error);
      setMediaError("Нет доступа к камере");
      setCameraOn(false);
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
      // eslint-disable-next-line no-console
      console.warn("Failed to play toggle sound", error);
    }
  }, []);

  const playConnectionSound = useCallback(() => {
    try {
      if (!toggleSoundContextRef.current) {
        toggleSoundContextRef.current = new AudioContext();
      }

      const context = toggleSoundContextRef.current;
      void context.resume();

      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = 1200;
      gain.gain.value = 0.08;

      oscillator.connect(gain);
      gain.connect(context.destination);

      const now = context.currentTime;
      const duration = 0.2;
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("Failed to play connection sound", error);
    }
  }, []);

  useEffect(() => {
    if (!micChangeByUserRef.current) {
      return;
    }

    micChangeByUserRef.current = false;
    playToggleSound();
  }, [isMicOn, playToggleSound]);

  // Воспроизвести звук при установлении соединения
  useEffect(() => {
    if (callConnected && callStartTime && !connectionSoundPlayedRef.current) {
      connectionSoundPlayedRef.current = true;
      setIsConnecting(false);
      playConnectionSound();
    }
  }, [callConnected, callStartTime, playConnectionSound]);

  useEffect(() => {
    const remoteAudioElements = remoteAudioElementsRef.current;

    return () => {
      // Stop all local media tracks
      stopLocalMedia();

      // Cleanup all remote audio elements
      remoteAudioElements.forEach((audio) => {
        audio.pause();
        audio.srcObject = null;
        audio.remove();
      });
      remoteAudioElements.clear();

      // Close audio context
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

  // Update call duration timer every minute
  useEffect(() => {
    if (!callStartTime) {
      setCallDurationMinutes(0);
      return;
    }

    const updateDuration = () => {
      const elapsedMs = Date.now() - callStartTime;
      const elapsedMinutes = Math.floor(elapsedMs / 60000);
      setCallDurationMinutes(elapsedMinutes);
    };

    // Update immediately
    updateDuration();

    // Then update every minute
    const interval = setInterval(updateDuration, 60000);

    return () => clearInterval(interval);
  }, [callStartTime]);

  // Format duration as HH:MM
  const formatCallDuration = useCallback((minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  }, []);

  const participantCount = participants.length;

  const updateGridColumns = useCallback(() => {
    const count = Math.max(1, participantCount);
    const maxColsByParticipants = Math.min(3, count);
    const width = window.innerWidth;

    let cols = maxColsByParticipants;

    if (width < 320) {
      cols = Math.min(2, cols);
    }

    if (width < 240) {
      cols = 1;
    }

    setGridColumns(cols);
  }, [participantCount]);

  useEffect(() => {
    updateGridColumns();
  }, [updateGridColumns]);

  useEffect(() => {
    window.addEventListener("resize", updateGridColumns);

    return () => {
      window.removeEventListener("resize", updateGridColumns);
    };
  }, [updateGridColumns]);

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

      // Cleanup audio context
      const audioContextData = audioContextsRef.current.get(participantId);
      if (audioContextData) {
        audioContextData.context.close();
        audioContextsRef.current.delete(participantId);
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
    async (participantId: string) => {
      let stream = localStreamRef.current;

      if (!hasActiveAudioTrack(stream)) {
        stream = await ensureLocalAudioStream();
      }

      if (!stream || !hasActiveAudioTrack(stream)) {
        // eslint-disable-next-line no-console
        console.warn("[RTC] skip creating peer without active audio", { participantId });
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

      // eslint-disable-next-line no-console
      console.log("[RTC] creating peer connection", {
        participantId,
        targetUserId,
        iceServers,
      });

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
          streams: event.streams.map((incoming) => ({ id: incoming.id, active: incoming.active })),
        });

        const existingStream = remoteStreamsRef.current.get(participantId);
        const remoteStream = existingStream ?? event.streams[0] ?? new MediaStream();

        if (!remoteStream.getTracks().includes(event.track)) {
          remoteStream.addTrack(event.track);
        }

        remoteStreamsRef.current.set(participantId, remoteStream);

        // Настройка audio analyser для детектора говорящего
        if (event.track.kind === "audio" && !audioContextsRef.current.has(participantId)) {
          try {
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(new MediaStream([event.track]));
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = 0.8;
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            audioContextsRef.current.set(participantId, { context: audioContext, analyser, dataArray });
          } catch (error) {
            // eslint-disable-next-line no-console
            console.warn("[Audio] Failed to create audio analyser for participant", participantId, error);
          }
        }

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

      // eslint-disable-next-line no-console
      console.log("[Participant] Updating remote user from offer", {
        user_id: fromUser.id,
        photo_url: fromUser.photo_url,
        hasPhoto: Boolean(fromUser.photo_url),
      });

      updateParticipant({
        id: participantId,
        name: getParticipantName(fromUser),
        handle: getParticipantHandle(fromUser),
        color: getParticipantColor(participantId),
        photoUrl: fromUser.photo_url,
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
        photoUrl: fromUser.photo_url,
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
        photoUrl: remoteUser.photo_url,
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
        photoUrl: remoteUser.photo_url,
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

      if (message.type === "call_metadata") {
        const roomStartTime = new Date(message.room_start_time).getTime();
        // eslint-disable-next-line no-console
        console.log("[CallTimer] Received call_metadata", {
          room_start_time: message.room_start_time,
          roomStartTime,
        });
        setCallStartTime(roomStartTime);
        return;
      }

      if (message.type === "participants_snapshot") {
        await Promise.all(message.participants.map((participant) => connectToParticipantIfNeeded(participant)));
        return;
      }

      if (message.type === "user_joined") {
        await connectToParticipantIfNeeded(message.user);
        return;
      }

      if (message.type === "user_disconnected") {
        // Помечаем участника как переподключающегося с таймером
        const participantId = String(message.user.id);
        const disconnectedAt = new Date(message.disconnected_at).getTime();
        const gracePeriodMs = message.grace_period_sec * 1000;
        const deadline = disconnectedAt + gracePeriodMs;

        updateParticipant({
          id: participantId,
          isReconnecting: true,
          reconnectDeadline: deadline,
          gracePeriodSeconds: message.grace_period_sec,
        });
        // eslint-disable-next-line no-console
        console.log("[Reconnect] User disconnected, waiting for reconnection", {
          participantId,
          gracePeriodSec: message.grace_period_sec,
          deadline: new Date(deadline).toISOString(),
        });
        return;
      }

      if (message.type === "user_reconnected") {
        // Снимаем флаг переподключения
        const participantId = String(message.user.id);
        updateParticipant({
          id: participantId,
          isReconnecting: false,
          reconnectDeadline: undefined,
          gracePeriodSeconds: undefined,
        });
        // eslint-disable-next-line no-console
        console.log("[Reconnect] User reconnected successfully", {
          participantId,
          reconnectedAt: message.reconnected_at,
        });
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
        const errorDetail = message.detail?.toLowerCase() || "";
        const isCallNotFoundError =
          errorDetail.includes("call not found") ||
          errorDetail.includes("звонок не найден") ||
          errorDetail.includes("please create a new call");

        if (isCallNotFoundError) {
          handleConnectionError("Звонок завершён", true);
        } else {
          setCallError(message.detail);
        }
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

  // Обновление таймеров переподключения каждую секунду
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setReconnectTimers((prev) => {
        const next = new Map(prev);
        participants.forEach((p) => {
          if (p.isReconnecting && p.reconnectDeadline) {
            const remaining = Math.max(0, Math.ceil((p.reconnectDeadline - now) / 1000));
            next.set(p.id, remaining);
          } else {
            next.delete(p.id);
          }
        });
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [participants]);

  // Интервал для проверки говорящих участников
  useEffect(() => {
    if (!callConnected) return;

    const SPEAKING_THRESHOLD = 15; // Порог громкости для определения речи
    const CHECK_INTERVAL = 100; // Проверяем каждые 100ms

    const checkSpeaking = () => {
      // Проверяем удаленных участников
      audioContextsRef.current.forEach((audioData, participantId) => {
        const { analyser, dataArray } = audioData;
        analyser.getByteFrequencyData(dataArray);

        // Вычисляем среднюю громкость
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const isSpeaking = average > SPEAKING_THRESHOLD;

        updateParticipant({ id: participantId, isSpeaking });
      });

      // Проверяем текущего пользователя
      if (user && isMicOn && localStreamRef.current) {
        const audioTracks = localStreamRef.current.getAudioTracks();
        if (audioTracks.length > 0) {
          updateParticipant({
            id: String(user.id),
            isSpeaking: hasActiveAudioTrack(localStreamRef.current)
          });
        }
      }
    };

    speakingCheckIntervalRef.current = window.setInterval(checkSpeaking, CHECK_INTERVAL);

    return () => {
      if (speakingCheckIntervalRef.current) {
        clearInterval(speakingCheckIntervalRef.current);
        speakingCheckIntervalRef.current = null;
      }
    };
  }, [callConnected, isMicOn, updateParticipant, user]);

  useEffect(() => {
    if (!user) {
      setCallError("Авторизация не выполнена");
      return;
    }

    if (callError === "Авторизация не выполнена") {
      setCallError(null);
    }

    const participantId = String(user.id);

    // eslint-disable-next-line no-console
    console.log("[Participant] Updating current user", {
      user_id: user?.id,
      photo_url: user?.photo_url,
      hasPhoto: Boolean(user?.photo_url),
    });

    updateParticipant({
      id: participantId,
      name: getParticipantName(user),
      handle: getParticipantHandle(user),
      color: getParticipantColor(participantId),
      photoUrl: user?.photo_url,
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
    // eslint-disable-next-line no-console
    console.log("[CallPage] WebSocket useEffect triggered", {
      callId,
      hasUser: !!user,
      hasGetToken: typeof getToken === "function",
    });

    if (!callId) {
      // eslint-disable-next-line no-console
      console.warn("[CallPage] No callId, skipping WebSocket connection");
      return;
    }

    let socket: WebSocket | null = null;

    const connectWebSocket = async () => {
      try {
        // eslint-disable-next-line no-console
        console.log("[CallPage] Getting WebSocket token...");
        // Get WebSocket token from httpOnly cookie
        const token = await getToken();
        // eslint-disable-next-line no-console
        console.log("[CallPage] Got WebSocket token", { hasToken: !!token });

        const baseUrl = getWebSocketBaseUrl();

        if (!baseUrl) {
          setCallError("Не удалось определить адрес WebSocket сервера");
          return;
        }

        const url = `${baseUrl}/ws/calls/${callId}`;
        const protocols = token ? [`token.${token}`] : undefined;

        // eslint-disable-next-line no-console
        console.log("[Call] connecting to signaling", { url, hasToken: Boolean(token) });

        socket = protocols ? new WebSocket(url, protocols) : new WebSocket(url);

    websocketRef.current = socket;

    socket.onopen = () => {
      // eslint-disable-next-line no-console
      console.log("[WS] signaling socket opened", { url, protocols });
      setCallConnected(true);
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
      setCallConnected(false);

      // Проверяем, является ли причина закрытия ошибкой "звонок не найден"
      const reason = event.reason?.toLowerCase() || "";
      const isCallNotFound =
        reason.includes("call not found") ||
        reason.includes("звонок не найден") ||
        reason.includes("please create a new call") ||
        event.code === 1008; // Policy Violation code

      if (!event.wasClean) {
        const errorMessage = isCallNotFound
          ? "Звонок завершён"
          : "Соединение с сервером закрыто";
        handleConnectionErrorRef.current?.(errorMessage, true, true);
        return;
      }

      clearConnectionsRef.current?.();
    };
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[CallPage] Failed to connect WebSocket", {
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
          callId,
        });
        setCallError("Не удалось подключиться к звонку");
      }
    };

    // eslint-disable-next-line no-console
    console.log("[CallPage] Starting WebSocket connection...");
    void connectWebSocket();

    return () => {
      // ТЗ 2: При переходе в другой звонок по новой ссылке - выходим из текущего
      if (socket) {
        socket.close();
      }
      websocketRef.current = null;
      setCallConnected(false);

      clearConnectionsRef.current?.();

      // Останавливаем локальные медиа потоки при переходе в новый звонок
      stopLocalMedia();

      // Сбрасываем таймер
      setCallStartTime(null);
      setCallDurationMinutes(0);
    };
  }, [callId, getToken, stopLocalMedia]);

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
    stopLocalMedia();
    setCallStartTime(null);
    setCallDurationMinutes(0);

    navigate("/");
  };

  return (
    <div className="h-full w-full bg-gradient-to-b from-[#0f111a] to-black text-white font-sans flex flex-col relative overflow-hidden">
      <main className="flex-1 flex flex-col gap-3 p-4 pb-32">
        {callError ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-4" role="alert">
            <p className="font-semibold text-red-200 mb-1">{callError}</p>
            <p className="text-sm text-red-300/80">Попробуйте переподключиться или вернуться назад.</p>
          </div>
        ) : null}

        {callStartTime && (
          <div className="mx-auto mb-2 px-4 py-2 bg-black/30 backdrop-blur-md rounded-full text-sm font-medium text-white/90 flex items-center gap-2" aria-label="Длительность звонка">
            {isConnecting && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white/90 rounded-full animate-spin" />}
            {formatCallDuration(callDurationMinutes)}
          </div>
        )}

        <section
          className="grid gap-3 w-full flex-1 overflow-y-auto"
          role="list"
          style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}
        >
          {participants.map((participant) => {
            const avatarUrl = participant.photoUrl || defaultAvatar;

            return (
              <article key={participant.id} className="flex flex-col gap-2" role="listitem" aria-label={participant.name}>
                <div
                  className={`relative w-full rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-900 aspect-[3/4] flex items-center justify-center border-2 transition-all ${
                    participant.isSpeaking ? "border-[#7C66DC] shadow-[0_0_20px_rgba(124,102,220,0.4)]" : "border-zinc-800/60"
                  } ${participant.isReconnecting ? "opacity-60" : "opacity-100"}`}
                >
                  {participant.hasVideo && participant.stream ? (
                    <video
                      className={`absolute inset-0 w-full h-full object-cover ${participant.isCurrentUser ? "scale-x-[-1]" : ""}`}
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
                    <>
                      {/* Silhouette Background */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-30">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-20 h-20 text-zinc-400">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                        </svg>
                      </div>

                      {/* Avatar Image (optional) */}
                      {participant.photoUrl && (
                        <img
                          className="absolute inset-0 w-full h-full object-cover"
                          src={avatarUrl}
                          alt={`Аватар ${participant.name}`}
                          onError={(e) => {
                            const target = e.currentTarget;
                            if (target.src !== defaultAvatar) {
                              target.src = defaultAvatar;
                            }
                          }}
                        />
                      )}
                    </>
                  )}

                  {participant.isCurrentUser ? (
                    <span className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-xs font-medium text-white">
                      Вы
                    </span>
                  ) : null}

                  {/* Индикатор переподключения */}
                  {participant.isReconnecting && !participant.isCurrentUser ? (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                      <div className="w-10 h-10 border-3 border-yellow-500/40 border-t-yellow-400 rounded-full animate-spin" />
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-sm font-medium text-white">Переподключение...</span>
                        {reconnectTimers.has(participant.id) && (
                          <span className="text-xs text-yellow-300/90 font-mono">
                            {reconnectTimers.get(participant.id)}с
                          </span>
                        )}
                      </div>
                    </div>
                  ) : null}
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

                <div className="text-sm font-medium text-zinc-200 text-center">
                  {participant.name} {participant.isCurrentUser ? "(Вы)" : ""}
                </div>
              </article>
            );
          })}
        </section>

        {mediaError ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4" role="alert">
            <p className="font-semibold text-red-200 mb-1">{mediaError}</p>
            <p className="text-sm text-red-300/80 mb-3">Предоставьте доступ, чтобы мы включили микрофон.</p>
            <button
              type="button"
              className="w-full px-4 py-2 bg-zinc-800/80 hover:bg-zinc-700 text-white rounded-xl transition-all border border-zinc-700"
              onClick={() => ensureLocalAudioStream()}
              disabled={isRequestingMic}
            >
              Разрешить микрофон
            </button>
          </div>
        ) : null}

        {audioUnlockNeeded ? (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4" role="alert">
            <p className="font-semibold text-yellow-200 mb-1">Нажмите, чтобы включить звук</p>
            <p className="text-sm text-yellow-300/80 mb-3">
              Мы не смогли автоматически включить звук удалённых участников.
            </p>
            <button
              type="button"
              className="w-full px-4 py-2 bg-zinc-800/80 hover:bg-zinc-700 text-white rounded-xl transition-all border border-zinc-700"
              onClick={unlockRemoteAudio}
            >
              Включить звук
            </button>
          </div>
        ) : null}

        {isToastVisible && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-xl font-medium shadow-lg z-50">
            Ссылка скопирована
          </div>
        )}
      </main>

      <footer className="absolute bottom-0 left-0 right-0 pb-8 pt-6 px-8 flex justify-between items-center bg-gradient-to-t from-black via-black/80 to-transparent" aria-label="Панель управления звонком">
        <button
          type="button"
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
            isMicOn
              ? "bg-[#7C66DC] text-white hover:bg-[#6A55CA]"
              : "bg-zinc-800/80 backdrop-blur-md text-white hover:bg-zinc-700 border border-zinc-700"
          }`}
          onClick={toggleMicrophone}
          disabled={isRequestingMic}
          aria-label="Микрофон"
        >
          {isMicOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
        </button>

        <button
          type="button"
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
            isCameraOn
              ? "bg-[#7C66DC] text-white hover:bg-[#6A55CA]"
              : "bg-zinc-800/80 backdrop-blur-md text-white hover:bg-zinc-700 border border-zinc-700"
          }`}
          onClick={toggleCamera}
          disabled={isRequestingCamera}
          aria-label="Камера"
        >
          {isCameraOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
        </button>

        <button
          type="button"
          className="w-14 h-14 rounded-full bg-zinc-800/80 backdrop-blur-md flex items-center justify-center text-white hover:bg-zinc-700 transition-all border border-zinc-700"
          onClick={copyLink}
          disabled={!joinUrl}
          aria-label="Скопировать ссылку"
        >
          <Link2 className="w-6 h-6" />
        </button>

        <button
          type="button"
          className="w-14 h-14 rounded-full bg-[#ff0000] flex items-center justify-center text-white hover:bg-[#cc0000] transition-all shadow-lg shadow-red-500/20"
          onClick={leaveCall}
          aria-label="Выйти"
        >
          <Phone className="w-6 h-6 stroke-[2.5px] rotate-[135deg]" />
        </button>
      </footer>
    </div>
  );
};

export default CallPage;
