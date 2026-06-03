"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CirclePlay,
  Download,
  FileText,
  FolderKanban,
  LineChart,
  MessageSquare,
  Plug,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { RearvyPublicShell } from "@/components/public/rearvy-public-shell";
import { isElectron } from "@/lib/utils/env";

type CurrentCapability = {
  title: string;
  description: string;
  icon: string;
  points: string[];
};

type RoadmapItem = {
  title: string;
  detail: string;
  icon: string;
};

interface Props {
  currentCapabilities: CurrentCapability[];
  roadmapPriorities: RoadmapItem[];
}

const ICON_MAP = {
  MessageSquare,
  Bell,
  CirclePlay,
  FolderKanban,
  Plug,
  FileText,
  ShieldCheck,
  LineChart,
  Download,
};

export default function FeaturesClient({ currentCapabilities, roadmapPriorities }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (isElectron()) {
      router.replace("/login");
    }
  }, [router]);

  return (
    <RearvyPublicShell
      eyebrow={
        <>
          <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
          Product focus
        </>
      }
      title={
        <>
          Agency review
          <span className="block">workflows.</span>
        </>
      }
      description="Rearvy helps growth agencies connect client data, explain what changed, and prepare the next move before the client meeting starts."
      primaryCta={{ href: "/signup", label: "Start for free" }}
      secondaryCta={{ href: "/download", label: "Download" }}
      stats={[
        { value: "9", label: "Implemented sources" },
        { value: "1", label: "Workspace for context" },
        { value: "3", label: "Roadmap priorities" },
      ]}
    >
      <section className="mx-auto w-full max-w-[1180px] px-6">
        <div className="grid gap-5 md:grid-cols-2">
          {currentCapabilities.map((feature) => {
            const Icon = ICON_MAP[feature.icon as keyof typeof ICON_MAP];

            return (
              <article
                key={feature.title}
                className="rounded-xl border border-white/12 bg-black/45 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl transition hover:border-white/22 hover:bg-white/10"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/10 text-cyan-100">
                    {Icon ? <Icon className="h-5 w-5" /> : null}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-white">{feature.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-white/68">{feature.description}</p>
                  </div>
                </div>
                <ul className="mt-5 grid gap-3">
                  {feature.points.map((point) => (
                    <li key={point} className="flex gap-3 text-sm leading-6 text-white/68">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-200" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto mt-6 w-full max-w-[1180px] px-6">
        <div className="rounded-xl border border-white/12 bg-white/7 p-6 backdrop-blur-xl sm:p-8">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Near-term roadmap
            </h2>
            <p className="mt-3 text-base leading-7 text-white/68">
              The next wins deepen the agency workflow instead of widening the story.
            </p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {roadmapPriorities.map((item) => {
              const Icon = ICON_MAP[item.icon as keyof typeof ICON_MAP];

              return (
                <article key={item.title} className="rounded-xl border border-white/10 bg-black/32 p-5">
                  {Icon ? <Icon className="h-6 w-6 text-cyan-100" /> : null}
                  <h3 className="mt-4 text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/64">{item.detail}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </RearvyPublicShell>
  );
}
