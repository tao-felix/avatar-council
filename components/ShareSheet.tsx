"use client";

import { useState, useRef } from "react";

interface ShareSheetProps {
  roomId: string;
  topic: string;
  participantNames: string[];
  onClose: () => void;
}

export function ShareSheet({ roomId, topic, participantNames, onClose }: ShareSheetProps) {
  const [copied, setCopied] = useState(false);
  const [posterReady, setPosterReady] = useState(false);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = `${baseUrl}/room/${roomId}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const generatePoster = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = 750;
    const h = 1334;
    canvas.width = w;
    canvas.height = h;

    // Background
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#1a120b");
    bg.addColorStop(0.5, "#2a1f15");
    bg.addColorStop(1, "#1a120b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Warm glow circle
    const glow = ctx.createRadialGradient(w / 2, h * 0.35, 0, w / 2, h * 0.35, 200);
    glow.addColorStop(0, "rgba(244, 162, 97, 0.15)");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Fire emoji
    ctx.font = "80px serif";
    ctx.textAlign = "center";
    ctx.fillText("🔥", w / 2, h * 0.22);

    // Brand
    ctx.font = "bold 28px sans-serif";
    ctx.fillStyle = "rgba(244, 162, 97, 0.5)";
    ctx.fillText("分身篝火会", w / 2, h * 0.28);

    // Topic
    ctx.font = "bold 48px sans-serif";
    ctx.fillStyle = "rgba(255, 248, 240, 0.9)";
    const topicLines = wrapText(ctx, topic, w - 120);
    topicLines.forEach((line, i) => {
      ctx.fillText(line, w / 2, h * 0.38 + i * 60);
    });

    // Participants
    const nameStr = participantNames.slice(0, 6).join("、");
    ctx.font = "24px sans-serif";
    ctx.fillStyle = "rgba(255, 248, 240, 0.35)";
    ctx.fillText(nameStr, w / 2, h * 0.55);

    // Divider
    ctx.strokeStyle = "rgba(244, 162, 97, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w * 0.2, h * 0.62);
    ctx.lineTo(w * 0.8, h * 0.62);
    ctx.stroke();

    // CTA
    ctx.font = "bold 32px sans-serif";
    ctx.fillStyle = "rgba(244, 162, 97, 0.7)";
    ctx.fillText("扫码加入篝火", w / 2, h * 0.70);

    // QR placeholder — show URL text instead (real QR would need a library)
    ctx.font = "20px monospace";
    ctx.fillStyle = "rgba(255, 248, 240, 0.25)";
    ctx.fillText(shareUrl, w / 2, h * 0.76);

    // Footer
    ctx.font = "18px sans-serif";
    ctx.fillStyle = "rgba(255, 248, 240, 0.15)";
    ctx.fillText("Powered by Second Me", w / 2, h * 0.92);

    const url = canvas.toDataURL("image/png");
    setPosterUrl(url);
    setPosterReady(true);
  };

  const savePoster = () => {
    if (!posterUrl) return;
    const a = document.createElement("a");
    a.href = posterUrl;
    a.download = `篝火会-${topic.slice(0, 10)}.png`;
    a.click();
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${topic} | 分身篝火会`,
          text: `${participantNames.slice(0, 4).join("、")} 正在围炉而谈，来加入！`,
          url: shareUrl,
        });
      } catch { /* user cancelled */ }
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-[#2a1f15] rounded-t-3xl p-6 pb-10 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-5" />
        <h3 className="text-[#FFF8F0]/70 text-sm font-medium mb-5 text-center">分享篝火</h3>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* Copy link */}
          <button
            onClick={copyLink}
            className="flex flex-col items-center gap-2 py-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-[#F4A261]/15 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F4A261" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </div>
            <span className="text-[11px] text-[#FFF8F0]/50">{copied ? "已复制!" : "复制链接"}</span>
          </button>

          {/* Generate poster */}
          <button
            onClick={posterReady ? savePoster : generatePoster}
            className="flex flex-col items-center gap-2 py-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-[#9B5DE5]/15 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9B5DE5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <span className="text-[11px] text-[#FFF8F0]/50">{posterReady ? "保存海报" : "生成海报"}</span>
          </button>

          {/* Native share (mobile) */}
          {"share" in navigator && (
            <button
              onClick={nativeShare}
              className="flex flex-col items-center gap-2 py-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-[#4CAF50]/15 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              </div>
              <span className="text-[11px] text-[#FFF8F0]/50">更多分享</span>
            </button>
          )}
        </div>

        {/* URL preview */}
        <div className="bg-white/5 rounded-xl px-4 py-3 flex items-center gap-2">
          <span className="text-[11px] text-[#FFF8F0]/30 truncate flex-1">{shareUrl}</span>
          <button
            onClick={copyLink}
            className="text-[11px] text-[#F4A261]/60 hover:text-[#F4A261] shrink-0"
          >
            {copied ? "✓" : "复制"}
          </button>
        </div>

        {/* Poster preview */}
        {posterReady && posterUrl && (
          <div className="mt-4 rounded-xl overflow-hidden border border-white/5">
            <img src={posterUrl} alt="分享海报" className="w-full" />
          </div>
        )}

        {/* Hidden canvas for poster generation */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}

/** Helper: wrap text to fit width */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const char of text) {
    const test = line + char;
    if (ctx.measureText(test).width > maxWidth && line.length > 0) {
      lines.push(line);
      line = char;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3); // Max 3 lines
}
