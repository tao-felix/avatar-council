import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

const MAX_SPEAKERS = 8;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await req.json();
  const { name, type, role } = body as {
    name: string;
    type: "human" | "ai";
    role: "speaker" | "audience";
  };

  if (!name || !type || !role) {
    return NextResponse.json({ error: "name, type, and role required" }, { status: 400 });
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

  // If promoting to speaker, check limit
  if (role === "speaker") {
    const speakerCount =
      avatarParts.filter((a) => (a.role || "speaker") === "speaker").length +
      humanParts.filter((h) => (h.role || "speaker") === "speaker").length;
    if (speakerCount >= MAX_SPEAKERS) {
      return NextResponse.json({ error: "Speaker seats full (max 8)" }, { status: 409 });
    }
  }

  if (type === "ai") {
    const idx = avatarParts.findIndex((a) => a.name === name);
    if (idx >= 0) {
      avatarParts[idx] = { ...avatarParts[idx], role };
      await sb.from("rooms").update({ avatar_participants: avatarParts }).eq("id", roomId);
    }
  } else {
    const idx = humanParts.findIndex((h) => h.name === name);
    if (idx >= 0) {
      humanParts[idx] = { ...humanParts[idx], role };
      await sb.from("rooms").update({ human_participants: humanParts }).eq("id", roomId);
    }
  }

  return NextResponse.json({ ok: true, role });
}
