import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

// GET - list all avatars (without tokens for security)
export async function GET() {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("avatars")
    .select("id, name, avatar_url, route, likes, created_at")
    .order("likes", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// POST - upsert an avatar (called after OAuth login)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, avatar_url, route, access_token } = body;

  if (!name || !access_token) {
    return NextResponse.json({ error: "name and access_token required" }, { status: 400 });
  }

  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("avatars")
    .upsert(
      { name, avatar_url: avatar_url || "", route: route || "", access_token, updated_at: new Date().toISOString() },
      { onConflict: "name,route" }
    )
    .select("id, name, avatar_url, route")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// DELETE - remove an avatar
export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const sb = getServiceSupabase();
  const { error } = await sb.from("avatars").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
