import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { reportHumanSpeech, reportAvatarSpeech } from "@/lib/agent-memory";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("room_messages")
    .select("id, room_id, sender_id, sender_name, sender_type, content, tts_audio_url, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data || []);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await req.json();
  const { sender_id, sender_name, sender_type, content, tts_audio_url } = body;

  if (!sender_id || !sender_name || !sender_type || !content) {
    return NextResponse.json({ error: "sender_id, sender_name, sender_type, and content are required" }, { status: 400 });
  }

  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("room_messages")
    .insert({
      room_id: roomId,
      sender_id,
      sender_name,
      sender_type,
      content,
      tts_audio_url: tts_audio_url || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Agent Memory: report speech event (fire-and-forget)
  (async () => {
    try {
      const { data: room } = await sb.from("rooms").select("topic").eq("id", roomId).single();
      const topic = room?.topic || "未知话题";
      const msgId = String(data.id);

      if (sender_type === "human") {
        const smToken = req.cookies.get("sm_token")?.value;
        console.log(`[agent-memory] human speech: token=${smToken ? "present" : "missing"}, msgId=${msgId}`);
        if (smToken) {
          await reportHumanSpeech(smToken, { roomId, topic, messageId: msgId, senderName: sender_name, content });
        }
      } else if (sender_type === "ai") {
        const { data: avatar } = await sb.from("avatars").select("access_token").eq("id", sender_id).single();
        if (avatar?.access_token) {
          await reportAvatarSpeech(avatar.access_token, { roomId, topic, messageId: msgId, avatarName: sender_name, content });
        }
      }
    } catch { /* agent memory reporting is non-critical */ }
  })();

  return NextResponse.json(data);
}

// PATCH — update a message's tts_audio_url
// Supports two modes:
//   { messageId, tts_audio_url } — update by specific message ID
//   { lastHumanAudioUrl } — update the last human message in this room
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await req.json();
  const sb = getServiceSupabase();

  if (body.messageId) {
    const { error } = await sb
      .from("room_messages")
      .update({ tts_audio_url: body.tts_audio_url })
      .eq("id", body.messageId)
      .eq("room_id", roomId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.lastHumanAudioUrl) {
    const { data: msgs } = await sb
      .from("room_messages")
      .select("id")
      .eq("room_id", roomId)
      .eq("sender_type", "human")
      .order("created_at", { ascending: false })
      .limit(1);
    if (!msgs || msgs.length === 0) {
      return NextResponse.json({ error: "No human message found" }, { status: 404 });
    }
    const { error } = await sb
      .from("room_messages")
      .update({ tts_audio_url: body.lastHumanAudioUrl })
      .eq("id", msgs[0].id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "messageId or lastHumanAudioUrl required" }, { status: 400 });
}
