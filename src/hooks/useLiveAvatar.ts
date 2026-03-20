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

  const getSessionToken = useCallback(async () => {
    const res = await fetch("/api/heygen-token", { method: "POST" });
    const data = await res.json();
    if (!data.token) throw new Error(data.error || "Failed to get session token");
    return data.token as string;
  }, []);

  const startSession = useCallback(async () => {
    try {
      setStatus("connecting");

      // Import the module — StreamingAvatar is the DEFAULT export in v2.x
      // AvatarQuality, StreamingEvents, TaskType are NAMED exports
      import("@heygen/streaming-avatar").then(async (mod) => {
        const StreamingAvatar = mod.default;
        const { AvatarQuality, StreamingEvents, TaskType } = mod;

        const token = await getSessionToken();
        const avatar = new StreamingAvatar({ token });
        avatarRef.current = avatar;

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
        });
      });
    } catch (err: any) {
      console.error("LiveAvatar error:", err);
      setStatus("error");
      onError?.(err.message || "Failed to start avatar session");
    }
  }, [avatarId, voiceId, systemPrompt, getSessionToken, onError]);

  const speak = useCallback(async (text: string) => {
    if (!avatarRef.current || isMuted) return;
    try {
      const { TaskType } = await import("@heygen/streaming-avatar");
      await avatarRef.current.speak({ text, task_type: TaskType.TALK });
    } catch (err: any) {
      console.error("Speak error:", err);
    }
  }, [isMuted]);

  const interrupt = useCallback(async () => {
    try { await avatarRef.current?.interrupt(); } catch {}
  }, []);

  const toggleMute = useCallback(async () => {
    if (isMuted) {
      setIsMuted(false);
      setStatus(isSpeaking ? "speaking" : "ready");
    } else {
      await interrupt();
      setIsMuted(true);
      setStatus("muted");
    }
  }, [isMuted, isSpeaking, interrupt]);

  const endSession = useCallback(async () => {
    try { await avatarRef.current?.stopAvatar(); } catch {}
    avatarRef.current = null;
    setStatus("idle");
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    return () => { avatarRef.current?.stopAvatar().catch(() => {}); };
  }, []);

  return { status, isSpeaking, isMuted, videoRef, startSession, speak, interrupt, toggleMute, endSession };
}
