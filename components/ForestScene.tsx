"use client";

import { useRef, useEffect } from "react";

interface ForestSceneProps {
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
  type: "leaf" | "firefly";
  hue: number;
  phase: number;
}

export function ForestScene({ width = 160, height = 200, intensity = 0.7, className }: ForestSceneProps) {
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
    let tick = 0;
    const centerX = width / 2;
    const groundY = height * 0.72;
    const maxParticles = Math.round(80 * intensity);

    // Tree geometry
    const trunkX = centerX;
    const trunkBottom = groundY;
    const trunkTop = height * 0.32;
    const trunkW = 4;
    const canopyY = height * 0.18;
    const canopyR = 28;

    function drawTree() {
      // Trunk
      ctx!.fillStyle = "rgba(90, 65, 40, 0.6)";
      ctx!.beginPath();
      ctx!.moveTo(trunkX - trunkW, trunkBottom);
      ctx!.lineTo(trunkX - trunkW * 0.6, trunkTop);
      ctx!.lineTo(trunkX + trunkW * 0.6, trunkTop);
      ctx!.lineTo(trunkX + trunkW, trunkBottom);
      ctx!.closePath();
      ctx!.fill();

      // Small branches
      ctx!.strokeStyle = "rgba(90, 65, 40, 0.35)";
      ctx!.lineWidth = 1.5;
      const branchY1 = trunkTop + (trunkBottom - trunkTop) * 0.3;
      ctx!.beginPath();
      ctx!.moveTo(trunkX, branchY1);
      ctx!.quadraticCurveTo(trunkX - 14, branchY1 - 10, trunkX - 18, branchY1 - 6);
      ctx!.stroke();
      ctx!.beginPath();
      ctx!.moveTo(trunkX, branchY1 - 8);
      ctx!.quadraticCurveTo(trunkX + 12, branchY1 - 18, trunkX + 16, branchY1 - 14);
      ctx!.stroke();

      // Canopy — layered soft circles for organic look
      const sway = Math.sin(tick * 0.008) * 1.5;
      const layers = [
        { x: centerX + sway, y: canopyY + 8, r: canopyR, a: 0.25 },
        { x: centerX - 10 + sway * 0.7, y: canopyY + 2, r: canopyR * 0.75, a: 0.2 },
        { x: centerX + 10 + sway * 0.7, y: canopyY + 4, r: canopyR * 0.7, a: 0.2 },
        { x: centerX + sway * 0.5, y: canopyY - 5, r: canopyR * 0.6, a: 0.18 },
      ];

      for (const l of layers) {
        const grad = ctx!.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
        grad.addColorStop(0, `rgba(56, 142, 60, ${l.a})`);
        grad.addColorStop(0.6, `rgba(76, 175, 80, ${l.a * 0.6})`);
        grad.addColorStop(1, `rgba(76, 175, 80, 0)`);
        ctx!.beginPath();
        ctx!.arc(l.x, l.y, l.r, 0, Math.PI * 2);
        ctx!.fillStyle = grad;
        ctx!.fill();
      }
    }

    function emitLeaf() {
      if (Math.random() > 0.06 * intensity) return;
      // Leaves fall from near the canopy area
      const hue = 85 + Math.random() * 55;
      particles.push({
        x: centerX + (Math.random() - 0.5) * canopyR * 2,
        y: canopyY + Math.random() * 20,
        vx: (Math.random() - 0.5) * 0.5,
        vy: Math.random() * 0.3 + 0.15,
        size: Math.random() * 3 + 1.5,
        life: 0,
        maxLife: Math.random() * 180 + 120,
        type: "leaf",
        hue,
        phase: Math.random() * Math.PI * 2,
      });
    }

    function emitFirefly() {
      if (Math.random() > 0.015 * intensity) return;
      particles.push({
        x: centerX + (Math.random() - 0.5) * width * 0.6,
        y: groundY - Math.random() * height * 0.4,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.15,
        size: Math.random() * 1.8 + 0.8,
        life: 0,
        maxLife: Math.random() * 120 + 80,
        type: "firefly",
        hue: 48 + Math.random() * 20,
        phase: Math.random() * Math.PI * 2,
      });
    }

    function frame() {
      tick++;
      ctx!.clearRect(0, 0, width, height);

      // Soft ground glow
      const groundGlow = ctx!.createRadialGradient(centerX, groundY, 0, centerX, groundY, 50);
      groundGlow.addColorStop(0, "rgba(76, 175, 80, 0.08)");
      groundGlow.addColorStop(0.5, "rgba(76, 175, 80, 0.03)");
      groundGlow.addColorStop(1, "rgba(76, 175, 80, 0)");
      ctx!.fillStyle = groundGlow;
      ctx!.fillRect(0, 0, width, height);

      // Draw tree (behind particles)
      drawTree();

      ctx!.globalCompositeOperation = "lighter";

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        if (p.life > p.maxLife) {
          particles.splice(i, 1);
          continue;
        }
        const progress = p.life / p.maxLife;

        if (p.type === "leaf") {
          p.x += p.vx + Math.sin(p.life * 0.025 + p.phase) * 0.25;
          p.y += p.vy;
          p.vy += 0.001;

          const alpha = progress < 0.1 ? progress * 10 : progress > 0.8 ? (1 - progress) * 5 : 1;
          const size = p.size * (1 - progress * 0.3);

          ctx!.beginPath();
          ctx!.ellipse(p.x, p.y, size, size * 0.55, Math.sin(p.life * 0.02 + p.phase) * 0.5, 0, Math.PI * 2);
          ctx!.fillStyle = `hsla(${p.hue}, 55%, 42%, ${alpha * 0.45})`;
          ctx!.fill();
        } else {
          p.x += p.vx + Math.sin(p.life * 0.02 + p.phase) * 0.12;
          p.y += p.vy + Math.cos(p.life * 0.015 + p.phase) * 0.08;

          const blink = Math.pow(Math.sin(p.life * 0.05 + p.phase), 2);
          const fadeIn = Math.min(1, p.life / 20);
          const fadeOut = progress > 0.8 ? (1 - progress) * 5 : 1;
          const alpha = blink * fadeIn * fadeOut;

          if (alpha > 0.05) {
            const glow = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3.5);
            glow.addColorStop(0, `hsla(${p.hue}, 80%, 70%, ${alpha * 0.35})`);
            glow.addColorStop(0.5, `hsla(${p.hue}, 80%, 60%, ${alpha * 0.12})`);
            glow.addColorStop(1, `hsla(${p.hue}, 80%, 50%, 0)`);
            ctx!.beginPath();
            ctx!.arc(p.x, p.y, p.size * 3.5, 0, Math.PI * 2);
            ctx!.fillStyle = glow;
            ctx!.fill();

            ctx!.beginPath();
            ctx!.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
            ctx!.fillStyle = `hsla(${p.hue}, 90%, 85%, ${alpha * 0.8})`;
            ctx!.fill();
          }
        }
      }

      ctx!.globalCompositeOperation = "source-over";

      emitLeaf();
      emitFirefly();

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
