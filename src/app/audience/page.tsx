"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  subscribeToChatMessages,
  subscribeToQA,
  subscribeToSlideChanges,
  sendChatMessage,
  submitQuestion,
  trackViewer,
  ChatMessage,
  QAItem,
} from "@/lib/firebase";

const SESSION_ID = "webinar-" + new Date().toISOString().split("T")[0];

// The audience view embeds an HLS/WebRTC stream pushed from the host
export default function AudiencePage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [qaItems, setQaItems] = useState<QAItem[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [qaInput, setQaInput] = useState("");
  const [activeTab, setActiveTab] = useState<"chat" | "qa">("chat");
  const [userName, setUserName] = useState("Audience Member");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    trackViewer(SESSION_ID);
    const unsubChat = subscribeToChatMessages(SESSION_ID, setChatMessages);
    const unsubQA = subscribeToQA(SESSION_ID, setQaItems);
    const unsubSlides = subscribeToSlideChanges(SESSION_ID, setCurrentSlide);
    return () => { unsubChat(); unsubQA(); unsubSlides(); };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatInput("");
    const colors = ["#6C63FF", "#00D4AA", "#F59E0B", "#EF4444", "#3B82F6"];
    const color = colors[Math.floor(Math.random() * colors.length)];
    await sendChatMessage(SESSION_ID, userName, text, color);
  }, [chatInput, userName]);

  const handleSubmitQuestion = useCallback(async () => {
    const text = qaInput.trim();
    if (!text) return;
    setQaInput("");
    await submitQuestion(SESSION_ID, userName, text);
  }, [qaInput, userName]);

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      {/* TOP BAR */}
      <div className="flex items-center gap-3 px-4 h-12 border-b" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: "#EF444415", border: "1px solid #EF444430", color: "#EF4444" }}>
          <div className="w-2 h-2 rounded-full bg-red-500 live-dot" />
          LIVE
        </div>
        <span className="flex-1 font-medium text-sm">{process.env.NEXT_PUBLIC_WEBINAR_TITLE}</span>
        <input
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder="Your name"
          className="px-2 py-1 rounded text-xs"
          style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: "inherit", width: 120 }}
        />
      </div>

      {/* MAIN */}
      <div className="flex flex-1 overflow-hidden">
        {/* STREAM VIEWER */}
        <div className="flex-1 flex items-center justify-center" style={{ background: "#0A0B10" }}>
          {/* In production: embed an iframe/HLS stream from your OBS → YouTube Live */}
          {/* Or embed the LiveAvatar stream directly via a shared WebRTC room */}
          <div className="text-center" style={{ color: "var(--muted)" }}>
            <div className="text-4xl mb-3">📺</div>
            <div className="text-sm font-medium mb-1" style={{ color: "var(--text)" }}>Live Stream</div>
            <div className="text-xs">Embed your OBS/YouTube Live stream here</div>
            <div className="text-xs mt-1">Or connect via LiveAvatar shared room</div>
          </div>
        </div>

        {/* CHAT PANEL */}
        <div className="flex flex-col border-l" style={{ width: 280, background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="flex border-b" style={{ borderColor: "var(--border)" }}>
            {(["chat", "qa"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className="flex-1 h-9 text-xs font-medium" style={{ color: activeTab === tab ? "var(--accent)" : "var(--muted)", borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent", background: "transparent", borderTop: "none", borderLeft: "none", borderRight: "none", cursor: "pointer" }}>
                {tab === "chat" ? "Live Chat" : "Q&A"}
              </button>
            ))}
          </div>

          {activeTab === "chat" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                {chatMessages.map((msg) => (
                  <div key={msg.id} className="flex gap-2">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: msg.color, fontSize: 8, fontWeight: 600 }}>
                      {msg.user.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <span className="text-xs font-medium" style={{ color: msg.color }}>{msg.user}: </span>
                      <span className="text-xs" style={{ color: "var(--text)" }}>{msg.text}</span>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="flex gap-2 p-3 border-t" style={{ borderColor: "var(--border)" }}>
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()} placeholder="Say something..." className="flex-1 rounded-md px-2 py-1.5 text-xs outline-none" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: "inherit" }} />
                <button onClick={sendChat} className="w-7 h-7 rounded-md text-white text-sm" style={{ background: "var(--accent)", border: "none", cursor: "pointer" }}>↑</button>
              </div>
            </div>
          )}

          {activeTab === "qa" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                {qaItems.map((item) => (
                  <div key={item.id} className="rounded-lg p-3 border" style={{ background: "var(--card)", borderColor: item.status === "answered" ? "#00D4AA40" : "var(--border)" }}>
                    <div className="text-xs mb-1" style={{ color: "var(--muted)" }}>{item.user}</div>
                    <div className="text-xs" style={{ color: "var(--text)" }}>{item.question}</div>
                    {item.status === "answered" && item.answer && (
                      <div className="mt-2 text-xs p-2 rounded" style={{ background: "#00D4AA10", color: "#00D4AA" }}>
                        ✓ {item.answer.substring(0, 100)}…
                      </div>
                    )}
                  </div>
                ))}
                {qaItems.length === 0 && <div className="text-center py-8 text-xs" style={{ color: "var(--muted)" }}>Be the first to ask a question!</div>}
              </div>
              <div className="flex gap-2 p-3 border-t" style={{ borderColor: "var(--border)" }}>
                <input value={qaInput} onChange={(e) => setQaInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSubmitQuestion()} placeholder="Ask a question..." className="flex-1 rounded-md px-2 py-1.5 text-xs outline-none" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: "inherit" }} />
                <button onClick={handleSubmitQuestion} className="w-7 h-7 rounded-md text-white text-sm" style={{ background: "var(--accent)", border: "none", cursor: "pointer" }}>↑</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
