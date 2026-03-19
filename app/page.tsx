"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

export interface AvatarInfo {
  id: string;
  name: string;
  avatar_url: string;
  route: string;
  likes: number;
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; avatar: string; route?: string } | null>(null);
  const [topic, setTopic] = useState("");
  const [joining, setJoining] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [avatars, setAvatars] = useState<AvatarInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const raw = getCookie("sm_user");
    if (raw) {
      try { setUser(JSON.parse(raw)); } catch { /* */ }
    }

    fetch("/api/avatars")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setAvatars(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Load user's liked avatars
  useEffect(() => {
    if (!user?.name) return;
    fetch(`/api/avatars/like?userName=${encodeURIComponent(user.name)}`)
      .then((r) => r.json())
      .then((ids) => { if (Array.isArray(ids)) setLikedIds(new Set(ids)); })
      .catch(() => {});
  }, [user?.name]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleLike = async (avatarId: string) => {
    if (!user?.name) return;
    // Optimistic update
    const wasLiked = likedIds.has(avatarId);
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (wasLiked) next.delete(avatarId); else next.add(avatarId);
      return next;
    });
    setAvatars((prev) =>
      prev.map((a) =>
        a.id === avatarId ? { ...a, likes: a.likes + (wasLiked ? -1 : 1) } : a
      )
    );

    const res = await fetch("/api/avatars/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarId, userName: user.name }),
    });
    const result = await res.json();
    // Sync actual value
    setAvatars((prev) =>
      prev.map((a) => (a.id === avatarId ? { ...a, likes: result.likes } : a))
    );
  };

  const filteredAvatars = avatars
    .filter((a) => !search || a.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.likes - a.likes);

  const createRoom = async () => {
    if (!topic.trim() || creating) return;
    setCreating(true);
    const roomId = Math.random().toString(36).substring(2, 8);
    const selectedAvatars = avatars.filter((a) => selected.has(a.id));

    try {
      await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: roomId,
          topic: topic.trim(),
          createdBy: user?.name || "Host",
          avatarParticipants: selectedAvatars.map((a) => ({ id: a.id, name: a.name, avatar_url: a.avatar_url })),
          humanParticipants: user ? [{ name: user.name, avatar: user.avatar }] : [],
        }),
      });
      router.push(`/room/${roomId}`);
    } catch {
      setCreating(false);
    }
  };

  const joinRoom = () => {
    if (!roomCode.trim()) return;
    router.push(`/room/${roomCode.trim()}`);
  };

  return (
    <main className="h-screen flex flex-col items-center justify-center px-6 bg-[#FEF3E2] relative overflow-hidden">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-[#9B5DE5]/6 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/3 right-1/4 w-72 h-72 bg-[#F4A261]/8 rounded-full blur-[80px]" />
      </div>

      {/* Top bar with drawer toggle */}
      {user && (
        <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-5 py-3">
          <p className="text-[#3D2C1E]/40 text-xs">
            Hi, {user.name}
            <button
              onClick={() => {
                document.cookie = "sm_token=; max-age=0; path=/";
                document.cookie = "sm_user=; max-age=0; path=/";
                setUser(null);
              }}
              className="ml-2 text-[#3D2C1E]/20 hover:text-[#3D2C1E]/50 transition-colors underline"
            >
              登出
            </button>
          </p>
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/50 hover:bg-white/70 text-[#9B5DE5]/60 hover:text-[#9B5DE5] text-xs transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            分身 {avatars.length > 0 && <span className="text-[#3D2C1E]/25">{avatars.length}</span>}
          </button>
        </div>
      )}

      {/* Right drawer — avatar list */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/10" />
          <div
            className="absolute top-0 right-0 bottom-0 w-72 bg-[#FEF3E2]/95 backdrop-blur-xl shadow-2xl shadow-black/10 animate-slide-in-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-[#3D2C1E]/70">分身列表</h3>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="text-[#3D2C1E]/20 hover:text-[#3D2C1E]/50 transition-colors text-lg"
                >
                  ×
                </button>
              </div>

              {/* Search */}
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索分身..."
                className="w-full bg-white/60 border border-[#9B5DE5]/10 rounded-xl px-3 py-2 text-sm text-[#3D2C1E] placeholder:text-[#3D2C1E]/20 outline-none focus:border-[#9B5DE5]/30 mb-3"
              />

              {/* Avatar list */}
              <div className="flex-1 overflow-y-auto space-y-1.5 -mx-1 px-1">
                {loading ? (
                  <p className="text-[#3D2C1E]/20 text-xs text-center py-4">加载中...</p>
                ) : filteredAvatars.length === 0 ? (
                  <p className="text-[#3D2C1E]/20 text-xs text-center py-4">暂无分身</p>
                ) : (
                  filteredAvatars.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-white/40 hover:bg-white/60 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-full bg-[#9B5DE5]/12 flex items-center justify-center text-xs font-bold text-[#9B5DE5]/50 shrink-0 overflow-hidden">
                        {a.avatar_url ? (
                          <img src={a.avatar_url} alt={a.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          a.name[0]
                        )}
                      </div>
                      <span className="text-sm text-[#3D2C1E]/60 flex-1 truncate">{a.name}</span>
                      <button
                        onClick={() => toggleLike(a.id)}
                        className="flex items-center gap-1 text-xs transition-colors shrink-0"
                      >
                        <span className={likedIds.has(a.id) ? "text-red-400" : "text-[#3D2C1E]/20 hover:text-red-300"}>
                          {likedIds.has(a.id) ? "♥" : "♡"}
                        </span>
                        {a.likes > 0 && (
                          <span className="text-[#3D2C1E]/25">{a.likes}</span>
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 text-center max-w-sm w-full">
        {/* Logo */}
        <div className="mb-3 flex items-center justify-center gap-2">
          <div className="w-11 h-11 rounded-full bg-[#9B5DE5]/50 animate-breathe" />
          <div className="w-9 h-9 rounded-full bg-[#F4A261]/50 animate-breathe" style={{ animationDelay: "0.5s" }} />
        </div>
        <h1 className="text-3xl font-bold mb-1 text-[#3D2C1E] tracking-tight">分身议事</h1>
        <p className="text-[#3D2C1E]/40 text-sm mb-8">
          召唤 AI 分身，一起语音讨论
        </p>

        {!user ? (
          <a
            href="/api/auth/login"
            className="inline-block px-8 py-3 rounded-full bg-[#9B5DE5] text-white font-medium hover:bg-[#8a4dd4] transition-colors shadow-lg shadow-[#9B5DE5]/20"
          >
            登录 SecondMe
          </a>
        ) : (
          <div className="space-y-5">
            {!joining ? (
              <>
                {/* Topic + avatar selection + create */}
                <div className="space-y-3">
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="今天聊什么？"
                    className="w-full bg-white/60 border border-[#F4A261]/20 rounded-2xl px-5 py-3.5 text-[#3D2C1E] placeholder:text-[#3D2C1E]/25 outline-none focus:border-[#F4A261]/50 focus:bg-white/80 transition-all text-center shadow-sm"
                    onKeyDown={(e) => e.key === "Enter" && createRoom()}
                  />

                  {/* Avatar selection */}
                  {avatars.length > 0 && (
                    <div className="bg-white/30 rounded-2xl p-2.5 space-y-1.5 text-left max-h-40 overflow-y-auto">
                      <p className="text-[10px] text-[#9B5DE5]/40 font-medium px-1">选择参会分身</p>
                      {avatars.map((a) => (
                        <div
                          key={a.id}
                          onClick={() => toggleSelect(a.id)}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                            selected.has(a.id) ? "bg-[#9B5DE5]/8" : "hover:bg-white/40"
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border-[1.5px] flex items-center justify-center transition-colors shrink-0 ${
                            selected.has(a.id) ? "bg-[#9B5DE5] border-[#9B5DE5]" : "border-[#3D2C1E]/15"
                          }`}>
                            {selected.has(a.id) && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>
                          <div className="w-6 h-6 rounded-full bg-[#9B5DE5]/10 flex items-center justify-center text-[10px] font-bold text-[#9B5DE5]/50 shrink-0 overflow-hidden">
                            {a.avatar_url ? (
                              <img src={a.avatar_url} alt={a.name} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              a.name[0]
                            )}
                          </div>
                          <span className="text-xs text-[#3D2C1E]/50 flex-1 truncate">{a.name}</span>
                          {a.likes > 0 && (
                            <span className="text-[10px] text-red-300/50">♥ {a.likes}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={createRoom}
                    disabled={!topic.trim() || creating}
                    className="w-full py-3.5 rounded-2xl bg-[#F4A261] text-white font-medium disabled:opacity-30 hover:bg-[#e5934f] transition-colors shadow-md shadow-[#F4A261]/20"
                  >
                    {creating ? "创建中..." : `创建会议${selected.size > 0 ? ` (${selected.size} 个分身)` : ""}`}
                  </button>
                </div>

                <button
                  onClick={() => setJoining(true)}
                  className="text-[#3D2C1E]/25 text-sm hover:text-[#3D2C1E]/50 transition-colors"
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
                  className="w-full bg-white/60 border border-[#9B5DE5]/20 rounded-2xl px-5 py-3.5 text-[#3D2C1E] placeholder:text-[#3D2C1E]/25 outline-none focus:border-[#9B5DE5]/50 focus:bg-white/80 transition-all text-center shadow-sm"
                  onKeyDown={(e) => e.key === "Enter" && joinRoom()}
                />
                <button
                  onClick={joinRoom}
                  disabled={!roomCode.trim()}
                  className="w-full py-3.5 rounded-2xl bg-[#9B5DE5] text-white font-medium disabled:opacity-30 hover:bg-[#8a4dd4] transition-colors shadow-md shadow-[#9B5DE5]/20"
                >
                  加入会议
                </button>
                <button
                  onClick={() => setJoining(false)}
                  className="text-[#3D2C1E]/25 text-sm hover:text-[#3D2C1E]/50 transition-colors"
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
