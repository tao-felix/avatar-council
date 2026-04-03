import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { reportRoomCreated } from "@/lib/agent-memory";

export async function GET(req: NextRequest) {
  const sb = getServiceSupabase();
  const isPublic = req.nextUrl.searchParams.get("public") === "true";

  // Auto-end stale rooms (>24h active with no ended_at)
  const sixHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await sb
    .from("rooms")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("status", "active")
    .is("ended_at", null)
    .lt("started_at", sixHoursAgo);

  let query = sb
    .from("rooms")
    .select("id, topic, created_by, status, started_at, ended_at, is_public, avatar_participants, human_participants, view_count")
    .order("started_at", { ascending: false })
    .limit(50);

  if (isPublic) {
    query = query.eq("is_public", true).eq("status", "active");
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Attach message_count for each room
  const rooms = data || [];
  if (rooms.length > 0) {
    const roomIds = rooms.map((r: { id: string }) => r.id);
    const { data: counts } = await sb
      .from("room_messages")
      .select("room_id")
      .in("room_id", roomIds);

    const countMap: Record<string, number> = {};
    (counts || []).forEach((c: { room_id: string }) => {
      countMap[c.room_id] = (countMap[c.room_id] || 0) + 1;
    });

    rooms.forEach((r: { id: string; message_count?: number }) => {
      r.message_count = countMap[r.id] || 0;
    });
  }

  return NextResponse.json(rooms);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { id, topic, createdBy, avatarParticipants, humanParticipants, isPublic, scene } = body;

  if (!id || !topic) {
    return NextResponse.json({ error: "id and topic required" }, { status: 400 });
  }

  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("rooms")
    .insert({
      id,
      topic,
      created_by: createdBy || "Host",
      avatar_participants: (avatarParticipants || []).map((a: { id: string; name: string; avatar_url: string }) => ({ ...a, role: "speaker" })),
      human_participants: (humanParticipants || []).map((h: { name: string; avatar: string }) => ({ ...h, role: "speaker" })),
      is_public: isPublic !== false,
      scene: scene || "campfire",
      host_name: createdBy || "Host",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Agent Memory: report room creation
  const smToken = req.cookies.get("sm_token")?.value;
  if (smToken) {
    reportRoomCreated(smToken, {
      roomId: id,
      topic,
      createdBy: createdBy || "Host",
    }).catch(() => {});
  }

  return NextResponse.json(data);
}
