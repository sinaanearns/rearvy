"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-white selection:bg-black selection:text-white">
      {/* Background video layer (z-0) */}
      <VideoBackground />

      {/* Navigation bar (z-10) */}
      <nav className="relative z-10 w-full">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-6">
          <Link href="/" className="group flex items-center">
            <span className="font-instrument text-3xl tracking-tight text-[#000000]">
              Rearvy<sup className="text-xs ml-0.5">®</sup>
            </span>
          </Link>

          <div className="flex items-center gap-8">
            <div className="hidden items-center gap-8 md:flex font-inter">
              <Link href="/" className="text-sm text-[#000000] transition-colors hover:opacity-70">
                Home
              </Link>
              <Link href="/download" className="text-sm text-[#6F6F6F] transition-colors hover:text-[#000000]">
                Download
              </Link>
              <Link href="/demo" className="text-sm text-[#6F6F6F] transition-colors hover:text-[#000000]">
                Demo
              </Link>
              <Link href="/login" className="text-sm text-[#6F6F6F] transition-colors hover:text-[#000000]">
                Signin
              </Link>
            </div>
            <Link
              href="/signup"
              className="font-inter rounded-full bg-[#000000] px-6 py-2.5 text-sm text-white transition-transform hover:scale-[1.03]"
            >
              Signup
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero section (z-10) */}
      <section
        className="relative z-10 flex flex-col items-center justify-center px-6 text-center"
        style={{ paddingTop: 'calc(8rem - 75px)', paddingBottom: '10rem' }}
      >
        <h1 className="animate-fade-rise font-instrument text-5xl font-normal leading-[0.95] tracking-[-2.46px] text-[#000000] sm:text-7xl md:text-8xl max-w-7xl">
          Rearvy turns business context into action.
        </h1>
        <p className="animate-fade-rise-delay mt-8 max-w-2xl text-base leading-relaxed text-[#6F6F6F] sm:text-lg font-inter">
          Built for business execute quick and clean
        </p>
        <Link
          href="/signup"
          className="animate-fade-rise-delay-2 mt-12 rounded-full bg-[#000000] px-14 py-5 text-base text-white transition-transform hover:scale-[1.03] font-inter"
        >
          Signup
        </Link>
      </section>
    </main>
  );
}

function VideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let frameId: number;

    const update = () => {
      if (video.duration && !video.paused) {
        const currentTime = video.currentTime;
        const duration = video.duration;
        const fadeTime = 0.5;

        if (currentTime < fadeTime) {
          // Fade in over 0.5s at the start
          setOpacity(currentTime / fadeTime);
        } else if (currentTime > duration - fadeTime) {
          // Fade out over 0.5s before the end
          const fadeOutOpacity = Math.max(0, (duration - currentTime) / fadeTime);
          setOpacity(fadeOutOpacity);
        } else {
          setOpacity(1);
        }
      }
      frameId = requestAnimationFrame(update);
    };

    frameId = requestAnimationFrame(update);

    const handleEnded = () => {
      setOpacity(0);
      setTimeout(() => {
        if (video) {
          video.currentTime = 0;
          video.play().catch(() => {
            // Auto-play might be blocked
          });
        }
      }, 100);
    };

    video.addEventListener("ended", handleEnded);

    return () => {
      cancelAnimationFrame(frameId);
      video.removeEventListener("ended", handleEnded);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-0 pointer-events-none">
      <video
        ref={videoRef}
        src="/homepage-bg.mp4"
        className="h-full w-full object-cover"
        muted
        autoPlay
        playsInline
        style={{
          opacity,
          position: "absolute",
          top: "300px",
          inset: "auto 0 0 0",
        }}
      />
      {/* Gradient overlays over the video */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-transparent to-white" />
    </div>
  );
}
