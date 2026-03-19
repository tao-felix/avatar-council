import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET() {
  const sb = getServiceSupabase();

  // Auto-end stale rooms (>6h active with no ended_at)
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  await sb
    .from("rooms")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("status", "active")
    .is("ended_at", null)
    .lt("started_at", sixHoursAgo);

  const { data, error } = await sb
    .from("rooms")
    .select("id, topic, created_by, status, started_at, ended_at, avatar_participants, human_participants")
    .order("started_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { id, topic, createdBy, avatarParticipants, humanParticipants } = body;

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
      avatar_participants: avatarParticipants || [],
      human_participants: humanParticipants || [],
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
