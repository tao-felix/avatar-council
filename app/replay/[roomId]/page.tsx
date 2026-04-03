"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";

interface RoomData {
  id: string;
  topic: string;
  avatar_participants: { id: string; name: string; avatar_url: string }[];
  human_participants: { name: string; avatar: string }[];
  started_at: string;
  ended_at: string | null;
}

interface MessageData {
  id: number;
  sender_id: string;
  sender_name: string;
  sender_type: "human" | "ai";
  content: string;
  tts_audio_url: string | null;
  created_at: string;
}

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function ReplayPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [room, setRoom] = useState<RoomData | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [loading, setLoading] = useState(true);

  // Playback state
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [copied, setCopied] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playingRef = useRef(false);

  // Load data
  useEffect(() => {
    Promise.all([
      fetch(`/api/rooms/${roomId}`).then((r) => r.json()),
      fetch(`/api/rooms/${roomId}/messages`).then((r) => r.json()),
    ])
      .then(([roomData, msgData]) => {
        if (!roomData.error) setRoom(roomData);
        if (Array.isArray(msgData)) setMessages(msgData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [roomId]);

  // Derived: which AI is "speaking" at currentIdx
  const currentMsg = currentIdx >= 0 && currentIdx < messages.length ? messages[currentIdx] : null;
  const speakingAiId = currentMsg?.sender_type === "ai" ? currentMsg.sender_id : null;

  // For each participant, find the latest message up to currentIdx
  const getLatestMessage = (senderId: string, senderType: "human" | "ai") => {
    if (currentIdx < 0) return null;
    for (let i = currentIdx; i >= 0; i--) {
      const m = messages[i];
      if (senderType === "human" && m.sender_type === "human") return m;
      if (senderType === "ai" && m.sender_id === senderId) return m;
    }
    return null;
  };

  // Latest human message
  const latestHumanMsg = currentIdx >= 0 ? (() => {
    for (let i = currentIdx; i >= 0; i--) {
      if (messages[i].sender_type === "human") return messages[i];
    }
    return null;
  })() : null;

  // Timeline
  const timeRange = (() => {
    if (messages.length === 0) return { start: 0, end: 1, duration: 1 };
    const times = messages.map((m) => new Date(m.created_at).getTime());
    const start = Math.min(...times);
    const end = Math.max(...times);
    return { start, end, duration: Math.max(end - start, 1) };
  })();

  // Progress by message index (uniform spacing, not time-based)
  const getProgress = (idx: number) => {
    if (messages.length <= 1 || idx < 0) return 0;
    if (idx >= messages.length) return 1;
    return idx / (messages.length - 1);
  };

  const getReadingMs = (content: string) => {
    const ms = (content.length / 5) * 1000;
    return Math.min(Math.max(ms / speed, 800), 8000 / speed); // Cap at 8s base
  };

  const getParticipant = (msg: MessageData) => {
    if (!room) return null;
    if (msg.sender_type === "human") {
      return room.human_participants.find((h) => h.name === msg.sender_name) || null;
    }
    return room.avatar_participants.find((a) => a.id === msg.sender_id) || null;
  };

  // Playback
  const playMessage = useCallback((idx: number) => {
    if (idx >= messages.length) {
      setIsPlaying(false);
      playingRef.current = false;
      return;
    }
    setCurrentIdx(idx);
    const msg = messages[idx];

    if (msg.tts_audio_url) {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      const audio = new Audio(msg.tts_audio_url);
      audio.playbackRate = speed;
      audioRef.current = audio;
      const fallback = () => {
        // Audio failed (expired URL, network error) — fall back to reading time
        timerRef.current = setTimeout(() => {
          if (playingRef.current) playMessage(idx + 1);
        }, getReadingMs(msg.content));
      };
      // Timeout: if audio doesn't start within 5s, fall back
      const loadTimeout = setTimeout(fallback, 5000);
      audio.oncanplay = () => clearTimeout(loadTimeout);
      audio.onended = () => { clearTimeout(loadTimeout); if (playingRef.current) playMessage(idx + 1); };
      audio.onerror = () => { clearTimeout(loadTimeout); fallback(); };
      audio.play().catch(() => { clearTimeout(loadTimeout); fallback(); });
    } else {
      timerRef.current = setTimeout(() => {
        if (playingRef.current) playMessage(idx + 1);
      }, getReadingMs(msg.content));
    }
  }, [messages, speed]);

  const play = () => {
    if (messages.length === 0) return;
    setIsPlaying(true);
    playingRef.current = true;
    const startIdx = currentIdx < 0 ? 0 : currentIdx >= messages.length - 1 ? 0 : currentIdx;
    playMessage(startIdx);
  };

  const pause = () => {
    setIsPlaying(false);
    playingRef.current = false;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  const jumpTo = (idx: number, autoPlay = false) => {
    pause();
    setCurrentIdx(idx);
    if (autoPlay && idx >= 0 && idx < messages.length) {
      setIsPlaying(true);
      playingRef.current = true;
      playMessage(idx);
    }
  };

  const jumpToParticipant = (senderId: string, senderType: "human" | "ai") => {
    const startSearch = currentIdx + 1;
    let found = messages.findIndex((m, i) => i >= startSearch && (senderType === "human" ? m.sender_type === "human" : m.sender_id === senderId));
    if (found === -1) {
      found = messages.findIndex((m) => senderType === "human" ? m.sender_type === "human" : m.sender_id === senderId);
    }
    if (found >= 0) {
      setCurrentIdx(found);
      setIsPlaying(true);
      playingRef.current = true;
      playMessage(found);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const idx = Math.round(pct * (messages.length - 1));
    jumpTo(Math.max(0, Math.min(idx, messages.length - 1)));
  };

  const goPrev = () => {
    if (currentIdx > 0) jumpTo(currentIdx - 1, true);
  };

  const goNext = () => {
    if (currentIdx < messages.length - 1) jumpTo(currentIdx + 1, true);
  };

  const getAiPosition = (index: number, total: number) => {
    const spacing = 100 / (total + 1);
    return { left: `${spacing * (index + 1)}%` };
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#1a120b] flex items-center justify-center">
        <p className="text-[#FFF8F0]/20 text-sm">加载中...</p>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="min-h-screen bg-[#1a120b] flex items-center justify-center">
        <p className="text-[#FFF8F0]/30 text-sm">房间不存在</p>
      </main>
    );
  }

  const aiParticipants = room.avatar_participants;
  const humanParticipants = room.human_participants;

  const copyShareLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <main className="h-screen w-screen overflow-hidden relative bg-[#1a120b]">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{
        background: `radial-gradient(ellipse 70% 55% at 50% 55%, rgba(244, 162, 97, 0.08) 0%, transparent 70%),
          radial-gradient(ellipse at center, rgba(30, 22, 14, 0.3) 0%, rgba(20, 14, 8, 0.7) 100%)`,
      }} />

      {/* Topic bar */}
      <div className="absolute top-0 left-0 right-0 z-20 px-5 py-3 flex items-start justify-between">
        <div>
          <p className="text-[#FFF8F0]/60 text-sm font-medium">{room.topic}</p>
          <p className="text-[#FFF8F0]/20 text-[10px]">
            <span className="text-[#F4A261]/40 font-medium mr-1">REPLAY</span>
            {aiParticipants.length} 个分身 · {messages.length} 条讨论
          </p>
        </div>
        <button
          onClick={copyShareLink}
          className="shrink-0 mt-0.5 px-2.5 py-1 rounded-full bg-white/8 hover:bg-white/15 text-[10px] text-[#FFF8F0]/40 font-medium transition-colors"
        >
          {copied ? "已复制" : "分享"}
        </button>
      </div>

      {/* AI participants */}
      <div className="absolute top-16 left-0 right-0 px-8" style={{ height: "55%" }}>
        <div className="relative w-full h-full">
          {aiParticipants.map((ai, i) => {
            const pos = getAiPosition(i, aiParticipants.length);
            const isSpeaking = speakingAiId === ai.id;
            const latestMsg = getLatestMessage(ai.id, "ai");

            return (
              <div
                key={ai.id}
                className="absolute -translate-x-1/2 flex flex-col items-center cursor-pointer"
                style={{ left: pos.left, top: "15%" }}
                onClick={() => jumpToParticipant(ai.id, "ai")}
              >
                <div
                  className={`
                    w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold overflow-hidden
                    bg-[#9B5DE5]/15 border-2 transition-all duration-500
                    ${isSpeaking ? "border-[#9B5DE5]/60 animate-speaking scale-105" : "border-[#9B5DE5]/20 animate-breathe"}
                  `}
                >
                  {ai.avatar_url ? (
                    <img src={ai.avatar_url} alt={ai.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-[#9B5DE5]/60">{ai.name[0]}</span>
                  )}
                </div>
                <span className="text-[10px] text-[#9B5DE5]/40 mt-1.5">{ai.name}</span>

                {latestMsg && (
                  <div className={`mt-2 max-w-[320px] w-[280px] max-h-[200px] overflow-y-auto bg-white/8 backdrop-blur-sm rounded-2xl px-4 py-3 text-sm text-[#FFF8F0]/60 animate-fade-in leading-relaxed transition-all duration-300 ${
                    isSpeaking ? "ring-1 ring-[#9B5DE5]/30" : ""
                  }`}>
                    {latestMsg.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Human area */}
      <div className="absolute bottom-24 left-0 right-0 z-10 flex flex-col items-center">
        {latestHumanMsg && (
          <div className={`mb-4 max-w-[320px] max-h-[120px] overflow-y-auto bg-white/8 backdrop-blur-sm rounded-2xl px-4 py-2.5 text-sm text-[#FFF8F0]/50 animate-fade-in text-center transition-all duration-300 ${
            currentMsg?.sender_type === "human" ? "ring-1 ring-[#F4A261]/20" : ""
          }`}>
            {latestHumanMsg.content}
          </div>
        )}

        <div className="flex items-center gap-4">
          {humanParticipants.map((h) => {
            const isCurrentSpeaker = currentMsg?.sender_type === "human" && currentMsg?.sender_name === h.name;
            return (
              <div
                key={h.name}
                className={`
                  w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold overflow-hidden cursor-pointer
                  bg-[#F4A261]/15 border-2 transition-all duration-300
                  ${isCurrentSpeaker ? "border-[#F4A261] animate-speaking scale-105" : "border-[#F4A261]/25"}
                `}
                onClick={() => jumpToParticipant(h.name, "human")}
              >
                {h.avatar ? (
                  <img src={h.avatar} alt={h.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="text-[#F4A261]/60">{h.name[0]}</span>
                )}
              </div>
            );
          })}

          {humanParticipants.length === 1 && (
            <span className="text-xs text-[#FFF8F0]/25">{humanParticipants[0].name}</span>
          )}
        </div>

        {currentIdx < 0 && messages.length > 0 && (
          <p className="mt-3 text-[#FFF8F0]/15 text-[11px]">点击播放回放篝火</p>
        )}
      </div>

      {/* Playback controls */}
      {messages.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 z-20 px-5 pb-4 pt-2">
          <div className="max-w-2xl mx-auto">
            {/* Progress track */}
            <div
              className="relative h-8 cursor-pointer group mb-2"
              onClick={handleProgressClick}
            >
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-[#FFF8F0]/8 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#9B5DE5]/40 to-[#F4A261]/40 rounded-full transition-all duration-300"
                  style={{ width: `${getProgress(currentIdx) * 100}%` }}
                />
              </div>
              {messages.map((msg, idx) => {
                const pos = getProgress(idx) * 100;
                const isCurrent = idx === currentIdx;
                const isHuman = msg.sender_type === "human";
                const p = getParticipant(msg);
                const avatarUrl = isHuman ? (p as { avatar?: string })?.avatar : (p as { avatar_url?: string })?.avatar_url;
                return (
                  <div
                    key={msg.id}
                    className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-200 ${
                      isCurrent ? "scale-150 z-10" : "hover:scale-125"
                    }`}
                    style={{ left: `${pos}%` }}
                    onClick={(e) => { e.stopPropagation(); jumpTo(idx, true); }}
                  >
                    <div
                      className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center"
                      style={{
                        border: `1.5px solid ${isHuman ? "#F4A261" : "#9B5DE5"}${isCurrent ? "" : "60"}`,
                        backgroundColor: isCurrent ? "#2a1f15" : `${isHuman ? "#F4A261" : "#9B5DE5"}10`,
                      }}
                    >
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={msg.sender_name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[6px] font-bold" style={{ color: isHuman ? "#F4A261" : "#9B5DE5" }}>
                          {msg.sender_name[0]}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={goPrev}
                disabled={currentIdx <= 0}
                className="px-3 py-1.5 rounded-full bg-white/8 hover:bg-white/15 text-xs text-[#FFF8F0]/40 hover:text-[#FFF8F0]/60 font-medium transition-colors disabled:opacity-20"
              >
                上一条
              </button>

              <button
                onClick={isPlaying ? pause : play}
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-md
                  ${isPlaying
                    ? "bg-[#E76F51] text-white shadow-[#E76F51]/20"
                    : "bg-white/12 text-[#FFF8F0]/60 hover:bg-white/20 hover:text-[#FFF8F0]/80"
                  }
                `}
              >
                {isPlaying ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="6,3 20,12 6,21" />
                  </svg>
                )}
              </button>

              <button
                onClick={goNext}
                disabled={currentIdx >= messages.length - 1}
                className="px-3 py-1.5 rounded-full bg-white/8 hover:bg-white/15 text-xs text-[#FFF8F0]/40 hover:text-[#FFF8F0]/60 font-medium transition-colors disabled:opacity-20"
              >
                下一条
              </button>

              <button
                onClick={() => setSpeed((s) => s >= 2 ? 0.5 : s + 0.5)}
                className="px-2.5 py-1.5 rounded-full bg-white/8 hover:bg-white/12 text-[11px] text-[#FFF8F0]/30 font-medium transition-colors"
              >
                {speed}x
              </button>

              <span className="text-[10px] text-[#FFF8F0]/15 ml-1">
                {currentIdx >= 0 ? `${currentIdx + 1} / ${messages.length}` : `${messages.length} 条`}
              </span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
