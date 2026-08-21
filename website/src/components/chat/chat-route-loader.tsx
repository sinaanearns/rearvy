"use client";

import { useEffect } from "react";

type ChatRouteLoaderProps = {
  title?: string;
  detail?: string;
  contextLabel?: string;
  variant?: "chat" | "project";
};

export function ChatRouteLoader({ 
  title = "", 
  detail = "", 
  contextLabel, 
  variant 
}: ChatRouteLoaderProps) {
  useEffect(() => {
    // Insert keyframes for blinking dots if not already present
    if (!document.getElementById("chat-loader-keyframes")) {
      const style = document.createElement("style");
      style.id = "chat-loader-keyframes";
      style.textContent = `
        @keyframes blink {
          0%, 80%, 100% { opacity: 0.2; }
          40% { opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
    return () => {
      const style = document.getElementById("chat-loader-keyframes");
      if (style) {
        style.remove();
      }
    };
  }, []);

  return (
    <div className="flex min-h-[420px] flex-1 items-center justify-center bg-black">
      <div className="flex space-x-2">
        {[1,2,3].map(i => (
          <div 
            key={i} 
            className="h-2 w-2 rounded-full bg-white/70" 
            style={{ animation: "blink 1.4s infinite ease-in-out", animationDelay: `${(i-1) * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  );
}
