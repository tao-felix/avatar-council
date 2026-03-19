"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; avatar: string } | null>(null);
  const [topic, setTopic] = useState("");
  const [joining, setJoining] = useState(false);
  const [roomCode, setRoomCode] = useState("");

  useEffect(() => {
    const raw = getCookie("sm_user");
    if (raw) {
      try { setUser(JSON.parse(raw)); } catch { /* ignore */ }
    }
  }, []);

  const createRoom = () => {
    if (!topic.trim()) return;
    // Generate a simple room ID
    const roomId = Math.random().toString(36).substring(2, 8);
    // Store topic in sessionStorage for the room to pick up
    sessionStorage.setItem(`room_${roomId}`, JSON.stringify({ topic, createdBy: user?.name || "Host" }));
    router.push(`/room/${roomId}`);
  };

  const joinRoom = () => {
    if (!roomCode.trim()) return;
    router.push(`/room/${roomCode.trim()}`);
  };

  return (
    <main className="h-screen flex flex-col items-center justify-center px-6">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-[#9B5DE5]/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-[#F4A261]/8 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 text-center max-w-md w-full">
        {/* Logo / Title */}
        <div className="mb-2 flex items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#9B5DE5]/60 animate-breathe" />
          <div className="w-8 h-8 rounded-full bg-[#F4A261]/60 animate-breathe" style={{ animationDelay: "0.5s" }} />
        </div>
        <h1 className="text-4xl font-bold mb-2 tracking-tight">分身议事</h1>
        <p className="text-[#FFF8F0]/50 text-sm mb-10">
          召唤 AI 分身，一起语音讨论
        </p>

        {/* Auth status */}
        {!user ? (
          <a
            href="/api/auth/login"
            className="inline-block px-8 py-3 rounded-full bg-[#9B5DE5] text-white font-medium hover:bg-[#8a4dd4] transition-colors"
          >
            登录 SecondMe
          </a>
        ) : (
          <div className="space-y-6">
            <p className="text-[#FFF8F0]/40 text-xs">
              Hi, {user.name}
            </p>

            {!joining ? (
              <>
                {/* Create room */}
                <div className="space-y-3">
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="今天聊什么？"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-[#FFF8F0] placeholder:text-[#FFF8F0]/25 outline-none focus:border-[#F4A261]/40 transition-colors text-center"
                    onKeyDown={(e) => e.key === "Enter" && createRoom()}
                  />
                  <button
                    onClick={createRoom}
                    disabled={!topic.trim()}
                    className="w-full py-3.5 rounded-2xl bg-[#F4A261] text-[#1a1412] font-medium disabled:opacity-30 hover:bg-[#e5934f] transition-colors"
                  >
                    创建会议
                  </button>
                </div>

                <button
                  onClick={() => setJoining(true)}
                  className="text-[#FFF8F0]/30 text-sm hover:text-[#FFF8F0]/60 transition-colors"
                >
                  加入已有会议
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  placeholder="输入房间号"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-[#FFF8F0] placeholder:text-[#FFF8F0]/25 outline-none focus:border-[#9B5DE5]/40 transition-colors text-center"
                  onKeyDown={(e) => e.key === "Enter" && joinRoom()}
                />
                <button
                  onClick={joinRoom}
                  disabled={!roomCode.trim()}
                  className="w-full py-3.5 rounded-2xl bg-[#9B5DE5] text-white font-medium disabled:opacity-30 hover:bg-[#8a4dd4] transition-colors"
                >
                  加入会议
                </button>
                <button
                  onClick={() => setJoining(false)}
                  className="text-[#FFF8F0]/30 text-sm hover:text-[#FFF8F0]/60 transition-colors"
                >
                  返回
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
