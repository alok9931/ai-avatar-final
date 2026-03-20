import { NextRequest, NextResponse } from "next/server";
import { generateSlideScript } from "@/lib/openai";

export async function POST(req: NextRequest) {
  try {
    const { slideTitle, slideBullets, durationSeconds } = await req.json();

    if (!slideTitle) {
      return NextResponse.json({ error: "slideTitle is required" }, { status: 400 });
    }

    const script = await generateSlideScript({
      slideTitle,
      slideBullets: slideBullets || [],
      durationSeconds: durationSeconds || 45,
    });

    return NextResponse.json({ script });
  } catch (err: any) {
    console.error("Script API error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate script" },
      { status: 500 }
    );
  }
}
