"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface SceneAudioProps {
  audioSrc: string | null;
}

export function SceneAudio({ audioSrc }: SceneAudioProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const startedRef = useRef(false);

  const start = useCallback(() => {
    if (startedRef.current || !audioSrc) return;
    startedRef.current = true;

    const audio = new Audio(audioSrc);
    audio.loop = true;
    audio.volume = 0.12;
    audioRef.current = audio;
    audio.play().then(() => setPlaying(true)).catch(() => { startedRef.current = false; });
  }, [audioSrc]);

  const toggle = useCallback(() => {
    if (!audioRef.current) { start(); return; }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => {});
    }
  }, [playing, start]);

  // Try to start on any user gesture
  useEffect(() => {
    if (!audioSrc) return;
    const events = ["click", "touchstart", "keydown", "pointerdown"];
    const handler = () => {
      start();
      events.forEach((e) => document.removeEventListener(e, handler));
    };
    events.forEach((e) => document.addEventListener(e, handler, { once: true, passive: true }));
    return () => {
      events.forEach((e) => document.removeEventListener(e, handler));
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      startedRef.current = false;
    };
  }, [start, audioSrc]);

  if (!audioSrc) return null;

  return (
    <button
      onClick={(e) => { e.stopPropagation(); toggle(); }}
      className="fixed bottom-5 right-5 z-50 w-9 h-9 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-[#FFF8F0]/60 hover:text-[#FFF8F0]/80 hover:bg-black/30 transition-colors"
      title={playing ? "关闭背景音" : "开启背景音"}
    >
      {playing ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      )}
    </button>
  );
}
