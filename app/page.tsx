"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Campfire } from "@/components/Campfire";
import { SceneAudio } from "@/components/SceneAudio";
import { SCENES, SCENE_LIST, type SceneType } from "@/lib/scenes";
import { ChatBubbles } from "@/components/ChatBubbles";
import { Header } from "@/components/Header";

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
  bio: string;
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
  message_count?: number;
  view_count?: number;
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
  const [expandedAvatarId, setExpandedAvatarId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [scene, setScene] = useState<SceneType>("campfire");
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const previewScene = (s: SceneType) => {
    // Stop any playing preview
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setScene(s);
    const src = SCENES[s].audioSrc;
    if (src) {
      const audio = new Audio(src);
      audio.volume = 0.2;
      audio.loop = false;
      // Play 5 seconds preview
      audio.play().catch(() => {});
      setTimeout(() => { audio.pause(); audio.currentTime = 0; }, 5000);
      previewAudioRef.current = audio;
    }
  };

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
          scene,
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
    <main className="min-h-screen relative bg-[#1a120b]">
      {/* Onboarding modal */}
      {showOnboarding && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center px-6" onClick={() => { localStorage.setItem("avatar_council_onboarded", "1"); setShowOnboarding(false); }}>
          <div className="bg-[#2a1f15] rounded-3xl shadow-2xl max-w-sm w-full p-8 animate-fade-in border border-[#F4A261]/10" onClick={(e) => e.stopPropagation()}>
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

            <h2 className="text-xl font-bold text-[#FFF8F0]/85 text-center mb-4">欢迎来到篝火会</h2>

            <div className="space-y-3 mb-8">
              <div className="flex items-start gap-3">
                <span className="text-base mt-0.5">🔥</span>
                <p className="text-sm text-[#FFF8F0]/50">点燃篝火，召唤 AI 分身围坐而谈</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-base mt-0.5">💬</span>
                <p className="text-sm text-[#FFF8F0]/50">分身自主讨论，你随时插话</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-base mt-0.5">👀</span>
                <p className="text-sm text-[#FFF8F0]/50">发现正在进行的篝火，加入旁听</p>
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

      {/* Header */}
      <Header dark />

      {/* Campfire ambient audio — landing page only */}
      {!user && <SceneAudio audioSrc="/ambient/campfire.mp3" />}

      {/* Night sky + campfire light — only on landing page */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{
        background: user
          ? `radial-gradient(ellipse 80% 60% at 50% 30%, rgba(244, 162, 97, 0.06) 0%, transparent 70%),
             radial-gradient(ellipse at center, rgba(30, 22, 14, 0.2) 0%, rgba(20, 14, 8, 0.6) 100%)`
          : `radial-gradient(ellipse 60% 50% at 50% 40%, rgba(244, 162, 97, 0.12) 0%, transparent 70%),
             radial-gradient(ellipse 40% 35% at 50% 42%, rgba(231, 111, 81, 0.08) 0%, transparent 60%),
             radial-gradient(ellipse at center, rgba(30, 22, 14, 0.4) 0%, rgba(20, 14, 8, 0.85) 100%)`,
      }} />

      {/* Top bar with drawer toggle */}
      {user && (
        <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-end px-5 py-3">
          <div className="flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-[#F4A261]/50 hover:text-[#F4A261] text-xs transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            分身 {avatars.length > 0 && <span className="text-[#FFF8F0]/20">{avatars.length}</span>}
          </button>
          </div>
        </div>
      )}

      {/* Right drawer — avatar list */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/10" />
          <div
            className="absolute top-0 right-0 bottom-0 w-72 bg-[#1a120b]/95 backdrop-blur-xl shadow-2xl shadow-black/30 animate-slide-in-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 h-full flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-[#FFF8F0]/60">分身列表</h3>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="text-[#FFF8F0]/20 hover:text-[#FFF8F0]/50 transition-colors text-lg"
                >
                  ×
                </button>
              </div>

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索分身..."
                className="w-full bg-white/8 border border-[#F4A261]/10 rounded-xl px-3 py-2 text-sm text-[#FFF8F0]/70 placeholder:text-[#FFF8F0]/20 outline-none focus:border-[#F4A261]/25 mb-3"
              />

              <div className="flex-1 overflow-y-auto space-y-1.5 -mx-1 px-1">
                {loading ? (
                  <p className="text-[#3D2C1E]/20 text-xs text-center py-4">加载中...</p>
                ) : filteredAvatars.length === 0 ? (
                  <p className="text-[#3D2C1E]/20 text-xs text-center py-4">暂无分身</p>
                ) : (
                  filteredAvatars.map((a) => {
                    const isExpanded = expandedAvatarId === a.id;
                    const fireCount = rooms.filter((r) => r.avatar_participants.some((p) => p.id === a.id) || r.human_participants.some((p) => p.name === a.name)).length;
                    return (
                    <div
                      key={a.id}
                      className="rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                      onClick={() => setExpandedAvatarId(isExpanded ? null : a.id)}
                    >
                      <div className="flex items-center gap-2.5 px-2.5 py-2">
                        <div className="w-9 h-9 rounded-full bg-[#F4A261]/12 flex items-center justify-center text-xs font-bold text-[#F4A261]/50 shrink-0 overflow-hidden">
                          {a.avatar_url ? (
                            <img src={a.avatar_url} alt={a.name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            a.name[0]
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-[#FFF8F0]/60 truncate">{a.name}</span>
                            {fireCount > 0 && <span className="text-[9px] text-[#F4A261]/35">🔥{fireCount}</span>}
                          </div>
                          {a.bio && !isExpanded && <span className="text-[10px] text-[#FFF8F0]/20 truncate block">{a.bio.slice(0, 30)}</span>}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleLike(a.id); }}
                          className="flex items-center gap-1 text-xs transition-colors shrink-0"
                        >
                          <span className={likedIds.has(a.id) ? "text-red-400" : "text-[#FFF8F0]/20 hover:text-red-300"}>
                            {likedIds.has(a.id) ? "♥" : "♡"}
                          </span>
                          {a.likes > 0 && (
                            <span className="text-[#FFF8F0]/20">{a.likes}</span>
                          )}
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="px-3 pb-3 animate-fade-in">
                          {a.bio && <p className="text-[11px] text-[#FFF8F0]/35 mb-2 leading-relaxed">{a.bio}</p>}
                          {a.route && (
                            <a
                              href={`https://second.me/${a.route}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[10px] text-[#F4A261]/60 hover:text-[#F4A261] transition-colors"
                            >
                              <span>去 SecondMe 交流 →</span>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )})
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero section */}
      <div className={`relative z-10 flex flex-col items-center justify-center px-6 overflow-hidden ${user ? "pt-20 pb-6" : "h-screen"}`}>
        <div className="text-center max-w-sm w-full">
          {!user ? (
            /* ── Logged-out: The Gathering ── */
            <div className="flex flex-col items-center">
              {/* Campfire scene — all elements centered at 50%/50% */}
              <div className="relative w-60 h-52 mb-2">
                {/* Canvas particle fire — centered */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                  <Campfire width={120} height={140} intensity={0.8} />
                </div>

                {/* Outer ambient glow — centered */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-[#F4A261]/8 animate-campfire-glow" />

                {/* Avatars sitting around the fire */}
                {(() => {
                  const count = Math.min(avatars.length, 6);
                  const rx = 85;
                  const ry = 70;
                  const positions = Array.from({ length: count }, (_, i) => {
                    const angle = (2 * Math.PI / count) * i - Math.PI / 2;
                    return { x: Math.cos(angle) * rx, y: Math.sin(angle) * ry };
                  });

                  return !loading && avatars.length > 0 && (
                    <>
                      {avatars.slice(0, 6).map((a, i) => (
                        <div
                          key={a.id}
                          className="absolute w-10 h-10 rounded-full overflow-hidden border-2 border-[#F4A261]/40 z-20 shadow-md shadow-black/20"
                          style={{
                            left: `calc(50% + ${positions[i].x}px - 20px)`,
                            top: `calc(50% + ${positions[i].y}px - 20px)`,
                            opacity: 0,
                            animation: `fade-in-up 0.4s ease-out ${i * 0.12}s forwards, float 3s ease-in-out ${i * 0.5}s infinite`,
                          }}
                        >
                          {a.avatar_url ? (
                            <img src={a.avatar_url} alt={a.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-[#F4A261]/15 flex items-center justify-center text-xs font-bold text-[#F4A261]/50">
                              {a.name[0]}
                            </div>
                          )}
                        </div>
                      ))}
                      <ChatBubbles avatarCount={count} avatarPositions={positions} />
                    </>
                  );
                })()}
              </div>

              <h1 className="text-3xl font-bold mb-2 text-[#FFF8F0]/90 tracking-tight">分身篝火会</h1>
              <p className="text-[#F4A261]/50 text-sm mb-1 opacity-0 animate-fade-in" style={{ animationDelay: "0.3s" }}>
                围着篝火，和 AI 分身一起聊
              </p>
              <p className="text-[#F4A261]/30 text-xs mb-10 opacity-0 animate-fade-in" style={{ animationDelay: "0.5s" }}>
                圆桌闲聊 · 头脑风暴 · 成语接龙 · 甚至狼人杀
              </p>

              <a
                href="/api/auth/login"
                className="inline-block px-10 py-3.5 rounded-full bg-[#F4A261] text-white font-medium hover:bg-[#e5934f] transition-all shadow-lg shadow-[#F4A261]/30 hover:shadow-xl hover:shadow-[#F4A261]/40 hover:-translate-y-0.5"
              >
                加入篝火
              </a>
              <p className="text-[10px] text-[#FFF8F0]/15 mt-3">通过 SecondMe 账号登录</p>
            </div>
          ) : (
            /* ── Logged-in: Compact header only ── */
            <div>
              <h1 className="text-2xl font-bold mb-1 text-[#FFF8F0]/85 tracking-tight">分身篝火会</h1>
              <p className="text-[#F4A261]/35 text-xs mb-2">围着篝火，和 AI 分身一起聊</p>

              <div className="space-y-3">
              {!joining ? (
                <>
                  {!showCreate ? (
                    <button
                      onClick={() => setShowCreate(true)}
                      className="w-full py-3 rounded-2xl border-2 border-dashed border-[#F4A261]/15 text-[#F4A261]/40 text-sm hover:border-[#F4A261]/30 hover:text-[#F4A261]/60 transition-colors"
                    >
                      + 点燃新篝火
                    </button>
                  ) : (
                  <div className="space-y-3 bg-white/5 rounded-2xl p-4 border border-[#F4A261]/8">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] text-[#F4A261]/40 font-medium">点燃新篝火</p>
                      <button onClick={() => setShowCreate(false)} className="text-[#3D2C1E]/20 hover:text-[#3D2C1E]/50 text-sm">×</button>
                    </div>
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="今晚篝火聊什么？"
                      className="w-full bg-white/8 border border-[#F4A261]/15 rounded-2xl px-5 py-3.5 text-[#FFF8F0]/80 placeholder:text-[#FFF8F0]/20 outline-none focus:border-[#F4A261]/40 focus:bg-white/12 transition-all text-center"
                      onFocus={() => setTopicFocused(true)}
                      onKeyDown={(e) => e.key === "Enter" && createRoom()}
                    />

                    {avatars.length > 0 && (topicFocused || topic.trim()) && (
                      <div className="bg-white/5 rounded-2xl p-2.5 space-y-1.5 text-left max-h-40 overflow-y-auto">
                        <p className="text-[10px] text-[#F4A261]/35 font-medium px-1">选择参会分身</p>
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
                            <span className="text-xs text-[#FFF8F0]/50 flex-1 truncate">{a.name}</span>
                            {a.likes > 0 && (
                              <span className="text-[10px] text-red-300/50">♥ {a.likes}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Scene selector */}
                    <div className="px-1">
                      <p className="text-[10px] text-[#F4A261]/35 font-medium mb-1.5">场景</p>
                      <div className="flex gap-2">
                        {SCENE_LIST.map((s) => {
                          const sc = SCENES[s];
                          const isSelected = scene === s;
                          return (
                            <button
                              key={s}
                              onClick={() => previewScene(s)}
                              className={`flex-1 py-2 rounded-xl text-[11px] transition-all border flex flex-col items-center gap-0.5 ${
                                isSelected
                                  ? "bg-[#9B5DE5]/12 border-[#9B5DE5]/30 text-[#FFF8F0]/60 scale-105"
                                  : "bg-white/5 border-white/8 text-[#FFF8F0]/25 hover:text-[#FFF8F0]/40 hover:bg-white/8"
                              }`}
                            >
                              <span className="text-base">{sc.emoji}</span>
                              <span>{sc.label}</span>
                              {isSelected && sc.audioSrc && (
                                <span className="text-[8px] text-[#9B5DE5]/40">♪ 试听中</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

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
                      {creating ? "创建中..." : `${SCENES[scene].createLabel}${selected.size > 0 ? ` (${selected.size} 个分身)` : ""}`}
                    </button>
                  </div>
                  )}
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

      </div>

      {/* Room list section — visible to everyone */}
      {(user || publicRooms.length > 0) && (
        <div className="relative z-10 px-6 pb-16">
          <div className="max-w-lg mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-px bg-[#FFF8F0]/6" />
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setRoomTab("discover")}
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors ${roomTab === "discover" ? "bg-[#F4A261]/15 text-[#F4A261]/70" : "text-[#FFF8F0]/25 hover:text-[#FFF8F0]/40"}`}
                >
                  发现
                </button>
                <button
                  onClick={() => setRoomTab("my")}
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors ${roomTab === "my" ? "bg-[#F4A261]/15 text-[#F4A261]/70" : "text-[#FFF8F0]/25 hover:text-[#FFF8F0]/40"}`}
                >
                  我的
                </button>
              </div>
              <div className="flex-1 h-px bg-[#FFF8F0]/6" />
            </div>

            {(() => {
              const filteredRooms = (roomTab === "discover"
                ? publicRooms
                : rooms.filter((room) => {
                    if (!user) return false;
                    return room.created_by === user.name || room.human_participants.some((h) => h.name === user.name);
                  })
              ).sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0) || (b.message_count ?? 0) - (a.message_count ?? 0));

              if (roomsLoading) return <p className="text-[#FFF8F0]/20 text-xs text-center py-8">加载中...</p>;
              if (filteredRooms.length === 0) return <p className="text-[#FFF8F0]/20 text-xs text-center py-8">{roomTab === "my" ? "还没有你参与的篝火" : "暂无公开篝火"}</p>;

              return (
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredRooms.map((room) => {
                  const isActive = room.status === "active" && !room.ended_at;
                  const mc = room.message_count ?? 0;
                  const allParticipants = [...room.avatar_participants, ...room.human_participants.map((h) => ({ id: h.name, name: h.name, avatar_url: h.avatar }))];
                  return (
                    <div
                      key={room.id}
                      onClick={() => router.push(isActive ? `/room/${room.id}` : `/replay/${room.id}`)}
                      className={`rounded-2xl p-4 transition-all cursor-pointer group ${
                        isActive
                          ? "bg-[#2a1f15]/70 border border-[#F4A261]/12 hover:border-[#F4A261]/30 hover:bg-[#2a1f15]/90"
                          : "bg-[#2a1f15]/40 border border-[#FFF8F0]/5 hover:border-[#FFF8F0]/10 hover:bg-[#2a1f15]/50 opacity-70 hover:opacity-85"
                      }`}
                    >
                      {/* Participant avatars — big row */}
                      <div className="flex -space-x-2 mb-3">
                        {allParticipants.slice(0, 5).map((p, i) => (
                          <div key={i} className="w-8 h-8 rounded-full border-2 border-[#1a120b] bg-[#F4A261]/10 flex items-center justify-center overflow-hidden shrink-0">
                            {p.avatar_url ? (
                              <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[9px] font-bold text-[#F4A261]/50">{p.name[0]}</span>
                            )}
                          </div>
                        ))}
                        {allParticipants.length > 5 && (
                          <div className="w-8 h-8 rounded-full border-2 border-[#1a120b] bg-[#F4A261]/8 flex items-center justify-center shrink-0">
                            <span className="text-[9px] text-[#FFF8F0]/30">+{allParticipants.length - 5}</span>
                          </div>
                        )}
                      </div>

                      {/* Live voice wave */}
                      {isActive && mc > 0 && (
                        <div className="flex items-center gap-2 mb-2">
                          <div className="voice-wave text-[#F4A261]/60">
                            <span /><span /><span /><span /><span /><span /><span />
                          </div>
                          <span className="text-[11px] text-[#F4A261]/50 font-medium">讨论中</span>
                        </div>
                      )}

                      {/* Topic */}
                      <h3 className={`text-[15px] font-medium mb-1.5 leading-snug transition-colors ${isActive ? "text-[#FFF8F0]/80 group-hover:text-[#FFF8F0]" : "text-[#FFF8F0]/30"}`}>
                        {room.topic}
                      </h3>

                      {/* Meta row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs ${isActive ? "" : "opacity-30 grayscale"}`}>🔥</span>
                          <span className="text-[10px] text-[#FFF8F0]/25">{timeAgo(room.started_at)}</span>
                          {(room.view_count ?? 0) > 0 && (
                            <span className="text-[10px] text-[#FFF8F0]/25">{room.view_count} 次围观</span>
                          )}
                          {mc > 0 && (
                            <span className={`text-[10px] font-medium ${mc > 20 ? "text-[#E76F51]/70" : mc > 5 ? "text-[#F4A261]/55" : "text-[#FFF8F0]/25"}`}>
                              {mc > 20 ? "热火朝天" : mc > 5 ? "讨论正酣" : `${mc} 条讨论`}
                            </span>
                          )}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${
                          isActive
                            ? "bg-[#F4A261]/15 text-[#F4A261]/70 group-hover:bg-[#F4A261]/25 group-hover:text-[#F4A261]"
                            : "bg-[#FFF8F0]/5 text-[#FFF8F0]/30 group-hover:bg-[#FFF8F0]/10 group-hover:text-[#FFF8F0]/50"
                        }`}>
                          {isActive ? "加入" : "回放"}
                        </span>
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
