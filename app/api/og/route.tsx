import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_KEY || ""
  );
}

export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get("roomId");

  if (!roomId) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #1a120b 0%, #2a1f15 50%, #1a120b 100%)",
          }}
        >
          <div style={{ fontSize: 80, display: "flex" }}>🔥</div>
          <div style={{ fontSize: 52, fontWeight: 700, color: "#FFF8F0", marginBottom: 12, display: "flex" }}>
            分身篝火会
          </div>
          <div style={{ fontSize: 24, color: "#F4A261", opacity: 0.6, display: "flex" }}>
            召唤 AI 分身围坐篝火，一起聊天碰撞共创
          </div>
          <div style={{ fontSize: 16, color: "#FFF8F0", opacity: 0.2, marginTop: 24, display: "flex" }}>
            avatar-council.vercel.app
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  // Dynamic OG for a specific room
  try {
    const sb = getSupabase();
    const { data: room } = await sb
      .from("rooms")
      .select("topic, avatar_participants, human_participants, status")
      .eq("id", roomId)
      .single();

    if (!room) {
      return new ImageResponse(
        (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1a120b", color: "#FFF8F0", fontSize: 32 }}>
            篝火不存在
          </div>
        ),
        { width: 1200, height: 630 }
      );
    }

    const avatars = (room.avatar_participants || []) as { name: string; avatar_url: string }[];
    const humans = (room.human_participants || []) as { name: string }[];
    const isActive = room.status === "active";
    const participantNames = [...avatars.map((a) => a.name), ...humans.map((h) => h.name)].slice(0, 6);

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            background: "linear-gradient(135deg, #1a120b 0%, #2a1f15 40%, #1a120b 100%)",
            padding: "60px 80px",
          }}
        >
          {/* Top: brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40 }}>
            <div style={{ fontSize: 28, display: "flex" }}>🔥</div>
            <div style={{ fontSize: 20, color: "#F4A261", opacity: 0.5, fontWeight: 500, display: "flex" }}>
              分身篝火会
            </div>
            {isActive && (
              <div style={{ fontSize: 14, color: "#4CAF50", opacity: 0.8, marginLeft: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: "#4CAF50", display: "flex" }} />
                讨论中
              </div>
            )}
          </div>

          {/* Topic */}
          <div style={{ fontSize: 48, fontWeight: 700, color: "#FFF8F0", lineHeight: 1.3, marginBottom: 32, display: "flex" }}>
            {room.topic.length > 40 ? room.topic.slice(0, 40) + "…" : room.topic}
          </div>

          {/* Participants */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: "auto" }}>
            <div style={{ fontSize: 18, color: "#FFF8F0", opacity: 0.4, display: "flex" }}>
              {participantNames.join("、")}
            </div>
          </div>

          {/* CTA hint */}
          <div style={{ fontSize: 16, color: "#F4A261", opacity: 0.4, display: "flex", marginTop: 20, marginLeft: "auto" }}>
            点击加入篝火 →
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  } catch {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1a120b", color: "#FFF8F0", fontSize: 32 }}>
          分身篝火会
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }
}
