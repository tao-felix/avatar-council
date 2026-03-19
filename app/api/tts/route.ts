import { NextRequest, NextResponse } from "next/server";
import { generateTTS } from "@/lib/secondme";
import { getServiceSupabase } from "@/lib/supabase";

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

  const token = await resolveToken(avatarId, req.cookies.get("sm_token")?.value);
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
