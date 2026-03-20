import { NextRequest, NextResponse } from "next/server";
import { generateAvatarAnswer } from "@/lib/openai";

export async function POST(req: NextRequest) {
  try {
    const { question, slideContext, systemPrompt } = await req.json();

    if (!question || typeof question !== "string") {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }

    const answer = await generateAvatarAnswer({
      question,
      slideContext,
      systemPrompt: systemPrompt || process.env.NEXT_PUBLIC_AVATAR_PERSONA,
      maxWords: 70,
    });

    return NextResponse.json({ answer });
  } catch (err: any) {
    console.error("Answer API error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate answer" },
      { status: 500 }
    );
  }
}
