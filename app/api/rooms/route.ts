import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

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
