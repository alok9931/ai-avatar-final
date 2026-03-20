import { initializeApp, getApps } from "firebase/app";
import {
  getDatabase,
  ref,
  push,
  onValue,
  off,
  update,
  serverTimestamp,
  query,
  orderByChild,
  limitToLast,
  DataSnapshot,
} from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

// Singleton Firebase app
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getDatabase(app);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  user: string;
  text: string;
  color: string;
  timestamp: number;
  isAvatar?: boolean;
}

export interface QAItem {
  id: string;
  user: string;
  question: string;
  answer?: string;
  status: "pending" | "answering" | "answered" | "skipped";
  timestamp: number;
  votes?: number;
}

export interface WebinarState {
  currentSlide: number;
  isLive: boolean;
  viewerCount: number;
  startedAt: number;
}

// ─── Webinar Session ──────────────────────────────────────────────────────────

export function createWebinarSession(sessionId: string) {
  const sessionRef = ref(db, `sessions/${sessionId}`);
  const state: WebinarState = {
    currentSlide: 0,
    isLive: true,
    viewerCount: 0,
    startedAt: Date.now(),
  };
  push(sessionRef, state);
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export async function sendChatMessage(
  sessionId: string,
  user: string,
  text: string,
  color: string,
  isAvatar = false
) {
  const chatRef = ref(db, `sessions/${sessionId}/chat`);
  await push(chatRef, {
    user,
    text,
    color,
    isAvatar,
    timestamp: serverTimestamp(),
  });
}

export function subscribeToChatMessages(
  sessionId: string,
  callback: (messages: ChatMessage[]) => void
) {
  const chatRef = query(
    ref(db, `sessions/${sessionId}/chat`),
    orderByChild("timestamp"),
    limitToLast(100)
  );

  const handler = (snapshot: DataSnapshot) => {
    const messages: ChatMessage[] = [];
    snapshot.forEach((child) => {
      messages.push({ id: child.key!, ...child.val() });
    });
    callback(messages);
  };

  onValue(chatRef, handler);
  return () => off(chatRef, "value", handler);
}

// ─── Q&A ──────────────────────────────────────────────────────────────────────

export async function submitQuestion(
  sessionId: string,
  user: string,
  question: string
): Promise<string> {
  const qaRef = ref(db, `sessions/${sessionId}/qa`);
  const result = await push(qaRef, {
    user,
    question,
    status: "pending",
    timestamp: serverTimestamp(),
    votes: 0,
  });
  return result.key!;
}

export async function updateQuestionStatus(
  sessionId: string,
  questionId: string,
  status: QAItem["status"],
  answer?: string
) {
  const itemRef = ref(db, `sessions/${sessionId}/qa/${questionId}`);
  await update(itemRef, { status, ...(answer ? { answer } : {}) });
}

export async function upvoteQuestion(sessionId: string, questionId: string) {
  const itemRef = ref(db, `sessions/${sessionId}/qa/${questionId}`);
  // In a real app you'd use transactions here to prevent race conditions
  await update(itemRef, { votes: Date.now() }); // Simplified
}

export function subscribeToQA(
  sessionId: string,
  callback: (items: QAItem[]) => void
) {
  const qaRef = query(
    ref(db, `sessions/${sessionId}/qa`),
    orderByChild("timestamp")
  );

  const handler = (snapshot: DataSnapshot) => {
    const items: QAItem[] = [];
    snapshot.forEach((child) => {
      items.push({ id: child.key!, ...child.val() });
    });
    callback(items.reverse()); // Newest first
  };

  onValue(qaRef, handler);
  return () => off(qaRef, "value", handler);
}

// ─── Slide Sync ───────────────────────────────────────────────────────────────

export async function broadcastSlideChange(sessionId: string, slideIndex: number) {
  const stateRef = ref(db, `sessions/${sessionId}/state`);
  await update(stateRef, { currentSlide: slideIndex });
}

export function subscribeToSlideChanges(
  sessionId: string,
  callback: (slideIndex: number) => void
) {
  const stateRef = ref(db, `sessions/${sessionId}/state`);
  const handler = (snapshot: DataSnapshot) => {
    const state = snapshot.val();
    if (state?.currentSlide !== undefined) callback(state.currentSlide);
  };
  onValue(stateRef, handler);
  return () => off(stateRef, "value", handler);
}

// ─── Viewer Count ─────────────────────────────────────────────────────────────

export function trackViewer(sessionId: string) {
  const viewerRef = ref(db, `sessions/${sessionId}/viewers/${Date.now()}`);
  push(viewerRef, { joinedAt: serverTimestamp() });
}

export function subscribeToViewerCount(
  sessionId: string,
  callback: (count: number) => void
) {
  const viewerRef = ref(db, `sessions/${sessionId}/viewers`);
  const handler = (snapshot: DataSnapshot) => {
    callback(snapshot.size || 0);
  };
  onValue(viewerRef, handler);
  return () => off(viewerRef, "value", handler);
}

export { db };
