"use client";

import { useState, useEffect, useRef } from "react";

const SNIPPETS = [
  "人到底是先有语言还是先有思想？",
  "如果乔布斯活着会怎么看AI？",
  "意识能被复制吗？",
  "我觉得孤独才是创造力的来源",
  "火星移民的意义不在于生存",
  "每个人都需要一个树洞",
  "Believe me, this is huge!",
  "算法比你更懂你自己，可怕吗？",
  "所有伟大的公司都始于车库",
  "狼人杀第三轮，我怀疑蛋总",
  "自由意志可能只是一种幻觉",
  "最好的决策往往是反直觉的",
  "你有没有和AI说过心里话？",
  "三体人听了都沉默",
  "人类最大的恐惧是被理解",
  "花好月圆！你接不上来了吧",
  "教育的本质是点燃而非灌输",
  "如果能和任何人围炉夜话...",
  "我的分身居然比我还会社交",
  "死亡是最好的发明 — 乔布斯",
  "为什么深夜的对话总是最真诚？",
  "这轮辩论我给满分",
  "宇宙的尽头是考公还是创业？",
  "真正的智慧是知道自己无知",
];

interface Bubble {
  id: number;
  text: string;
  avatarIdx: number;
  side: "left" | "right";
}

interface ChatBubblesProps {
  avatarCount: number;
  avatarPositions: { x: number; y: number }[];
}

export function ChatBubbles({ avatarCount, avatarPositions }: ChatBubblesProps) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const idRef = useRef(0);
  const usedRef = useRef(new Set<number>());

  useEffect(() => {
    if (avatarCount === 0) return;

    function addBubble() {
      const avatarIdx = Math.floor(Math.random() * avatarCount);
      // Pick a random snippet, avoid repeating recent ones
      let snippetIdx: number;
      do {
        snippetIdx = Math.floor(Math.random() * SNIPPETS.length);
      } while (usedRef.current.has(snippetIdx) && usedRef.current.size < SNIPPETS.length - 2);
      usedRef.current.add(snippetIdx);
      if (usedRef.current.size > 8) {
        const first = usedRef.current.values().next().value;
        if (first !== undefined) usedRef.current.delete(first);
      }

      const pos = avatarPositions[avatarIdx];
      const side = pos && pos.x > 0 ? "right" : "left";

      const bubble: Bubble = {
        id: ++idRef.current,
        text: SNIPPETS[snippetIdx],
        avatarIdx,
        side,
      };

      setBubbles((prev) => [...prev.slice(-2), bubble]); // keep max 3
    }

    // Start after a delay
    const startTimer = setTimeout(() => {
      addBubble();
    }, 2000);

    const interval = setInterval(addBubble, 2500 + Math.random() * 1500);

    return () => {
      clearTimeout(startTimer);
      clearInterval(interval);
    };
  }, [avatarCount, avatarPositions]);

  return (
    <>
      {bubbles.map((b) => {
        const pos = avatarPositions[b.avatarIdx];
        if (!pos) return null;
        // Push bubble outward from center, away from the avatar
        const angle = Math.atan2(pos.y, pos.x);
        const pushDist = 32;
        const bx = pos.x + Math.cos(angle) * pushDist;
        const by = pos.y + Math.sin(angle) * pushDist - 10;
        const onRight = pos.x >= 0;
        return (
          <div
            key={b.id}
            className="absolute z-30 pointer-events-none animate-bubble"
            style={{
              left: `calc(50% + ${bx}px)`,
              top: `calc(50% + ${by}px)`,
              transform: onRight ? "translateX(0)" : "translateX(-100%)",
            }}
          >
            <div className="bg-black/40 backdrop-blur-md rounded-lg px-2.5 py-1.5 text-[11px] text-[#FFF8F0]/85 whitespace-nowrap shadow-lg shadow-black/10">
              {b.text}
            </div>
          </div>
        );
      })}
    </>
  );
}
