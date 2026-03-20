import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface GenerateAnswerOptions {
  question: string;
  systemPrompt?: string;
  slideContext?: string;
  maxWords?: number;
}

export async function generateAvatarAnswer({
  question,
  systemPrompt,
  slideContext,
  maxWords = 60,
}: GenerateAnswerOptions): Promise<string> {
  const defaultSystem = `You are a professional, engaging webinar host AI avatar.
Answer questions clearly and concisely.
Keep your answer under ${maxWords} words so the avatar speech stays natural.
Be warm, authoritative, and informative.
Do NOT use markdown, bullet points, or special characters in your response — plain spoken text only.`;

  const contextBlock = slideContext
    ? `\n\nCurrent slide context: ${slideContext}`
    : "";

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 200,
    messages: [
      {
        role: "system",
        content: (systemPrompt || defaultSystem) + contextBlock,
      },
      {
        role: "user",
        content: question,
      },
    ],
    temperature: 0.7,
  });

  return completion.choices[0]?.message?.content?.trim() || "That's a great question. Let me get back to you on that shortly.";
}

interface GenerateScriptOptions {
  slideTitle: string;
  slideBullets: string[];
  durationSeconds?: number;
}

export async function generateSlideScript({
  slideTitle,
  slideBullets,
  durationSeconds = 45,
}: GenerateScriptOptions): Promise<string> {
  const wordsTarget = Math.floor(durationSeconds * 2.5); // ~150wpm speaking rate

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 300,
    messages: [
      {
        role: "system",
        content: `You are a professional presenter narrating a webinar slide.
Write a natural, spoken-word script for the following slide.
Target approximately ${wordsTarget} words — this controls how long the avatar speaks on this slide.
Write as if speaking naturally. No bullet points, no markdown. Just flowing spoken language.`,
      },
      {
        role: "user",
        content: `Slide title: ${slideTitle}\nKey points:\n${slideBullets.map((b) => `- ${b}`).join("\n")}`,
      },
    ],
    temperature: 0.7,
  });

  return (
    completion.choices[0]?.message?.content?.trim() ||
    `Let's talk about ${slideTitle}.`
  );
}
