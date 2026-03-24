"use client";

import { useRef, useEffect } from "react";

interface CampfireProps {
  width?: number;
  height?: number;
  intensity?: number;
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  type: "fire" | "ember" | "smoke";
}

export function Campfire({ width = 160, height = 200, intensity = 0.7, className }: CampfireProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const particles: Particle[] = [];
    let animId: number;
    const baseY = height * 0.6;
    const centerX = width / 2;
    const maxParticles = Math.round(120 * intensity);

    function emitFire() {
      const spread = 16 * intensity;
      particles.push({
        x: centerX + (Math.random() - 0.5) * spread,
        y: baseY + (Math.random() - 0.5) * 4,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -(Math.random() * 1.6 + 0.6),
        size: Math.random() * 12 + 8,
        life: 0,
        maxLife: Math.random() * 30 + 18,
        type: "fire",
      });
    }

    function emitEmber() {
      if (Math.random() > 0.1) return;
      particles.push({
        x: centerX + (Math.random() - 0.5) * 12,
        y: baseY - Math.random() * 20,
        vx: (Math.random() - 0.5) * 3,
        vy: -(Math.random() * 1 + 0.3),
        size: Math.random() * 2.5 + 1,
        life: 0,
        maxLife: Math.random() * 50 + 35,
        type: "ember",
      });
    }

    function emitSmoke() {
      if (Math.random() > 0.03) return;
      particles.push({
        x: centerX + (Math.random() - 0.5) * 6,
        y: baseY - 30 - Math.random() * 10,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -(Math.random() * 0.3 + 0.1),
        size: Math.random() * 15 + 10,
        life: 0,
        maxLife: Math.random() * 70 + 40,
        type: "smoke",
      });
    }

    function frame() {
      ctx!.clearRect(0, 0, width, height);

      // Draw a soft base glow at the fire origin
      const baseGlow = ctx!.createRadialGradient(centerX, baseY, 0, centerX, baseY, 50);
      baseGlow.addColorStop(0, "rgba(244, 162, 97, 0.4)");
      baseGlow.addColorStop(0.3, "rgba(244, 162, 97, 0.15)");
      baseGlow.addColorStop(0.7, "rgba(231, 111, 81, 0.05)");
      baseGlow.addColorStop(1, "rgba(244, 162, 97, 0)");
      ctx!.fillStyle = baseGlow;
      ctx!.fillRect(0, 0, width, height);

      // Use lighter blending — makes fire glow on dark backgrounds
      ctx!.globalCompositeOperation = "lighter";

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        if (p.life > p.maxLife) {
          particles.splice(i, 1);
          continue;
        }
        const progress = p.life / p.maxLife;
        p.x += p.vx + (Math.random() - 0.5) * (p.type === "fire" ? 0.4 : 0.12);
        p.y += p.vy;
        if (p.type === "fire") p.vy *= 0.99;
        if (p.type === "smoke") {
          p.vx *= 1.01;
          p.size *= 1.003;
        }

        const alpha = Math.max(0, 1 - progress);

        if (p.type === "fire") {
          // Fire: warm gradient circles, opaque enough to see on light bg
          const size = p.size * (1 - progress * 0.5);
          // Color shifts from bright yellow-white → orange → coral → dark as it rises
          const t = progress;
          const r = Math.round(255 - t * 60);
          const g = Math.round(220 - t * 140);
          const b = Math.round(140 - t * 100);

          const gradient = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, size);
          gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha * 0.9})`);
          gradient.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, ${alpha * 0.5})`);
          gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

          ctx!.beginPath();
          ctx!.arc(p.x, p.y, size, 0, Math.PI * 2);
          ctx!.fillStyle = gradient;
          ctx!.fill();
        } else if (p.type === "ember") {
          // Embers: bright tiny dots that twinkle
          const twinkle = 0.3 + Math.sin(p.life * 0.4) * 0.7;
          const size = p.size * (1 - progress * 0.2);
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, size, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(255, 180, 60, ${alpha * twinkle * 0.9})`;
          ctx!.fill();
          // Bright core
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, size * 0.4, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(255, 240, 200, ${alpha * twinkle * 0.8})`;
          ctx!.fill();
        } else {
          // Smoke: very subtle grey wisps
          const size = p.size * (1 + progress);
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, size, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(100, 80, 65, ${alpha * 0.04})`;
          ctx!.fill();
        }
      }

      // Emit new particles
      const emitCount = Math.max(1, Math.round(2.5 * intensity));
      for (let i = 0; i < emitCount; i++) emitFire();
      emitEmber();
      emitSmoke();

      while (particles.length > maxParticles) particles.shift();
      animId = requestAnimationFrame(frame);
    }

    frame();
    return () => cancelAnimationFrame(animId);
  }, [width, height, intensity]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className={`pointer-events-none ${className ?? ""}`}
    />
  );
}
