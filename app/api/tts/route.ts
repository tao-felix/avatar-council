import { NextRequest, NextResponse } from "next/server";
import { generateTTS } from "@/lib/secondme";
import { getServiceSupabase } from "@/lib/supabase";
import { log } from "@/lib/logger";

async function resolveToken(avatarId?: string, cookie?: string): Promise<string | null> {
  if (avatarId) {
    const sb = getServiceSupabase();
    const { data } = await sb.from("avatars").select("access_token").eq("id", avatarId).single();
    return data?.access_token || null;
  }
  return cookie || null;
}

export async function POST(req: NextRequest) {
  const { text, avatarId } = await req.json();
  log("tts", "request", { avatarId, textLen: text?.length, textPreview: text?.slice(0, 50) });

  const token = await resolveToken(avatarId, req.cookies.get("sm_token")?.value);
  if (!token) {
    log("tts", "no token", { avatarId });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await generateTTS(token, text);
    const hasUrl = !!(result?.data?.audioUrl || result?.data?.url);
    log("tts", "result", { hasUrl, avatarId });
    return NextResponse.json(result);
  } catch (err) {
    log("tts", "error", { avatarId, error: String(err) });
    return NextResponse.json({ error: "TTS failed" }, { status: 500 });
  }
}
