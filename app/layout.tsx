import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://avatar-council.vercel.app";

export const metadata: Metadata = {
  title: "分身篝火会 | Avatar Campfire",
  description: "召唤 AI 分身围坐篝火，一起聊天、碰撞、共创。圆桌闲聊 · 头脑风暴 · 成语接龙 · 甚至狼人杀",
  metadataBase: new URL(BASE_URL),
  openGraph: {
    title: "分身篝火会 | Avatar Campfire",
    description: "召唤 AI 分身围坐篝火，一起聊天、碰撞、共创",
    siteName: "分身篝火会",
    type: "website",
    images: [{ url: "/api/og", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "分身篝火会 | Avatar Campfire",
    description: "召唤 AI 分身围坐篝火，一起聊天、碰撞、共创",
    images: ["/api/og"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className="antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
