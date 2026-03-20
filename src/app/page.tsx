"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useLiveAvatar } from "@/hooks/useLiveAvatar";
import {
  sendChatMessage,
  subscribeToChatMessages,
  subscribeToQA,
  submitQuestion,
  updateQuestionStatus,
  broadcastSlideChange,
  ChatMessage,
  QAItem,
} from "@/lib/firebase";

// ─── Slide Data ───────────────────────────────────────────────────────────────
// Edit these slides for your webinar content
const SLIDES = [
  {
    title: "Welcome to AI Product Demo Day",
    body: "Exploring the future of interactive AI avatars in live events",
    bullets: [] as string[],
  },
  {
    title: "The Problem with Traditional Webinars",
    body: "Why live events need a rethink",
    bullets: [
      "Hosts get exhausted across time zones",
      "Repetitive content, low engagement",
      "No personalization at scale",
    ],
  },
  {
    title: "LiveAvatar — The Architecture",
    body: "How real-time AI avatar streaming works",
    bullets: [
      "WebRTC streams avatar at under 300ms latency",
      "GPT-4 powers intelligent Q&A responses",
      "Custom voice and lip-sync via HeyGen TTS",
    ],
  },
  {
    title: "Live Demo — What You're Experiencing Now",
    body: "This is the webinar platform we just described",
    bullets: [
      "Real-time avatar speech and lip-sync",
      "Slide deck advancing with the script",
      "Live chat + Q&A routed to the avatar",
    ],
  },
  {
    title: "Getting Started — Your Next Steps",
    body: "From demo to production in 4–6 weeks",
    bullets: [
      "Sign up at app.liveavatar.com",
      "Record your 2-minute avatar video",
      "Deploy this Next.js starter",
      "Connect your LLM and go live!",
    ],
  },
];

const SESSION_ID = "webinar-" + new Date().toISOString().split("T")[0];

// ─── Component ────────────────────────────────────────────────────────────────

export default function WebinarPage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [activeTab, setActiveTab] = useState<"chat" | "qa">("chat");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [qaItems, setQaItems] = useState<QAItem[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [qaInput, setQaInput] = useState("");
  const [timerSecs, setTimerSecs] = useState(0);
  const [isPresenting, setIsPresenting] = useState(false);
  const [isListeningChat, setIsListeningChat] = useState(false);
  const [isListeningQA, setIsListeningQA] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const presentTimeoutRef = useRef<NodeJS.Timeout>();
  const recognitionRef = useRef<any>(null);

  const { status, isSpeaking, isMuted, videoRef, startSession, speak, interrupt, toggleMute, endSession } =
    useLiveAvatar({
      avatarId: process.env.NEXT_PUBLIC_AVATAR_ID || "",
      systemPrompt: process.env.NEXT_PUBLIC_AVATAR_PERSONA,
      onError: (err) => console.error("Avatar error:", err),
    });

  // Timer
  useEffect(() => {
    const interval = setInterval(() => setTimerSecs((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Firebase subscriptions
  useEffect(() => {
    const unsubChat = subscribeToChatMessages(SESSION_ID, setChatMessages);
    const unsubQA = subscribeToQA(SESSION_ID, setQaItems);
    return () => { unsubChat(); unsubQA(); };
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ─── Slide Navigation ─────────────────────────────────────────────────────

  const goToSlide = useCallback(
    async (idx: number) => {
      if (idx < 0 || idx >= SLIDES.length) return;
      setCurrentSlide(idx);
      await broadcastSlideChange(SESSION_ID, idx);
    },
    []
  );

  // ─── Auto Presentation ────────────────────────────────────────────────────

  const presentSlide = useCallback(
    async (idx: number) => {
      if (idx >= SLIDES.length) {
        setIsPresenting(false);
        return;
      }
      await goToSlide(idx);

      // Generate script via OpenAI
      const slide = SLIDES[idx];
      try {
        const res = await fetch("/api/script", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slideTitle: slide.title,
            slideBullets: slide.bullets,
            durationSeconds: 40,
          }),
        });
        const { script } = await res.json();
        await speak(script);

        // Wait for avatar to finish then advance
        presentTimeoutRef.current = setTimeout(() => {
          if (isPresenting) presentSlide(idx + 1);
        }, 45000); // fallback timeout
      } catch (err) {
        console.error("Script generation failed:", err);
        await speak(`Let's talk about ${slide.title}. ${slide.bullets.join(". ")}`);
      }
    },
    [goToSlide, speak, isPresenting]
  );

  const toggleAutoPresent = useCallback(async () => {
    if (isPresenting) {
      setIsPresenting(false);
      clearTimeout(presentTimeoutRef.current);
      await interrupt();
    } else {
      setIsPresenting(true);
      await presentSlide(currentSlide);
    }
  }, [isPresenting, currentSlide, presentSlide, interrupt]);

  // ─── Chat ─────────────────────────────────────────────────────────────────

  const sendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatInput("");
    await sendChatMessage(SESSION_ID, "You", text, "#4F46E5");
  }, [chatInput]);

  // ─── Q&A ──────────────────────────────────────────────────────────────────

  const handleSubmitQuestion = useCallback(async () => {
    const text = qaInput.trim();
    if (!text) return;
    setQaInput("");
    await submitQuestion(SESSION_ID, "Audience", text);
  }, [qaInput]);

  const answerQuestion = useCallback(
    async (item: QAItem) => {
      await updateQuestionStatus(SESSION_ID, item.id, "answering");
      try {
        const slide = SLIDES[currentSlide];
        const res = await fetch("/api/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: item.question,
            slideContext: `${slide.title}: ${slide.bullets.join(", ")}`,
          }),
        });
        const { answer } = await res.json();

        // Avatar speaks the answer
        await speak(answer);

        // Post answer to chat
        await sendChatMessage(SESSION_ID, "AI Avatar", answer, "#6C63FF", true);
        await updateQuestionStatus(SESSION_ID, item.id, "answered", answer);
      } catch (err) {
        console.error("Answer failed:", err);
        await updateQuestionStatus(SESSION_ID, item.id, "pending");
      }
    },
    [currentSlide, speak]
  );

  // ─── Voice Input (Web Speech API) ─────────────────────────────────────────

  const startVoiceInput = useCallback(
    (target: "chat" | "qa") => {
      if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
        alert("Voice input requires Chrome or Edge browser.");
        return;
      }

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      if (target === "chat") setIsListeningChat(true);
      else setIsListeningQA(true);

      recognition.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        if (target === "chat") {
          setChatInput(transcript);
          setIsListeningChat(false);
        } else {
          setQaInput(transcript);
          setIsListeningQA(false);
        }
      };

      recognition.onerror = () => {
        setIsListeningChat(false);
        setIsListeningQA(false);
      };

      recognition.onend = () => {
        setIsListeningChat(false);
        setIsListeningQA(false);
      };

      recognition.start();
    },
    []
  );

  // ─── Utils ────────────────────────────────────────────────────────────────

  const formatTimer = (s: number) => {
    const m = String(Math.floor(s / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return `${m}:${sec}`;
  };

  const pendingQA = qaItems.filter((q) => q.status === "pending");
  const slide = SLIDES[currentSlide];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "var(--bg)", fontFamily: "var(--font-dm-sans)" }}>

      {/* TOP BAR */}
      <div className="flex items-center gap-3 px-4 h-12 border-b" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold" style={{ background: "#EF444415", borderColor: "#EF444430", color: "#EF4444" }}>
          <div className="w-2 h-2 rounded-full bg-red-500 live-dot" />
          LIVE
        </div>
        <span className="flex-1 font-medium text-sm">{process.env.NEXT_PUBLIC_WEBINAR_TITLE || "AI Webinar"}</span>
        <span className="text-xs" style={{ color: "var(--muted)" }}>Slide {currentSlide + 1} / {SLIDES.length}</span>
        <div className="flex items-center gap-2 text-xs px-3 py-1 rounded-full border" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--muted)" }}>
          👤 Live viewers
        </div>
        {status !== "ready" && (
          <button
            onClick={startSession}
            className="px-3 py-1 rounded-lg text-xs font-medium text-white"
            style={{ background: "var(--accent)" }}
          >
            {status === "connecting" ? "Connecting..." : "Start Avatar"}
          </button>
        )}
      </div>

      {/* MAIN */}
      <div className="flex flex-1 overflow-hidden">

        {/* STAGE */}
        <div className="flex flex-col flex-1 overflow-hidden border-r" style={{ borderColor: "var(--border)" }}>

          {/* Avatar Video */}
          <div className="relative flex-1 flex items-center justify-center overflow-hidden" style={{ background: "#0A0B10" }}>
            <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 60%, #1a1060 0%, #0A0B10 70%)" }} />
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="relative overflow-hidden rounded-full border-2" style={{ width: 200, height: 240, borderColor: "#6C63FF40", borderRadius: "50% 50% 45% 45%", background: "linear-gradient(180deg,#2d2060 0%,#1a1040 100%)" }}>
                {/* Real avatar video */}
                <video
                  ref={videoRef}
                  id="avatarVideo"
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                  style={{ display: status === "ready" ? "block" : "none" }}
                />
                {/* Placeholder when not connected */}
                {status !== "ready" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <div className="text-4xl">🤖</div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>
                      {status === "connecting" ? "Connecting..." : "Avatar offline"}
                    </div>
                  </div>
                )}
              </div>

              {/* Speaking indicator */}
              {isSpeaking && (
                <div className="flex gap-1 items-end h-5">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 rounded-full"
                      style={{
                        background: "var(--accent)",
                        height: [8, 16, 22, 14, 10][i],
                        animation: `avatarSpeak ${0.3 + i * 0.05}s infinite alternate`,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Badges */}
            <div className="absolute top-3 left-3 px-2 py-1 rounded text-xs font-mono" style={{ background: "#00D4AA10", border: "1px solid #00D4AA30", color: "#00D4AA" }}>
              WebRTC · LiveAvatar
            </div>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-medium" style={{ background: "#00000070", border: "1px solid var(--border)", color: isSpeaking ? "#00D4AA" : "var(--muted)" }}>
              {isMuted ? "🔇 Muted" : isSpeaking ? "● Speaking..." : status === "ready" ? "● Ready" : "● " + status}
            </div>
          </div>

          {/* Caption */}
          <div className="flex items-start gap-3 px-4 py-3 border-t" style={{ background: "var(--card)", borderColor: "var(--border)", minHeight: 60 }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-white font-medium flex-shrink-0 mt-0.5" style={{ background: "var(--accent)" }}>AI</div>
            <div className="text-sm leading-relaxed flex-1" style={{ color: "var(--text)" }}>
              {isSpeaking ? <span className="animate-pulse">Speaking...</span> : <span style={{ color: "var(--muted)" }}>Waiting for input — ask a question or press Auto Present</span>}
            </div>
          </div>

          {/* Current Slide */}
          <div className="grid border-t" style={{ gridTemplateColumns: "1fr 90px", borderColor: "var(--border)", background: "var(--surface)", minHeight: 110 }}>
            <div className="p-3 flex flex-col gap-2">
              <div className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--muted)" }}>Current Slide</div>
              <div className="flex-1 rounded-md p-3 border" style={{ background: "var(--bg)", borderColor: "var(--border)" }}>
                <div className="font-semibold text-sm mb-1">{slide.title}</div>
                <div className="text-xs mb-2" style={{ color: "var(--muted)" }}>{slide.body}</div>
                <ul className="space-y-1">
                  {slide.bullets.map((b, i) => (
                    <li key={i} className="text-xs flex gap-1.5" style={{ color: "var(--muted)" }}>
                      <span style={{ color: "var(--accent)" }}>›</span>{b}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
                <span>Slide {currentSlide + 1}</span>
                <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${((currentSlide + 1) / SLIDES.length) * 100}%`, background: "var(--accent)" }} />
                </div>
                <span>{SLIDES.length} slides</span>
              </div>
            </div>

            {/* Slide thumbnails */}
            <div className="flex flex-col gap-1.5 p-2 overflow-y-auto border-l" style={{ borderColor: "var(--border)" }}>
              {SLIDES.map((s, i) => (
                <div
                  key={i}
                  onClick={() => goToSlide(i)}
                  className="rounded cursor-pointer p-1.5 text-center leading-tight transition-all"
                  style={{
                    background: "var(--bg)",
                    border: `1px solid ${i === currentSlide ? "var(--accent)" : "var(--border)"}`,
                    color: i === currentSlide ? "var(--accent)" : "var(--muted)",
                    fontSize: 9,
                    minHeight: 36,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {s.title.substring(0, 18)}…
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SIDE PANEL */}
        <div className="flex flex-col overflow-hidden" style={{ width: 300, background: "var(--surface)" }}>
          {/* Tabs */}
          <div className="flex border-b" style={{ borderColor: "var(--border)" }}>
            {(["chat", "qa"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-1 h-9 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors"
                style={{
                  color: activeTab === tab ? "var(--accent)" : "var(--muted)",
                  borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
                  background: "transparent",
                  borderTop: "none",
                  borderLeft: "none",
                  borderRight: "none",
                  cursor: "pointer",
                }}
              >
                {tab === "chat" ? "Chat" : "Q&A"}
                {tab === "qa" && pendingQA.length > 0 && (
                  <span className="w-4 h-4 rounded-full text-white flex items-center justify-center" style={{ background: "var(--accent)", fontSize: 9 }}>
                    {pendingQA.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Chat Panel */}
          {activeTab === "chat" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                {chatMessages.map((msg) => {
                  const initials = msg.user.split(" ").map((x) => x[0]).join("").substring(0, 2).toUpperCase();
                  return (
                    <div key={msg.id} className="flex gap-2 animate-in fade-in">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white flex-shrink-0 mt-0.5" style={{ background: msg.color, fontSize: 9, fontWeight: 600 }}>{initials}</div>
                      <div className="flex-1">
                        <div className="text-xs mb-0.5" style={{ color: "var(--muted)" }}>{msg.user}</div>
                        <div className="text-xs leading-relaxed" style={{ color: "var(--text)" }}>{msg.text}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
              <div className="flex gap-2 p-3 border-t" style={{ borderColor: "var(--border)" }}>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                  placeholder="Send a message..."
                  className="flex-1 rounded-md px-3 py-1.5 text-xs outline-none"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: "inherit" }}
                />
                <button onClick={() => startVoiceInput("chat")} className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm ${isListeningChat ? "voice-listening" : ""}`} style={{ background: "var(--card)", border: "1px solid var(--border)", cursor: "pointer" }} title="Voice input">🎤</button>
                <button onClick={sendChat} className="w-7 h-7 rounded-md flex items-center justify-center text-white text-sm" style={{ background: "var(--accent)", border: "none", cursor: "pointer" }}>↑</button>
              </div>
            </div>
          )}

          {/* Q&A Panel */}
          {activeTab === "qa" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                {qaItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg p-3 border transition-colors"
                    style={{
                      background: item.status === "answering" ? "#6C63FF10" : "var(--card)",
                      borderColor: item.status === "answering" ? "var(--accent)" : item.status === "answered" ? "#00D4AA40" : "var(--border)",
                      opacity: item.status === "answered" || item.status === "skipped" ? 0.6 : 1,
                    }}
                  >
                    <div className="flex items-center gap-1 mb-1.5 text-xs" style={{ color: "var(--muted)" }}>
                      {item.user}
                      {item.status === "answered" && <span className="ml-1 px-1.5 py-0.5 rounded text-xs" style={{ background: "#00D4AA20", color: "#00D4AA" }}>✓ Answered</span>}
                      {item.status === "answering" && <span className="ml-1 px-1.5 py-0.5 rounded text-xs" style={{ background: "var(--accent)", color: "#fff" }}>Speaking…</span>}
                    </div>
                    <div className="text-xs leading-relaxed mb-2" style={{ color: "var(--text)" }}>{item.question}</div>
                    {item.status === "pending" && (
                      <div className="flex gap-1.5">
                        <button onClick={() => answerQuestion(item)} className="px-2 py-1 rounded text-xs font-medium text-white" style={{ background: "var(--accent)", border: "none", cursor: "pointer" }}>▶ Answer</button>
                        <button onClick={() => updateQuestionStatus(SESSION_ID, item.id, "skipped")} className="px-2 py-1 rounded text-xs" style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--muted)", cursor: "pointer" }}>Skip</button>
                      </div>
                    )}
                  </div>
                ))}
                {qaItems.length === 0 && (
                  <div className="text-center py-8 text-xs" style={{ color: "var(--muted)" }}>No questions yet — audience will see their questions here</div>
                )}
              </div>
              <div className="flex gap-2 p-3 border-t" style={{ borderColor: "var(--border)" }}>
                <input
                  value={qaInput}
                  onChange={(e) => setQaInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmitQuestion()}
                  placeholder="Ask the avatar..."
                  className="flex-1 rounded-md px-3 py-1.5 text-xs outline-none"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: "inherit" }}
                />
                <button onClick={() => startVoiceInput("qa")} className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm ${isListeningQA ? "voice-listening" : ""}`} style={{ background: "var(--card)", border: "1px solid var(--border)", cursor: "pointer" }}>🎤</button>
                <button onClick={handleSubmitQuestion} className="w-7 h-7 rounded-md flex items-center justify-center text-white text-sm" style={{ background: "var(--accent)", border: "none", cursor: "pointer" }}>↑</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div className="flex items-center justify-between px-4 h-14 border-t" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="flex gap-2">
          <button onClick={() => goToSlide(currentSlide - 1)} disabled={currentSlide === 0} className="px-3 py-1.5 rounded-md text-xs border transition-colors" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer", opacity: currentSlide === 0 ? 0.4 : 1 }}>◀ Prev</button>
          <button onClick={toggleAutoPresent} className="px-3 py-1.5 rounded-md text-xs text-white transition-colors" style={{ background: isPresenting ? "#4F46E5" : "var(--accent)", border: "none", cursor: "pointer" }}>{isPresenting ? "⏸ Pause" : "▶ Auto Present"}</button>
          <button onClick={() => goToSlide(currentSlide + 1)} disabled={currentSlide === SLIDES.length - 1} className="px-3 py-1.5 rounded-md text-xs border" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer", opacity: currentSlide === SLIDES.length - 1 ? 0.4 : 1 }}>Next ▶</button>
        </div>

        <div className="font-mono text-sm px-3 py-1.5 rounded-md border" style={{ color: "var(--accent2)", background: "var(--card)", borderColor: "var(--border)" }}>
          {formatTimer(timerSecs)}
        </div>

        <div className="flex gap-2">
          <button onClick={toggleMute} className="px-3 py-1.5 rounded-md text-xs border transition-colors" style={{ background: isMuted ? "var(--accent)" : "var(--card)", border: "1px solid var(--border)", color: isMuted ? "#fff" : "var(--text)", cursor: "pointer" }}>{isMuted ? "🔊 Unmute" : "🔇 Mute"}</button>
          <button
            onClick={async () => {
              if (confirm("End the webinar?")) {
                await speak("Thank you all for joining! This session is now ending. The recording will be available shortly.");
                setTimeout(endSession, 5000);
              }
            }}
            className="px-3 py-1.5 rounded-md text-xs border hover:border-red-500 hover:text-red-400 transition-colors"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer" }}
          >⬛ End Webinar</button>
        </div>
      </div>
    </div>
  );
}
