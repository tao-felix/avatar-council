import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "分身议事 | Avatar Council",
  description: "召唤 AI 分身加入语音会议，与真人一起讨论",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className="antialiased">{children}</body>
    </html>
  );
}
