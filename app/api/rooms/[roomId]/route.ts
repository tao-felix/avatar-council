import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const sb = getServiceSupabase();

  // Auto-end rooms older than 24 hours
  const oneHourAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await sb
    .from("rooms")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", roomId)
    .eq("status", "active")
    .is("ended_at", null)
    .lt("started_at", oneHourAgo);

  const { data, error } = await sb
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await req.json();
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("rooms")
    .update(body)
    .eq("id", roomId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
