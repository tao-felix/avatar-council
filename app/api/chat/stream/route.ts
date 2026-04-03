import { NextRequest } from "next/server";
import { chatStream } from "@/lib/secondme";
import { getServiceSupabase } from "@/lib/supabase";
import { log } from "@/lib/logger";

async function resolveToken(avatarId?: string, cookie?: string): Promise<string | null> {
  if (avatarId) {
    const sb = getServiceSupabase();
    const { data, error } = await sb.from("avatars").select("access_token").eq("id", avatarId).single();
    log("chat/stream", "resolveToken", { avatarId, hasData: !!data, hasToken: !!data?.access_token, tokenLen: data?.access_token?.length, error: error?.message });
    return data?.access_token || null;
  }
  return cookie || null;
}

export async function POST(req: NextRequest) {
  const { message, sessionId, systemPrompt, avatarId } = await req.json();
  log("chat/stream", "request", { avatarId, messageLen: message?.length, hasSession: !!sessionId });

  const token = await resolveToken(avatarId, req.cookies.get("sm_token")?.value);
  if (!token) {
    // Debug: try direct query to see what's in DB
    const sb = getServiceSupabase();
    const { data: dbg, error: dbgErr } = await sb.from("avatars").select("id, name, access_token").eq("id", avatarId || "").single();
    log("chat/stream", "no token", { avatarId, dbgHasRow: !!dbg, dbgTokenLen: dbg?.access_token?.length, dbgErr: dbgErr?.message });
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const response = await chatStream(token, message, sessionId, systemPrompt);
    log("chat/stream", "response", { status: response.status, ok: response.ok });
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    log("chat/stream", "error", { error: String(err) });
    return new Response("Stream error", { status: 500 });
  }
}
