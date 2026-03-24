import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await req.json();
  const { name, type, requestedBy } = body as {
    name: string;
    type: "human" | "ai";
    requestedBy: string;
  };

  if (!name || !type || !requestedBy) {
    return NextResponse.json({ error: "name, type, and requestedBy required" }, { status: 400 });
  }

  const sb = getServiceSupabase();
  const { data: room, error } = await sb
    .from("rooms")
    .select("avatar_participants, human_participants, host_name")
    .eq("id", roomId)
    .single();

  if (error || !room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  // Only host can kick others; anyone can remove themselves
  if (room.host_name !== requestedBy && name !== requestedBy) {
    return NextResponse.json({ error: "Only the host can kick participants" }, { status: 403 });
  }

  const avatarParts: { id: string; name: string; avatar_url: string; role?: string }[] = room.avatar_participants || [];
  const humanParts: { name: string; avatar: string; role?: string }[] = room.human_participants || [];
  const updates: Record<string, unknown> = {};

  if (type === "ai") {
    const filtered = avatarParts.filter((a) => a.name !== name);
    if (filtered.length === avatarParts.length) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }
    updates.avatar_participants = filtered;
  } else {
    const filtered = humanParts.filter((h) => h.name !== name);
    if (filtered.length === humanParts.length) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }
    updates.human_participants = filtered;

    // If host is kicking themselves (leaving), transfer host to next human
    if (name === requestedBy && filtered.length > 0) {
      updates.host_name = filtered[0].name;
    } else if (name === requestedBy && filtered.length === 0) {
      updates.host_name = null;
    }
  }

  await sb.from("rooms").update(updates).eq("id", roomId);

  return NextResponse.json({ ok: true, newHost: updates.host_name });
}
