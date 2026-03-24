import type { Metadata } from "next";
import { getServiceSupabase } from "@/lib/supabase";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://avatar-council.vercel.app";

export async function generateMetadata(
  { params }: { params: Promise<{ roomId: string }> }
): Promise<Metadata> {
  const { roomId } = await params;

  try {
    const sb = getServiceSupabase();
    const { data: room } = await sb
      .from("rooms")
      .select("topic, avatar_participants, human_participants, status")
      .eq("id", roomId)
      .single();

    if (!room) {
      return { title: "篝火不存在 | 分身篝火会" };
    }

    const avatars = (room.avatar_participants || []) as { name: string }[];
    const humans = (room.human_participants || []) as { name: string }[];
    const names = [...avatars.map((a) => a.name), ...humans.map((h) => h.name)].slice(0, 4);
    const isActive = room.status === "active";
    const statusText = isActive ? "🔥 讨论中" : "已结束";
    const description = `${statusText} — ${names.join("、")}${names.length < avatars.length + humans.length ? " 等" : ""} 正在围炉而谈`;
    const ogImage = `${BASE_URL}/api/og?roomId=${roomId}`;

    return {
      title: `${room.topic} | 分身篝火会`,
      description,
      openGraph: {
        title: `${room.topic} | 分身篝火会`,
        description,
        type: "article",
        images: [{ url: ogImage, width: 1200, height: 630 }],
      },
      twitter: {
        card: "summary_large_image",
        title: `${room.topic} | 分身篝火会`,
        description,
        images: [ogImage],
      },
    };
  } catch {
    return { title: "分身篝火会" };
  }
}

export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
