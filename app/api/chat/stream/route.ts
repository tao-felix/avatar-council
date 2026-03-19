import { NextRequest } from "next/server";
import { chatStream } from "@/lib/secondme";
import { getServiceSupabase } from "@/lib/supabase";

async function resolveToken(avatarId?: string, cookie?: string): Promise<string | null> {
  if (avatarId) {
    const sb = getServiceSupabase();
    const { data } = await sb.from("avatars").select("access_token").eq("id", avatarId).single();
    return data?.access_token || null;
  }
  return cookie || null;
}

export async function POST(req: NextRequest) {
  const { message, sessionId, systemPrompt, avatarId } = await req.json();

  const token = await resolveToken(avatarId, req.cookies.get("sm_token")?.value);
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const response = await chatStream(token, message, sessionId, systemPrompt);

  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
