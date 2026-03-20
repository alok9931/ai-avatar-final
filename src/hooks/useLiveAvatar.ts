"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type AvatarStatus = "idle" | "connecting" | "ready" | "speaking" | "muted" | "error";

interface UseLiveAvatarOptions {
  apiKey: string;
  avatarId: string;
  voiceId?: string;
  systemPrompt?: string;
  onError?: (err: string) => void;
}

export function useLiveAvatar({
  apiKey,
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
  const sessionTokenRef = useRef<string | null>(null);

  // Fetch a session token from HeyGen
  const getSessionToken = useCallback(async () => {
    const res = await fetch("https://api.heygen.com/v1/streaming.create_token", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
    });
    const data = await res.json();
    if (!data.data?.token) throw new Error("Failed to get session token");
    return data.data.token;
  }, [apiKey]);

  // Start the avatar WebRTC session
  const startSession = useCallback(async () => {
    try {
      setStatus("connecting");

      // Dynamically import to avoid SSR issues
      const { StreamingAvatar, StreamingEvents, AvatarQuality, TaskType } = await import(
        "@heygen/streaming-avatar"
      );

      const token = await getSessionToken();
      sessionTokenRef.current = token;

      const avatar = new StreamingAvatar({ token });
      avatarRef.current = avatar;

      // Hook up events
      avatar.on(StreamingEvents.AVATAR_START_TALKING, () => setIsSpeaking(true));
      avatar.on(StreamingEvents.AVATAR_STOP_TALKING, () => setIsSpeaking(false));
      avatar.on(StreamingEvents.STREAM_READY, (event: any) => {
        if (videoRef.current && event.detail) {
          videoRef.current.srcObject = event.detail;
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
  }, [apiKey, avatarId, voiceId, systemPrompt, getSessionToken, onError]);

  // Speak a text string
  const speak = useCallback(async (text: string) => {
    if (!avatarRef.current || isMuted) return;
    try {
      const { TaskType } = await import("@heygen/streaming-avatar");
      await avatarRef.current.speak({
        text,
        task_type: TaskType.TALK,
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
