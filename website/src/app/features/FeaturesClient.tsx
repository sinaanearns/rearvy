"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
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
  FolderKanban,
  Plug,
  FileText,
  ShieldCheck,
  LineChart,
  Download,
};

function FeaturesHeroPanel() {
  return (
    <div className="relative mx-auto w-full max-w-[640px] overflow-hidden rounded-[8px] border border-white/12 bg-black/55 p-4 shadow-sm shadow-black/25 backdrop-blur-xl">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-200/0 via-cyan-200/70 to-emerald-200/0" />
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-cyan-100/74">
            <LineChart className="h-3.5 w-3.5" />
            Business review run
          </div>
          <p className="mt-2 text-xl font-semibold leading-tight text-white">
            Find the work that needs attention first
          </p>
        </div>
        <span className="rounded-[8px] border border-cyan-200/18 bg-cyan-200/10 px-3 py-1 text-xs font-semibold text-cyan-100">
          09:12
        </span>
      </div>

      <div className="grid gap-3 py-4">
        {[
          {
            title: "Luma Naturals",
            signal: "Traffic down 18 percent, revenue flat",
            status: "Review",
            icon: Bell,
          },
          {
            title: "Northstar Gear",
            signal: "Email reply needed before Friday check-in",
            status: "Draft",
            icon: MessageSquare,
          },
          {
            title: "BrightSkin Co",
            signal: "New Shopify cohort ready for brief",
            status: "Ship",
            icon: FolderKanban,
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.title} className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.06] p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-white/12 bg-white/8 text-cyan-100">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-1 truncate text-xs text-white/52">{item.signal}</p>
              </div>
              <span className="rounded-[8px] border border-white/12 px-2.5 py-1 text-xs font-medium text-white/60">
                {item.status}
              </span>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-3">
        {[
          ["9", "Sources"],
          ["4", "Risks"],
          ["3", "Next moves"],
        ].map(([value, label]) => (
          <div key={label} className="rounded-[8px] border border-white/10 bg-black/24 p-3">
            <p className="text-2xl font-semibold leading-none text-white">{value}</p>
            <p className="mt-2 text-xs font-medium text-white/48">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

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
          Business assistant
        </>
      }
      title={
        <>
          Business assistant
          <span className="block">workflows.</span>
        </>
      }
      description="Rearvy helps teams connect business data, explain what changed, draft the next move, and keep execution reviewable."
      primaryCta={{ href: "/signup", label: "Start for free" }}
      secondaryCta={{ href: "/download", label: "Download" }}
      sidePanel={<FeaturesHeroPanel />}
      stats={[
        { value: "9", label: "Implemented sources" },
        { value: "1", label: "Assistant workspace" },
        { value: "3", label: "Focus areas" },
      ]}
    >
      <section className="mx-auto w-full max-w-[1180px] px-6">
        <div className="grid gap-5 md:grid-cols-2">
          {currentCapabilities.map((feature) => {
            const Icon = ICON_MAP[feature.icon as keyof typeof ICON_MAP];

            return (
              <article
                key={feature.title}
                className="rounded-[8px] border border-white/12 bg-black/45 p-6 shadow-sm shadow-black/20 backdrop-blur-xl transition hover:border-white/22 hover:bg-white/10"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] border border-white/12 bg-white/10 text-cyan-100">
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
        <div className="rounded-[8px] border border-white/12 bg-white/7 p-6 shadow-sm shadow-black/15 backdrop-blur-xl sm:p-8">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Near-term roadmap
            </h2>
            <p className="mt-3 text-base leading-7 text-white/68">
              The next wins deepen the business assistant workflow instead of widening the story.
            </p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {roadmapPriorities.map((item) => {
              const Icon = ICON_MAP[item.icon as keyof typeof ICON_MAP];

              return (
                <article key={item.title} className="rounded-[8px] border border-white/10 bg-black/32 p-5">
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
