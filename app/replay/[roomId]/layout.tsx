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
      .select("topic, avatar_participants, human_participants")
      .eq("id", roomId)
      .single();

    if (!room) {
      return { title: "回放 | 分身篝火会" };
    }

    const avatars = (room.avatar_participants || []) as { name: string }[];
    const humans = (room.human_participants || []) as { name: string }[];
    const names = [...avatars.map((a) => a.name), ...humans.map((h) => h.name)].slice(0, 4);
    const description = `回放 — ${names.join("、")} 的篝火讨论`;
    const ogImage = `${BASE_URL}/api/og?roomId=${roomId}`;

    return {
      title: `${room.topic} 回放 | 分身篝火会`,
      description,
      openGraph: {
        title: `${room.topic} 回放 | 分身篝火会`,
        description,
        images: [{ url: ogImage, width: 1200, height: 630 }],
      },
    };
  } catch {
    return { title: "回放 | 分身篝火会" };
  }
}

export default function ReplayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
