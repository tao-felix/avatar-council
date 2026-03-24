export type SceneType = "campfire" | "forest" | "none";

export interface SceneConfig {
  label: string;
  emoji: string;
  bgColor: string;
  gradient: string;
  audioSrc: string | null;
  endLabel: string;
  createLabel: string;
  glowClass: string;
}

export const SCENES: Record<SceneType, SceneConfig> = {
  campfire: {
    label: "篝火",
    emoji: "🔥",
    bgColor: "#1a120b",
    gradient: `radial-gradient(ellipse 70% 55% at 50% 55%, rgba(244, 162, 97, 0.10) 0%, transparent 70%),
      radial-gradient(ellipse 45% 40% at 50% 58%, rgba(231, 111, 81, 0.06) 0%, transparent 60%),
      radial-gradient(ellipse at center, rgba(30, 22, 14, 0.3) 0%, rgba(20, 14, 8, 0.85) 100%)`,
    audioSrc: "/ambient/campfire.mp3",
    endLabel: "熄灭篝火",
    createLabel: "点燃篝火",
    glowClass: "animate-campfire-glow",
  },
  forest: {
    label: "森林",
    emoji: "🌿",
    bgColor: "#0f1a12",
    gradient: `radial-gradient(ellipse 70% 55% at 50% 55%, rgba(76, 175, 80, 0.08) 0%, transparent 70%),
      radial-gradient(ellipse 45% 40% at 50% 58%, rgba(56, 142, 60, 0.05) 0%, transparent 60%),
      radial-gradient(ellipse at center, rgba(14, 26, 18, 0.3) 0%, rgba(8, 18, 10, 0.85) 100%)`,
    audioSrc: "/ambient/forest.mp3",
    endLabel: "离开森林",
    createLabel: "进入森林",
    glowClass: "animate-forest-glow",
  },
  none: {
    label: "简洁",
    emoji: "⚪",
    bgColor: "#15151a",
    gradient: `radial-gradient(ellipse 60% 50% at 50% 50%, rgba(255, 255, 255, 0.02) 0%, transparent 70%),
      radial-gradient(ellipse at center, rgba(21, 21, 26, 0.3) 0%, rgba(15, 15, 20, 0.85) 100%)`,
    audioSrc: null,
    endLabel: "结束会议",
    createLabel: "开始会议",
    glowClass: "",
  },
};

export const SCENE_LIST: SceneType[] = ["campfire", "forest", "none"];
