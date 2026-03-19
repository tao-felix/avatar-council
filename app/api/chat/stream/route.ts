import { NextRequest } from "next/server";
import { chatStream } from "@/lib/secondme";

export async function POST(req: NextRequest) {
  const { message, sessionId, systemPrompt, accessToken } = await req.json();

  const token = accessToken || req.cookies.get("sm_token")?.value;
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const response = await chatStream(token, message, sessionId, systemPrompt);

  // Forward SSE stream
  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
