"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { startSpeechRecognition, splitIntoSentences } from "@/lib/speech";
import { AudioQueue } from "@/lib/audio-queue";

interface Participant {
  id: string;
  name: string;
  avatar?: string;
  type: "human" | "ai";
}

interface Message {
  id: number;
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
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [visibleMessages, setVisibleMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [aiThinking, setAiThinking] = useState<string | null>(null); // AI id that's thinking
  const [aiSpeakingText, setAiSpeakingText] = useState("");

  const recognitionRef = useRef<ReturnType<typeof startSpeechRecognition>>(null);
  const audioQueueRef = useRef<AudioQueue>(new AudioQueue());
  const msgIdRef = useRef(0);
  const sessionIdRef = useRef<string | undefined>(undefined);

  // Init
  useEffect(() => {
    const raw = getCookie("sm_user");
    if (raw) {
      try {
        const u = JSON.parse(raw);
        setUser(u);
      } catch { /* ignore */ }
    }

    // Get topic from sessionStorage or use default
    const roomData = sessionStorage.getItem(`room_${roomId}`);
    if (roomData) {
      const { topic: t } = JSON.parse(roomData);
      setTopic(t);
    } else {
      setTopic("自由讨论");
    }
  }, [roomId]);

  // Set participants once user is loaded
  useEffect(() => {
    if (!user) return;
    setParticipants([
      { id: "me", name: user.name, avatar: user.avatar, type: "human" },
      { id: "ai1", name: "AI 分身", type: "ai" },
    ]);
  }, [user]);

  // Fade out messages after 8 seconds
  useEffect(() => {
    setVisibleMessages(messages.slice(-6));
  }, [messages]);

  useEffect(() => {
    if (visibleMessages.length === 0) return;
    const timer = setTimeout(() => {
      setVisibleMessages((prev) => prev.slice(1));
    }, 8000);
    return () => clearTimeout(timer);
  }, [visibleMessages]);

  // Ask AI to respond
  const askAI = useCallback(async (allMessages: Message[]) => {
    const token = getCookie("sm_token");
    if (!token) return;

    const aiParticipant = participants.find((p) => p.type === "ai");
    if (!aiParticipant) return;

    setAiThinking(aiParticipant.id);
    setAiSpeakingText("");

    // Build conversation context
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
          sessionId: sessionIdRef.current,
          systemPrompt: SYSTEM_PROMPT,
          accessToken: token,
        }),
      });

      if (!res.ok || !res.body) {
        setAiThinking(null);
        return;
      }

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
              // Extract session ID if present
              if (parsed.sessionId) {
                sessionIdRef.current = parsed.sessionId;
              }
              // Extract text content
              const chunk =
                parsed.choices?.[0]?.delta?.content ||
                parsed.content ||
                parsed.text ||
                "";
              if (chunk) {
                fullText += chunk;
                setAiSpeakingText(fullText);
                setAiThinking(null); // Stop thinking, start speaking
              }
            } catch {
              // Not JSON, might be plain text
              if (data && data !== "[DONE]") {
                fullText += data;
                setAiSpeakingText(fullText);
                setAiThinking(null);
              }
            }
          }
        }
      }

      // Check for [PASS]
      if (fullText.trim() === "[PASS]" || fullText.trim() === "") {
        setAiThinking(null);
        setAiSpeakingText("");
        return;
      }

      // Add AI message
      const aiMsg: Message = {
        id: ++msgIdRef.current,
        sender: aiParticipant.name,
        senderType: "ai",
        text: fullText,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setAiSpeakingText("");

      // TTS - split into sentences and play
      const sentences = splitIntoSentences(fullText);
      for (const sentence of sentences) {
        try {
          const ttsRes = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: sentence, accessToken: token }),
          });
          const ttsData = await ttsRes.json();
          if (ttsData.data?.audioUrl || ttsData.data?.url) {
            audioQueueRef.current.enqueue(ttsData.data.audioUrl || ttsData.data.url);
          }
        } catch {
          // TTS failed for this sentence, continue
        }
      }
    } catch {
      setAiThinking(null);
      setAiSpeakingText("");
    }
  }, [participants, topic]);

  // Toggle microphone
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
            sender: user?.name || "Me",
            senderType: "human",
            text: text.trim(),
            timestamp: Date.now(),
          };
          setMessages((prev) => {
            const next = [...prev, msg];
            // Trigger AI response
            setTimeout(() => askAI(next), 500);
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

  // Position participants in a circle
  const getPosition = (index: number, total: number) => {
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
    const radius = Math.min(35, 25 + total * 3); // % of container
    return {
      left: `${50 + radius * Math.cos(angle)}%`,
      top: `${50 + radius * Math.sin(angle)}%`,
    };
  };

  // Find who's currently speaking
  const speakingId = isListening ? "me" : aiSpeakingText ? "ai1" : null;

  return (
    <main className="h-screen w-screen overflow-hidden relative">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-[#9B5DE5]/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-[#F4A261]/5 rounded-full blur-[120px]" />
      </div>

      {/* Topic - minimal top */}
      <div className="absolute top-6 left-0 right-0 text-center z-10">
        <p className="text-[#FFF8F0]/25 text-xs tracking-widest uppercase">
          {topic}
        </p>
        <p className="text-[#FFF8F0]/15 text-[10px] mt-1">
          房间 {roomId}
        </p>
      </div>

      {/* Circle of participants */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-[min(90vw,600px)] h-[min(90vw,600px)]">
          {/* Center table glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-[#F4A261]/5 blur-xl" />

          {participants.map((p, i) => {
            const pos = getPosition(i, participants.length);
            const isSpeaking = speakingId === p.id;
            const isThinking = aiThinking === p.id;
            const isAI = p.type === "ai";

            // Find latest message from this participant
            const latestMsg = visibleMessages.findLast((m) =>
              (p.id === "me" && m.senderType === "human") ||
              (isAI && m.senderType === "ai")
            );

            return (
              <div
                key={p.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2"
                style={pos}
              >
                {/* Avatar */}
                <div
                  className={`
                    relative w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold
                    transition-all duration-500
                    ${isAI ? "bg-[#9B5DE5]/20 border-2 border-[#9B5DE5]/30" : "bg-[#F4A261]/20 border-2 border-[#F4A261]/30"}
                    ${isSpeaking ? "animate-speaking scale-110" : ""}
                    ${isThinking ? "animate-ai-glow" : ""}
                    ${isAI ? "animate-breathe" : ""}
                  `}
                >
                  {p.avatar ? (
                    <img src={p.avatar} alt={p.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className={isAI ? "text-[#9B5DE5]/70" : "text-[#F4A261]/70"}>
                      {p.name[0]}
                    </span>
                  )}

                  {/* Speaking indicator ring */}
                  {isSpeaking && (
                    <div className="absolute inset-0 rounded-full border-2 border-[#F4A261] animate-speaking" />
                  )}
                </div>

                {/* Name */}
                <span className={`text-xs ${isAI ? "text-[#9B5DE5]/50" : "text-[#FFF8F0]/30"}`}>
                  {p.name}
                </span>

                {/* Thinking bubble */}
                {isThinking && (
                  <div className="absolute -top-8 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-[#FFF8F0]/50 animate-fade-in">
                    ...
                  </div>
                )}

                {/* Speech bubble - latest message */}
                {latestMsg && (
                  <div className="absolute top-full mt-3 max-w-[200px] bg-white/5 backdrop-blur-sm rounded-xl px-3 py-2 text-xs text-[#FFF8F0]/70 animate-fade-in text-center">
                    {latestMsg.text.length > 80 ? latestMsg.text.slice(0, 80) + "..." : latestMsg.text}
                  </div>
                )}

                {/* AI streaming text */}
                {isAI && aiSpeakingText && !latestMsg && (
                  <div className="absolute top-full mt-3 max-w-[200px] bg-white/5 backdrop-blur-sm rounded-xl px-3 py-2 text-xs text-[#9B5DE5]/70 animate-fade-in text-center">
                    {aiSpeakingText.length > 80 ? aiSpeakingText.slice(0, 80) + "..." : aiSpeakingText}
                  </div>
                )}

                {/* Human interim text */}
                {p.id === "me" && interimText && (
                  <div className="absolute top-full mt-3 max-w-[200px] bg-white/5 backdrop-blur-sm rounded-xl px-3 py-2 text-xs text-[#F4A261]/50 animate-fade-in text-center">
                    {interimText}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mic button - bottom center */}
      <div className="absolute bottom-12 left-0 right-0 flex justify-center z-10">
        <button
          onClick={toggleMic}
          className={`
            w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300
            ${isListening
              ? "bg-[#E76F51] animate-pulse-glow scale-110"
              : "bg-white/10 hover:bg-white/15"
            }
          `}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {isListening ? (
              // Stop icon
              <rect x="6" y="6" width="12" height="12" rx="2" />
            ) : (
              // Mic icon
              <>
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Subtle hint */}
      {messages.length === 0 && !isListening && (
        <div className="absolute bottom-32 left-0 right-0 text-center">
          <p className="text-[#FFF8F0]/15 text-xs">点击麦克风开始发言</p>
        </div>
      )}
    </main>
  );
}
