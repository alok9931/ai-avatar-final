import { NextResponse } from "next/server";

export async function POST() {
  try {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "HEYGEN_API_KEY not configured" }, { status: 500 });
    }

    const res = await fetch("https://api.heygen.com/v1/streaming.create_token", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    if (!res.ok || !data.data?.token) {
      return NextResponse.json(
        { error: data.message || "Failed to get HeyGen token" },
        { status: res.status }
      );
    }

    return NextResponse.json({ token: data.data.token });
  } catch (err: any) {
    console.error("HeyGen token error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
