"use client";

import { useEffect, useRef } from "react";

export function AnimatedChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = 400 * dpr;
    canvas.height = 250 * dpr;
    ctx.scale(dpr, dpr);

    const isDark = document.documentElement.classList.contains("dark");
    const colors = {
      bar1: isDark ? "#6366f1" : "#4f46e5",
      bar2: isDark ? "#06b6d4" : "#0891b2",
      bar3: isDark ? "#8b5cf6" : "#7c3aed",
      line: isDark ? "#94a3b8" : "#cbd5e1",
      text: isDark ? "#e2e8f0" : "#64748b",
    };

    let animationFrameId: number;
    let time = 0;

    const animate = () => {
      time += 0.02;

      // Clear canvas
      ctx.fillStyle = isDark ? "#0f172a" : "#ffffff";
      ctx.fillRect(0, 0, 400, 250);

      // Draw grid
      ctx.strokeStyle = colors.line;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.1;
      for (let i = 0; i <= 4; i++) {
        const y = 30 + (i * 160) / 4;
        ctx.beginPath();
        ctx.moveTo(40, y);
        ctx.lineTo(380, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Draw bars with animation
      const bars = [
        { value: Math.sin(time) * 0.5 + 0.7, color: colors.bar1 },
        { value: Math.cos(time * 0.8) * 0.5 + 0.75, color: colors.bar2 },
        { value: Math.sin(time * 1.2 + 1) * 0.5 + 0.8, color: colors.bar3 },
      ];

      const barWidth = 40;
      const gap = 20;
      const baseX = 60;

      bars.forEach((bar, i) => {
        const x = baseX + i * (barWidth + gap);
        const height = bar.value * 160;
        const y = 190 - height;

        ctx.fillStyle = bar.color;
        ctx.fillRect(x, y, barWidth, height);

        // Glow effect
        ctx.fillStyle = bar.color;
        ctx.globalAlpha = 0.2;
        ctx.fillRect(x - 4, y - 4, barWidth + 8, height + 8);
        ctx.globalAlpha = 1;
      });

      // Draw labels
      ctx.fillStyle = colors.text;
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      bars.forEach((_, i) => {
        const x = baseX + i * (barWidth + gap) + barWidth / 2;
        ctx.fillText(["Chat", "Data", "Insights"][i], x, 220);
      });

      // Draw axis
      ctx.strokeStyle = colors.line;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(40, 30);
      ctx.lineTo(40, 190);
      ctx.lineTo(380, 190);
      ctx.stroke();

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="flex justify-center">
      <canvas
        ref={canvasRef}
        width={400}
        height={250}
        className="max-w-full rounded-lg border border-border/30 bg-card/50 backdrop-blur"
      />
    </div>
  );
}
