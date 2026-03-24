import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await req.json();
  const { name, avatar, type, avatarId } = body as {
    name: string;
    avatar?: string;
    type: "human" | "ai";
    avatarId?: string;
  };

  if (!name || !type) {
    return NextResponse.json({ error: "name and type required" }, { status: 400 });
  }

  const sb = getServiceSupabase();
  const { data: room, error } = await sb
    .from("rooms")
    .select("avatar_participants, human_participants")
    .eq("id", roomId)
    .single();

  if (error || !room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const avatarParts: { id: string; name: string; avatar_url: string; role?: string }[] = room.avatar_participants || [];
  const humanParts: { name: string; avatar: string; role?: string }[] = room.human_participants || [];

  // Check if already in room
  if (type === "ai" && avatarId) {
    if (avatarParts.some((a) => a.id === avatarId)) {
      return NextResponse.json({ already: true });
    }
  } else if (type === "human") {
    if (humanParts.some((h) => h.name === name)) {
      return NextResponse.json({ already: true });
    }
  }

  const role = "speaker";

  if (type === "ai" && avatarId) {
    // Fetch avatar info if not provided
    let avatarUrl = avatar || "";
    if (!avatarUrl && avatarId) {
      const { data: av } = await sb.from("avatars").select("avatar_url").eq("id", avatarId).single();
      avatarUrl = av?.avatar_url || "";
    }
    avatarParts.push({ id: avatarId, name, avatar_url: avatarUrl, role });
    await sb.from("rooms").update({ avatar_participants: avatarParts }).eq("id", roomId);
  } else {
    humanParts.push({ name, avatar: avatar || "", role });
    await sb.from("rooms").update({ human_participants: humanParts }).eq("id", roomId);
  }

  return NextResponse.json({ role });
}
