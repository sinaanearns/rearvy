"use client";

import React, { useState, useEffect, useRef } from "react";
import SceneChat from "./SceneChat";
import SceneBrowser from "./SceneBrowser";
import SceneAutopilot from "./SceneAutopilot";
import SceneVoice from "./SceneVoice";
import { MessageSquare, Search, Cpu, Mic, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { animate, createTimeline, stagger } from "animejs";

const SCENES = [
  {
    title: "AI Decision Chat",
    description: "Ask questions in plain English to fetch live metrics, margin breakdowns, and operations briefs.",
    icon: MessageSquare,
    component: SceneChat,
  },
  {
    title: "Competitor Scraper",
    description: "Rearvy deploys browser agents to search the web, analyze competitor sites, and compile pricing maps.",
    icon: Search,
    component: SceneBrowser,
  },
  {
    title: "Autonomous Autopilot",
    description: "Enable autopilot for stock levels or ad sets. Rearvy triggers supplier purchase orders and budget shifts.",
    icon: Cpu,
    component: SceneAutopilot,
  },
  {
    title: "Background Voice HUD",
    description: "Press Alt + Space from any program to trigger the golden voice wave client and get today's executive summary.",
    icon: Mic,
    component: SceneVoice,
  },
];

const SCENE_DURATION = 6500; // 6.5 seconds per scene

export default function FeatureStudio() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTimeRef = useRef<number>(Date.now());

  // Handle progress interval
  useEffect(() => {
    // Reset progress on active index change
    setProgress(0);
    lastTimeRef.current = Date.now();

    const intervalTime = 50;
    progressTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        const elapsed = Date.now() - lastTimeRef.current;
        const incrementalProgress = (elapsed / SCENE_DURATION) * 100;
        
        if (incrementalProgress >= 100) {
          // Advance to next index
          setActiveIndex((prevIndex) => (prevIndex + 1) % SCENES.length);
          return 0;
        }
        return Math.min(incrementalProgress, 100);
      });
    }, intervalTime);

    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
    };
  }, [activeIndex]);

  // AnimeJS Entrance Staggers
  useEffect(() => {
    const tl = createTimeline({
      defaults: { ease: "outExpo" }
    });

    tl.add(".anime-word", {
      translateY: [30, 0],
      opacity: [0, 1],
      duration: 800,
      delay: stagger(50),
    })
    .add(".anime-desc", {
      translateY: [15, 0],
      opacity: [0, 1],
      duration: 600,
    }, "-=600")
    .add(".anime-ctas", {
      translateY: [15, 0],
      opacity: [0, 1],
      duration: 600,
    }, "-=500")
    .add(".anime-tab-item", {
      translateX: [-25, 0],
      opacity: [0, 1],
      duration: 700,
      delay: stagger(80),
    }, "-=400");
  }, []);

  // AnimeJS Scene Transition Animation
  useEffect(() => {
    animate(".anime-viewport", {
      scale: [0.97, 1],
      opacity: [0.85, 1],
      duration: 600,
      ease: "outCubic",
    });
  }, [activeIndex]);

  const handleTabClick = (index: number) => {
    setActiveIndex(index);
  };

  const ActiveSceneComponent = SCENES[activeIndex].component;

  return (
    <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
      {/* Left Column: Headline and Auto-play Tabs */}
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5 text-xs font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Decision Intelligence Engine
          </div>
          
          {/* Headline split into stagger-friendly words */}
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-[54px] leading-[1.05] flex flex-wrap gap-x-[0.22em] gap-y-[0.05em]">
            {["Run", "operations", "with", "an", "autonomous"].map((word, idx) => (
              <span key={idx} className="anime-word opacity-0 inline-block">
                {word}
              </span>
            ))}
            <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-amber-300 bg-clip-text text-transparent anime-word opacity-0 inline-block font-black">
              agent layer.
            </span>
          </h1>

          <p className="max-w-xl text-base leading-7 text-white/60 anime-desc opacity-0">
            Rearvy unifies live commerce, marketing, and support data, then deploys background agents that research, report, and automate tasks.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap gap-3 anime-ctas opacity-0">
          <Link href="/signup">
            <Button size="lg" className="h-11 bg-gradient-to-r from-emerald-600 to-emerald-800 text-white font-medium hover:from-emerald-500 hover:to-emerald-700 shadow-[0_4px_20px_rgba(16,185,129,0.3)] border border-emerald-400/20 px-6">
              Start Free Trial
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="h-11 border-white/10 bg-white/5 px-6 text-white/80 hover:bg-white/10 hover:text-white">
              Sign In
            </Button>
          </Link>
        </div>

        {/* Vertical Tabs List */}
        <div className="mt-8 space-y-3">
          {SCENES.map((scene, index) => {
            const Icon = scene.icon;
            const isActive = index === activeIndex;

            return (
              <button
                key={scene.title}
                onClick={() => handleTabClick(index)}
                className={`anime-tab-item opacity-0 w-full text-left p-4 rounded-xl border transition-all duration-300 relative overflow-hidden group ${
                  isActive
                    ? "border-emerald-500/20 bg-[#0e161c]/45"
                    : "border-white/5 bg-transparent hover:bg-white/2 hover:border-white/10"
                }`}
              >
                {/* Horizontal Auto-Play Progress Bar for active tab */}
                {isActive && (
                  <div 
                    className="absolute left-0 bottom-0 h-[2px] bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-100 ease-linear"
                    style={{ width: `${progress}%` }}
                  />
                )}

                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg shrink-0 transition-colors ${
                    isActive 
                      ? "bg-emerald-500/10 text-emerald-400" 
                      : "bg-white/5 text-white/40 group-hover:text-white/60"
                  }`}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <h3 className={`text-sm font-semibold transition-colors ${
                      isActive ? "text-white" : "text-white/70 group-hover:text-white"
                    }`}>
                      {scene.title}
                    </h3>
                    <p className="text-[11px] text-white/40 mt-1 leading-5">
                      {scene.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Column: Device Viewport Screen */}
      <div className="flex justify-center lg:justify-end">
        <div className="relative w-full max-w-[500px] aspect-[1.12/1]">
          {/* External Shadow and Glow */}
          <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-tr from-emerald-600/15 via-transparent to-amber-500/10 blur-3xl opacity-80" />
          
          {/* Laptop/Screen Bezel Frame */}
          <div className="anime-viewport w-full h-full rounded-2xl border border-white/10 bg-[#04060a] p-2.5 shadow-[0_30px_70px_rgba(0,0,0,0.8)] relative">
            <div className="w-full h-full rounded-xl bg-black overflow-hidden relative border border-white/5">
              <ActiveSceneComponent />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
