"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type AvatarStatus = "idle" | "connecting" | "ready" | "speaking" | "muted" | "error";

interface UseLiveAvatarOptions {
  avatarId: string;
  voiceId?: string;
  systemPrompt?: string;
  onError?: (err: string) => void;
}

export function useLiveAvatar({
  avatarId,
  voiceId,
  systemPrompt,
  onError,
}: UseLiveAvatarOptions) {
  const [status, setStatus] = useState<AvatarStatus>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const avatarRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Fetch session token securely from our own API route (keeps HeyGen key server-side)
  const getSessionToken = useCallback(async () => {
    const res = await fetch("/api/heygen-token", { method: "POST" });
    const data = await res.json();
    if (!data.token) throw new Error(data.error || "Failed to get session token");
    return data.token as string;
  }, []);

  // Start the avatar WebRTC session
  const startSession = useCallback(async () => {
    try {
      setStatus("connecting");

      // Dynamic import avoids SSR issues — SDK uses browser APIs
      const StreamingAvatarModule = await import("@heygen/streaming-avatar");

      // SDK v2.x uses a default export for the class
      const StreamingAvatar = StreamingAvatarModule.default ?? StreamingAvatarModule.StreamingAvatar;
      const StreamingEvents = StreamingAvatarModule.StreamingEvents;
      const AvatarQuality = StreamingAvatarModule.AvatarQuality;

      if (!StreamingAvatar) throw new Error("StreamingAvatar class not found in SDK — check SDK version");

      const token = await getSessionToken();
      const avatar = new StreamingAvatar({ token });
      avatarRef.current = avatar;

      // Events
      avatar.on(StreamingEvents.AVATAR_START_TALKING, () => setIsSpeaking(true));
      avatar.on(StreamingEvents.AVATAR_STOP_TALKING, () => setIsSpeaking(false));
      avatar.on(StreamingEvents.STREAM_READY, (event: any) => {
        const stream = event?.detail ?? event;
        if (videoRef.current && stream) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(console.error);
        }
        setStatus("ready");
      });
      avatar.on(StreamingEvents.STREAM_DISCONNECTED, () => {
        setStatus("idle");
        setIsSpeaking(false);
      });

      await avatar.createStartAvatar({
        quality: AvatarQuality.High,
        avatarName: avatarId,
        voice: voiceId ? { voiceId } : undefined,
        knowledgeBase: systemPrompt,
        disableIdleTimeout: true,
      });
    } catch (err: any) {
      console.error("LiveAvatar error:", err);
      setStatus("error");
      onError?.(err.message || "Failed to start avatar session");
    }
  }, [avatarId, voiceId, systemPrompt, getSessionToken, onError]);

  // Speak a text string
  const speak = useCallback(async (text: string) => {
    if (!avatarRef.current || isMuted) return;
    try {
      const mod = await import("@heygen/streaming-avatar");
      const TaskType = mod.TaskType;
      await avatarRef.current.speak({
        text,
        task_type: TaskType?.TALK ?? "talk",
      });
    } catch (err: any) {
      console.error("Speak error:", err);
    }
  }, [isMuted]);

  // Interrupt current speech
  const interrupt = useCallback(async () => {
    if (!avatarRef.current) return;
    try {
      await avatarRef.current.interrupt();
    } catch (err: any) {
      console.error("Interrupt error:", err);
    }
  }, []);

  // Toggle mute
  const toggleMute = useCallback(async () => {
    if (!avatarRef.current) return;
    if (isMuted) {
      setIsMuted(false);
      setStatus(isSpeaking ? "speaking" : "ready");
    } else {
      await interrupt();
      setIsMuted(true);
      setStatus("muted");
    }
  }, [isMuted, isSpeaking, interrupt]);

  // End session
  const endSession = useCallback(async () => {
    if (!avatarRef.current) return;
    try {
      await avatarRef.current.stopAvatar();
    } catch (err: any) {
      console.error("Stop error:", err);
    }
    avatarRef.current = null;
    setStatus("idle");
    setIsSpeaking(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (avatarRef.current) {
        avatarRef.current.stopAvatar().catch(() => {});
      }
    };
  }, []);

  return {
    status,
    isSpeaking,
    isMuted,
    videoRef,
    startSession,
    speak,
    interrupt,
    toggleMute,
    endSession,
  };
}
