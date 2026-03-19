import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

// GET token for a specific avatar (server-side only, used by chat/tts APIs)
export async function GET(req: NextRequest) {
  const avatarId = req.nextUrl.searchParams.get("id");
  if (!avatarId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("avatars")
    .select("access_token")
    .eq("id", avatarId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  }

  return NextResponse.json({ token: data.access_token });
}
