import { NextRequest, NextResponse } from "next/server";
import { generateTTS } from "@/lib/secondme";

export async function POST(req: NextRequest) {
  const { text, accessToken } = await req.json();

  const token = accessToken || req.cookies.get("sm_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await generateTTS(token, text);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "TTS failed" }, { status: 500 });
  }
}
