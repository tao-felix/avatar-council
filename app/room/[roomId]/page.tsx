"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { startSpeechRecognition, splitIntoSentences } from "@/lib/speech";
import { AudioQueue } from "@/lib/audio-queue";
interface RoomAvatar {
  id: string;
  name: string;
  avatar_url: string;
}

interface Participant {
  id: string;
  name: string;
  avatar?: string;
  type: "human" | "ai";
  token?: string;
}

interface Message {
  id: number;
  senderId: string;
  sender: string;
  senderType: "human" | "ai";
  text: string;
  timestamp: number;
}

function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

const SYSTEM_PROMPT = `你是一位会议参与者。你会根据讨论内容自然地参与对话，提出自己的观点、提问或总结。
保持简洁，每次发言控制在2-3句话。像真人同事一样自然交流。
如果当前讨论你没有有价值的补充，只回复 [PASS]。
不要做自我介绍，直接参与讨论。`;

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [topic, setTopic] = useState("");
  const [user, setUser] = useState<{ name: string; avatar: string } | null>(null);
  const [aiParticipants, setAiParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [thinkingAiId, setThinkingAiId] = useState<string | null>(null);
  const [speakingAiId, setSpeakingAiId] = useState<string | null>(null);
  const [aiStreamText, setAiStreamText] = useState("");

  const recognitionRef = useRef<ReturnType<typeof startSpeechRecognition>>(null);
  const audioQueueRef = useRef<AudioQueue>(new AudioQueue());
  const msgIdRef = useRef(0);
  const sessionMapRef = useRef<Record<string, string | undefined>>({});

  useEffect(() => {
    const raw = getCookie("sm_user");
    if (raw) {
      try { setUser(JSON.parse(raw)); } catch { /* */ }
    }

    // Load room from Supabase
    fetch(`/api/rooms/${roomId}`)
      .then((r) => r.json())
      .then((room) => {
        if (room.error) { setTopic("自由讨论"); return; }
        setTopic(room.topic || "自由讨论");

        const stored: RoomAvatar[] = room.avatar_participants || [];
        const participants: Participant[] = stored.map((a) => ({
          id: a.id,
          name: a.name,
          avatar: a.avatar_url,
          type: "ai" as const,
        }));
        setAiParticipants(participants);

        // Fetch tokens for each avatar
        Promise.all(
          stored.map(async (a) => {
            const res = await fetch(`/api/avatars/token?id=${a.id}`);
            const data = await res.json();
            return { id: a.id, token: data.token as string };
          })
        ).then((tokens) => {
          setAiParticipants((prev) =>
            prev.map((p) => {
              const t = tokens.find((tk) => tk.id === p.id);
              return t ? { ...p, token: t.token } : p;
            })
          );
        });
      })
      .catch(() => setTopic("自由讨论"));
  }, [roomId]);

  const askAIs = useCallback(async (allMessages: Message[]) => {
    for (const ai of aiParticipants) {
      if (!ai.token) continue;

      setThinkingAiId(ai.id);
      setSpeakingAiId(null);
      setAiStreamText("");

      const context = allMessages
        .slice(-10)
        .map((m) => `${m.sender}: ${m.text}`)
        .join("\n");

      const prompt = `会议主题: ${topic}\n\n最近的对话:\n${context}\n\n请根据以上对话自然参与讨论。`;

      try {
        const res = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: prompt,
            sessionId: sessionMapRef.current[ai.id],
            systemPrompt: SYSTEM_PROMPT,
            accessToken: ai.token,
          }),
        });

        if (!res.ok || !res.body) { setThinkingAiId(null); continue; }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.sessionId) sessionMapRef.current[ai.id] = parsed.sessionId;
                const chunk = parsed.choices?.[0]?.delta?.content || parsed.content || parsed.text || "";
                if (chunk) {
                  fullText += chunk;
                  setAiStreamText(fullText);
                  setThinkingAiId(null);
                  setSpeakingAiId(ai.id);
                }
              } catch {
                if (data && data !== "[DONE]") {
                  fullText += data;
                  setAiStreamText(fullText);
                  setThinkingAiId(null);
                  setSpeakingAiId(ai.id);
                }
              }
            }
          }
        }

        if (fullText.trim() === "[PASS]" || fullText.trim() === "") {
          setThinkingAiId(null);
          setSpeakingAiId(null);
          setAiStreamText("");
          continue;
        }

        const aiMsg: Message = {
          id: ++msgIdRef.current,
          senderId: ai.id,
          sender: ai.name,
          senderType: "ai",
          text: fullText,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        allMessages = [...allMessages, aiMsg];
        setSpeakingAiId(null);
        setAiStreamText("");

        // TTS with the avatar's own token
        const sentences = splitIntoSentences(fullText);
        for (const sentence of sentences) {
          try {
            const ttsRes = await fetch("/api/tts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: sentence, accessToken: ai.token }),
            });
            const ttsData = await ttsRes.json();
            const url = ttsData.data?.audioUrl || ttsData.data?.url;
            if (url) audioQueueRef.current.enqueue(url);
          } catch { /* continue */ }
        }
      } catch {
        setThinkingAiId(null);
        setSpeakingAiId(null);
        setAiStreamText("");
      }
    }
  }, [aiParticipants, topic]);

  const toggleMic = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    setIsListening(true);
    recognitionRef.current = startSpeechRecognition(
      (text, isFinal) => {
        if (isFinal && text.trim()) {
          const msg: Message = {
            id: ++msgIdRef.current,
            senderId: "me",
            sender: user?.name || "Me",
            senderType: "human",
            text: text.trim(),
            timestamp: Date.now(),
          };
          setMessages((prev) => {
            const next = [...prev, msg];
            setTimeout(() => askAIs(next), 500);
            return next;
          });
          setInterimText("");
        } else {
          setInterimText(text);
        }
      },
      () => setIsListening(false)
    );
  };

  const getAiPosition = (index: number, total: number) => {
    const spacing = 100 / (total + 1);
    return { left: `${spacing * (index + 1)}%` };
  };

  const getLatestMessage = (participantId: string) => {
    return [...messages].reverse().find((m) => m.senderId === participantId);
  };

  return (
    <main className="h-screen w-screen overflow-hidden relative bg-[#FEF3E2]">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-[#9B5DE5]/4 rounded-full blur-[120px]" />
        <div className="absolute top-1/4 right-1/4 w-[350px] h-[350px] bg-[#F4A261]/5 rounded-full blur-[100px]" />
      </div>

      {/* Topic bar */}
      <div className="absolute top-0 left-0 right-0 z-20 px-5 py-3">
        <p className="text-[#3D2C1E]/60 text-sm font-medium">{topic}</p>
        <p className="text-[#3D2C1E]/25 text-[10px]">房间 {roomId} · {aiParticipants.length} 个分身</p>
      </div>

      {/* No avatars hint */}
      {aiParticipants.length === 0 && (
        <div className="absolute top-1/3 left-0 right-0 text-center z-10">
          <p className="text-[#3D2C1E]/20 text-sm">还没有分身参会</p>
          <p className="text-[#3D2C1E]/15 text-xs mt-1">回首页选择分身后再创建会议</p>
        </div>
      )}

      {/* AI participants */}
      <div className="absolute top-16 left-0 right-0 px-8" style={{ height: "55%" }}>
        <div className="relative w-full h-full">
          {aiParticipants.map((ai, i) => {
            const pos = getAiPosition(i, aiParticipants.length);
            const isThinking = thinkingAiId === ai.id;
            const isSpeaking = speakingAiId === ai.id;
            const latestMsg = getLatestMessage(ai.id);
            const showStream = isSpeaking && aiStreamText;

            return (
              <div
                key={ai.id}
                className="absolute -translate-x-1/2 flex flex-col items-center"
                style={{ left: pos.left, top: "15%" }}
              >
                <div
                  className={`
                    w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold overflow-hidden
                    bg-[#9B5DE5]/15 border-2 transition-all duration-500
                    ${isThinking ? "border-[#9B5DE5]/50 animate-ai-thinking" : ""}
                    ${isSpeaking ? "border-[#9B5DE5]/60 animate-speaking scale-105" : "border-[#9B5DE5]/20"}
                    ${!isThinking && !isSpeaking ? "animate-breathe" : ""}
                  `}
                >
                  {ai.avatar ? (
                    <img src={ai.avatar} alt={ai.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-[#9B5DE5]/60">{ai.name[0]}</span>
                  )}
                </div>
                <span className="text-[10px] text-[#9B5DE5]/50 mt-1.5">{ai.name}</span>

                {isThinking && (
                  <div className="mt-2 dot-pulse text-[#9B5DE5]/40 text-lg">
                    <span>·</span><span>·</span><span>·</span>
                  </div>
                )}

                {(showStream || latestMsg) && (
                  <div className="mt-2 max-w-[320px] w-[280px] bg-white/60 backdrop-blur-sm rounded-2xl px-4 py-3 text-sm text-[#3D2C1E]/70 animate-fade-in leading-relaxed">
                    {showStream ? aiStreamText : latestMsg?.text}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Human area */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col items-center pb-8">
        {(interimText || getLatestMessage("me")) && (
          <div className="mb-4 max-w-[320px] bg-white/50 backdrop-blur-sm rounded-2xl px-4 py-2.5 text-sm text-[#3D2C1E]/60 animate-fade-in text-center">
            {interimText || getLatestMessage("me")?.text}
          </div>
        )}

        <div className="flex items-center gap-4">
          <div
            className={`
              w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold overflow-hidden
              bg-[#F4A261]/15 border-2 transition-all duration-300
              ${isListening ? "border-[#F4A261] animate-speaking scale-105" : "border-[#F4A261]/25"}
            `}
          >
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-[#F4A261]/60">{user?.name?.[0] || "?"}</span>
            )}
          </div>

          <button
            onClick={toggleMic}
            className={`
              w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg
              ${isListening
                ? "bg-[#E76F51] text-white animate-pulse-glow scale-110 shadow-[#E76F51]/30"
                : "bg-white/70 text-[#3D2C1E]/40 hover:bg-white hover:text-[#3D2C1E]/60 shadow-black/5"
              }
            `}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isListening ? (
                <rect x="6" y="6" width="12" height="12" rx="2" />
              ) : (
                <>
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </>
              )}
            </svg>
          </button>

          <span className="text-xs text-[#3D2C1E]/30">{user?.name || ""}</span>
        </div>

        {messages.length === 0 && !isListening && (
          <p className="mt-3 text-[#3D2C1E]/15 text-[11px]">点击麦克风开始发言</p>
        )}
      </div>
    </main>
  );
}
