import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const userName = req.nextUrl.searchParams.get("userName");
  if (!userName) return NextResponse.json([]);

  const sb = getServiceSupabase();
  const { data } = await sb
    .from("avatar_likes")
    .select("avatar_id")
    .eq("user_name", userName);

  return NextResponse.json((data || []).map((d) => d.avatar_id));
}

export async function POST(req: NextRequest) {
  const { avatarId, userName } = await req.json();
  if (!avatarId || !userName) {
    return NextResponse.json({ error: "avatarId and userName required" }, { status: 400 });
  }

  const sb = getServiceSupabase();

  const { data: existing } = await sb
    .from("avatar_likes")
    .select("id")
    .eq("avatar_id", avatarId)
    .eq("user_name", userName)
    .maybeSingle();

  if (existing) {
    await sb.from("avatar_likes").delete().eq("id", existing.id);
    const { data: avatar } = await sb.from("avatars").select("likes").eq("id", avatarId).single();
    const newLikes = Math.max(0, (avatar?.likes || 1) - 1);
    await sb.from("avatars").update({ likes: newLikes }).eq("id", avatarId);
    return NextResponse.json({ liked: false, likes: newLikes });
  } else {
    await sb.from("avatar_likes").insert({ avatar_id: avatarId, user_name: userName });
    const { data: avatar } = await sb.from("avatars").select("likes").eq("id", avatarId).single();
    const newLikes = (avatar?.likes || 0) + 1;
    await sb.from("avatars").update({ likes: newLikes }).eq("id", avatarId);
    return NextResponse.json({ liked: true, likes: newLikes });
  }
}
