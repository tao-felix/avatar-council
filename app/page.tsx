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

interface RoomInfo {
  id: string;
  topic: string;
  created_by: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  is_public: boolean;
  avatar_participants: { id: string; name: string; avatar_url: string }[];
  human_participants: { name: string; avatar: string }[];
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
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
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [publicRooms, setPublicRooms] = useState<RoomInfo[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomTab, setRoomTab] = useState<"discover" | "my">("discover");
  const [isPublicRoom, setIsPublicRoom] = useState(true);
  const [topicFocused, setTopicFocused] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const raw = getCookie("sm_user");
    if (raw) {
      try { setUser(JSON.parse(raw)); } catch { /* */ }
      if (!localStorage.getItem("avatar_council_onboarded")) {
        setShowOnboarding(true);
      }
    }

    fetch("/api/avatars")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setAvatars(data); })
      .catch(() => {})
      .finally(() => setLoading(false));

    Promise.all([
      fetch("/api/rooms").then((r) => r.json()),
      fetch("/api/rooms?public=true").then((r) => r.json()),
    ])
      .then(([allData, pubData]) => {
        if (Array.isArray(allData)) setRooms(allData);
        if (Array.isArray(pubData)) setPublicRooms(pubData);
      })
      .catch(() => {})
      .finally(() => setRoomsLoading(false));
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
          isPublic: isPublicRoom,
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
    <main className="min-h-screen bg-[#FEF3E2] relative">
      {/* Onboarding modal */}
      {showOnboarding && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center px-6" onClick={() => { localStorage.setItem("avatar_council_onboarded", "1"); setShowOnboarding(false); }}>
          <div className="bg-[#FEF3E2] rounded-3xl shadow-2xl max-w-sm w-full p-8 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            {/* Avatar faces */}
            <div className="flex justify-center -space-x-2 mb-5">
              {avatars.slice(0, 4).map((a, i) => (
                <div key={a.id} className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/80 animate-float" style={{ animationDelay: `${i * 0.3}s` }}>
                  {a.avatar_url ? (
                    <img src={a.avatar_url} alt={a.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[#9B5DE5]/15 flex items-center justify-center text-xs font-bold text-[#9B5DE5]/50">{a.name[0]}</div>
                  )}
                </div>
              ))}
            </div>

            <h2 className="text-xl font-bold text-[#3D2C1E] text-center mb-4">欢迎来到分身议事</h2>

            <div className="space-y-3 mb-8">
              <div className="flex items-start gap-3">
                <span className="text-base mt-0.5">🎙</span>
                <p className="text-sm text-[#3D2C1E]/60">选择 AI 分身，开启语音圆桌</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-base mt-0.5">💬</span>
                <p className="text-sm text-[#3D2C1E]/60">分身会自主讨论，你随时插话</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-base mt-0.5">🌐</span>
                <p className="text-sm text-[#3D2C1E]/60">发现公开房间，旁听精彩对话</p>
              </div>
            </div>

            <button
              onClick={() => { localStorage.setItem("avatar_council_onboarded", "1"); setShowOnboarding(false); }}
              className="w-full py-3 rounded-2xl bg-[#9B5DE5] text-white font-medium hover:bg-[#8a4dd4] transition-colors shadow-lg shadow-[#9B5DE5]/20"
            >
              开始探索
            </button>
          </div>
        </div>
      )}

      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-[#9B5DE5]/6 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/3 right-1/4 w-72 h-72 bg-[#F4A261]/8 rounded-full blur-[80px]" />
      </div>

      {/* Top bar with drawer toggle */}
      {user && (
        <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-5 py-3 bg-[#FEF3E2]/80 backdrop-blur-sm">
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
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-[#3D2C1E]/70">分身列表</h3>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="text-[#3D2C1E]/20 hover:text-[#3D2C1E]/50 transition-colors text-lg"
                >
                  ×
                </button>
              </div>

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索分身..."
                className="w-full bg-white/60 border border-[#9B5DE5]/10 rounded-xl px-3 py-2 text-sm text-[#3D2C1E] placeholder:text-[#3D2C1E]/20 outline-none focus:border-[#9B5DE5]/30 mb-3"
              />

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

      {/* Hero section — exactly one viewport tall */}
      <div className="relative z-10 flex flex-col items-center justify-center h-screen px-6 overflow-hidden">
        <div className="text-center max-w-sm w-full">
          {!user ? (
            /* ── Logged-out: The Gathering ── */
            <div className="flex flex-col items-center">
              {/* Avatar arc */}
              {loading || avatars.length === 0 ? (
                <div className="mb-6 flex items-center justify-center gap-2">
                  <div className="w-11 h-11 rounded-full bg-[#9B5DE5]/50 animate-breathe" />
                  <div className="w-9 h-9 rounded-full bg-[#F4A261]/50 animate-breathe" style={{ animationDelay: "0.5s" }} />
                </div>
              ) : (
                <div className="relative w-52 h-36 mb-6">
                  {avatars.slice(0, 6).map((a, i) => {
                    const count = Math.min(avatars.length, 6);
                    const angle = count > 1 ? (Math.PI / (count - 1)) * i : Math.PI / 2;
                    const x = Math.cos(angle) * 85;
                    const y = -Math.sin(angle) * 40;
                    return (
                      <div
                        key={a.id}
                        className={`absolute w-11 h-11 rounded-full overflow-hidden border-2 border-white/60 animate-float ${i % 3 === 0 ? "animate-speaking-glow" : ""}`}
                        style={{
                          left: `calc(50% + ${x}px - 22px)`,
                          top: `calc(50% + ${y}px - 22px)`,
                          animationDelay: `${i * 0.4}s`,
                          opacity: 0,
                          animation: `fade-in-up 0.4s ease-out ${i * 0.15}s forwards, float 3s ease-in-out ${i * 0.4}s infinite${i % 3 === 0 ? ", speaking-glow-purple 2.5s ease-in-out infinite" : ""}`,
                        }}
                      >
                        {a.avatar_url ? (
                          <img src={a.avatar_url} alt={a.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-[#9B5DE5]/15 flex items-center justify-center text-sm font-bold text-[#9B5DE5]/50">
                            {a.name[0]}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {/* Typing dots in center */}
                  <div className="dot-pulse absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-[#9B5DE5]/25" />
                    <span className="w-1 h-1 rounded-full bg-[#9B5DE5]/25" />
                    <span className="w-1 h-1 rounded-full bg-[#9B5DE5]/25" />
                  </div>
                </div>
              )}

              <h1 className="text-3xl font-bold mb-2 text-[#3D2C1E] tracking-tight">分身议事</h1>
              <p className="text-[#3D2C1E]/50 text-sm mb-1 opacity-0 animate-fade-in" style={{ animationDelay: "0.3s" }}>
                和任何人的 AI 分身，围桌而谈
              </p>
              <p className="text-[#3D2C1E]/25 text-xs mb-10 opacity-0 animate-fade-in" style={{ animationDelay: "0.5s" }}>
                产品决策 · 头脑风暴 · 甚至狼人杀
              </p>

              <a
                href="/api/auth/login"
                className="inline-block px-10 py-3.5 rounded-full bg-[#9B5DE5] text-white font-medium hover:bg-[#8a4dd4] transition-all shadow-lg shadow-[#9B5DE5]/25 hover:shadow-xl hover:shadow-[#9B5DE5]/30 hover:-translate-y-0.5"
              >
                进入议事厅
              </a>
              <p className="text-[10px] text-[#3D2C1E]/15 mt-3">通过 SecondMe 账号登录</p>
            </div>
          ) : (
            /* ── Logged-in: Create room ── */
            <div>
              {/* Compact avatar arc */}
              <div className="relative w-36 h-16 mx-auto mb-4">
                {avatars.slice(0, 4).map((a, i) => {
                  const count = Math.min(avatars.length, 4);
                  const angle = count > 1 ? (Math.PI / (count - 1)) * i : Math.PI / 2;
                  const x = Math.cos(angle) * 50;
                  const y = -Math.sin(angle) * 20;
                  return (
                    <div
                      key={a.id}
                      className="absolute w-9 h-9 rounded-full overflow-hidden border-2 border-white/60"
                      style={{
                        left: `calc(50% + ${x}px - 18px)`,
                        top: `calc(50% + ${y}px - 18px)`,
                        animation: `float 3s ease-in-out ${i * 0.5}s infinite${i % 2 === 0 ? ", speaking-glow-purple 2.5s ease-in-out infinite" : ""}`,
                      }}
                    >
                      {a.avatar_url ? (
                        <img src={a.avatar_url} alt={a.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[#9B5DE5]/15 flex items-center justify-center text-xs font-bold text-[#9B5DE5]/50">{a.name[0]}</div>
                      )}
                    </div>
                  );
                })}
              </div>
              <h1 className="text-3xl font-bold mb-1 text-[#3D2C1E] tracking-tight">分身议事</h1>
              <p className="text-[#3D2C1E]/30 text-xs mb-6">输入话题，选择分身，开始讨论</p>

              <div className="space-y-5">
              {!joining ? (
                <>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="今天聊什么？"
                      className="w-full bg-white/60 border border-[#F4A261]/20 rounded-2xl px-5 py-3.5 text-[#3D2C1E] placeholder:text-[#3D2C1E]/25 outline-none focus:border-[#F4A261]/50 focus:bg-white/80 transition-all text-center shadow-sm"
                      onFocus={() => setTopicFocused(true)}
                      onKeyDown={(e) => e.key === "Enter" && createRoom()}
                    />

                    {avatars.length > 0 && (topicFocused || topic.trim()) && (
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

                    <div className="flex items-center px-1">
                      <button
                        onClick={() => setIsPublicRoom(!isPublicRoom)}
                        className="flex items-center gap-1.5 text-[10px] text-[#3D2C1E]/30 hover:text-[#3D2C1E]/50 transition-colors"
                      >
                        <div className={`w-3.5 h-3.5 rounded border-[1.5px] flex items-center justify-center transition-colors ${isPublicRoom ? "bg-[#9B5DE5] border-[#9B5DE5]" : "border-[#3D2C1E]/15"}`}>
                          {isPublicRoom && (
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          )}
                        </div>
                        公开房间
                      </button>
                    </div>

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
            </div>
          )}
        </div>

        {/* Scroll hint */}
        {user && rooms.length > 0 && (
          <div className="absolute bottom-8 flex flex-col items-center animate-bounce-slow">
            <span className="text-[#3D2C1E]/20 text-[10px] mb-1">发现更多讨论</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#3D2C1E]/15">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        )}
      </div>

      {/* Room list section */}
      {user && (
        <div className="relative z-10 px-6 pb-16 -mt-4">
          <div className="max-w-lg mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-px bg-[#3D2C1E]/6" />
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setRoomTab("discover")}
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors ${roomTab === "discover" ? "bg-[#9B5DE5]/10 text-[#9B5DE5]/70" : "text-[#3D2C1E]/25 hover:text-[#3D2C1E]/40"}`}
                >
                  发现
                </button>
                <button
                  onClick={() => setRoomTab("my")}
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors ${roomTab === "my" ? "bg-[#9B5DE5]/10 text-[#9B5DE5]/70" : "text-[#3D2C1E]/25 hover:text-[#3D2C1E]/40"}`}
                >
                  我的
                </button>
              </div>
              <div className="flex-1 h-px bg-[#3D2C1E]/6" />
            </div>

            {(() => {
              const filteredRooms = roomTab === "discover"
                ? publicRooms
                : rooms.filter((room) => {
                    if (!user) return false;
                    return room.created_by === user.name || room.human_participants.some((h) => h.name === user.name);
                  });

              if (roomsLoading) return <p className="text-[#3D2C1E]/20 text-xs text-center py-8">加载中...</p>;
              if (filteredRooms.length === 0) return <p className="text-[#3D2C1E]/20 text-xs text-center py-8">{roomTab === "my" ? "还没有你参与的讨论" : "暂无公开讨论"}</p>;

              return (
              <div className="space-y-2.5">
                {filteredRooms.map((room) => {
                  const isActive = room.status === "active" && !room.ended_at;
                  return (
                    <div
                      key={room.id}
                      onClick={isActive ? () => router.push(`/room/${room.id}`) : undefined}
                      className={`backdrop-blur-sm rounded-2xl px-4 py-3.5 transition-all ${
                        isActive
                          ? "bg-white/45 hover:bg-white/65 cursor-pointer group"
                          : "bg-white/25 hover:bg-white/35 group"
                      }`}
                    >
                      {/* Top row: status + topic + CTA */}
                      <div className="flex items-start gap-2.5 mb-2.5">
                        <div className={`mt-1.5 shrink-0 w-2 h-2 rounded-full ${isActive ? "bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-breathe" : "bg-[#3D2C1E]/15"}`} />
                        <div className="flex-1 min-w-0">
                          <h3 className={`text-sm font-medium truncate transition-colors ${isActive ? "text-[#3D2C1E]/75 group-hover:text-[#3D2C1E]" : "text-[#3D2C1E]/40"}`}>
                            {room.topic}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] font-medium ${isActive ? "text-emerald-500/70" : "text-[#3D2C1E]/25"}`}>
                              {isActive ? "进行中" : "已结束"}
                            </span>
                            <span className="text-[#3D2C1E]/12 text-[10px]">·</span>
                            <span className="text-[10px] text-[#3D2C1E]/25">
                              {timeAgo(room.started_at)}
                            </span>
                          </div>
                        </div>
                        {isActive ? (
                          <span className="shrink-0 mt-0.5 px-2.5 py-1 rounded-full bg-[#9B5DE5]/10 text-[10px] font-medium text-[#9B5DE5]/70 group-hover:bg-[#9B5DE5]/15 group-hover:text-[#9B5DE5] transition-colors">
                            继续
                          </span>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/replay/${room.id}`); }}
                            className="shrink-0 mt-0.5 px-2.5 py-1 rounded-full bg-[#F4A261]/10 text-[10px] font-medium text-[#F4A261]/60 hover:bg-[#F4A261]/20 hover:text-[#F4A261] transition-colors"
                          >
                            回放
                          </button>
                        )}
                      </div>

                      {/* Participants */}
                      <div className="flex items-center gap-3 pl-4.5">
                        {/* Human participants */}
                        {room.human_participants.length > 0 && (
                          <div className="flex items-center gap-1">
                            <div className="flex -space-x-1.5">
                              {room.human_participants.map((h, i) => (
                                <div key={i} className="w-5.5 h-5.5 rounded-full border border-white/80 bg-[#F4A261]/15 flex items-center justify-center overflow-hidden shrink-0">
                                  {h.avatar ? (
                                    <img src={h.avatar} alt={h.name} className="w-full h-full rounded-full object-cover" />
                                  ) : (
                                    <span className="text-[8px] font-bold text-[#F4A261]/60">{h.name[0]}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                            <span className="text-[10px] text-[#F4A261]/50 ml-0.5">
                              {room.human_participants.map((h) => h.name).join("、")}
                            </span>
                          </div>
                        )}

                        {room.human_participants.length > 0 && room.avatar_participants.length > 0 && (
                          <div className="w-px h-3 bg-[#3D2C1E]/8" />
                        )}

                        {/* AI participants */}
                        {room.avatar_participants.length > 0 && (
                          <div className="flex items-center gap-1">
                            <div className="flex -space-x-1.5">
                              {room.avatar_participants.slice(0, 4).map((a, i) => (
                                <div key={i} className="w-5.5 h-5.5 rounded-full border border-white/80 bg-[#9B5DE5]/10 flex items-center justify-center overflow-hidden shrink-0">
                                  {a.avatar_url ? (
                                    <img src={a.avatar_url} alt={a.name} className="w-full h-full rounded-full object-cover" />
                                  ) : (
                                    <span className="text-[8px] font-bold text-[#9B5DE5]/50">{a.name[0]}</span>
                                  )}
                                </div>
                              ))}
                              {room.avatar_participants.length > 4 && (
                                <div className="w-5.5 h-5.5 rounded-full border border-white/80 bg-[#9B5DE5]/8 flex items-center justify-center shrink-0">
                                  <span className="text-[8px] text-[#9B5DE5]/40">+{room.avatar_participants.length - 4}</span>
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] text-[#9B5DE5]/40 ml-0.5 truncate max-w-[120px]">
                              {room.avatar_participants.map((a) => a.name).join("、")}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              );
            })()}
          </div>
        </div>
      )}
    </main>
  );
}
