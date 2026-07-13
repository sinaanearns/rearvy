"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import {
  ArrowRight,
  Download,
  FileText,
  Mail,
  MonitorDown,
  MousePointer2,
  Zap,
} from "lucide-react";

import { isElectron } from "@/lib/utils/env";
import {
  resolveMacDownloadUrl,
  resolveWindowsDownloadUrl,
} from "@/lib/utils/download-url";

const windowsDownloadUrl = resolveWindowsDownloadUrl();
const macDownloadUrl = resolveMacDownloadUrl();
const videoSceneDuration = 3200;

const navLinks = [
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

const heroStats = [
  { value: "Web app", label: "Direct website install" },
  { value: "Extension", label: "Browser relay package" },
  { value: "Win + Mac", label: "Desktop installers" },
];

const cinematicScenes = [
  {
    id: "install",
    label: "01 Install",
    title: "Rearvy opens as a native desktop workspace.",
    body: "The desktop app launches a focused business assistant workspace without shipping private backend keys.",
    command: "Install Rearvy, open the desktop window, and restore the secure workspace.",
    workflowIndex: 0,
    primaryOutput: "Desktop window ready",
    secondaryOutput: "Hosted keys protected",
    approvalTitle: "Native workspace ready",
    approvalBody: "The app is installed and connected to the hosted Rearvy service.",
    color: "#7de7c7",
  },
  {
    id: "connect",
    label: "02 Connect",
    title: "Business sources become one working context.",
    body: "Rearvy combines Shopify, analytics, Gmail, and web signals before the assistant starts planning.",
    command: "Sync store performance, analytics movement, Gmail context, and business history.",
    workflowIndex: 0,
    primaryOutput: "Signals synced",
    secondaryOutput: "Client context found",
    approvalTitle: "Context assembled",
    approvalBody: "Rearvy can see what changed and why it matters.",
    color: "#69d7ff",
  },
  {
    id: "ask",
    label: "03 Ask",
    title: "A short prompt turns into a working plan.",
    body: "Ask for the outcome and Rearvy routes the work across analysis, writing, browser research, and desktop actions.",
    command: "Prep the business review, explain the revenue change, and draft the follow-up.",
    workflowIndex: 1,
    primaryOutput: "Review brief generated",
    secondaryOutput: "Next actions queued",
    approvalTitle: "Plan in motion",
    approvalBody: "The assistant has converted the request into real work steps.",
    color: "#f7c948",
  },
  {
    id: "research",
    label: "04 Research",
    title: "Live browser work stays inside the product flow.",
    body: "Rearvy can inspect current web pages, compare evidence, and bring the findings back to the task.",
    command: "Research competitor pages, compare retention offers, and summarize the gaps.",
    workflowIndex: 1,
    primaryOutput: "3 web gaps found",
    secondaryOutput: "Recommendation drafted",
    approvalTitle: "Research captured",
    approvalBody: "Live findings are ready to use in the business output.",
    color: "#ff9f7a",
  },
  {
    id: "approve",
    label: "05 Approve",
    title: "Important actions wait for user review.",
    body: "Emails, files, terminal commands, and desktop workflows stay visible before Rearvy sends or executes.",
    command: "Show the email draft, source summary, and desktop action checklist before sending.",
    workflowIndex: 2,
    primaryOutput: "Email draft ready",
    secondaryOutput: "Approval required",
    approvalTitle: "Approval gate",
    approvalBody: "The user reviews the action before Rearvy sends anything.",
    color: "#7de7c7",
  },
] as const;

type CinematicScene = (typeof cinematicScenes)[number];

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return prefersReducedMotion;
}


function DownloadNav() {
  return (
    <header className="fixed left-0 right-0 top-0 z-40">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-6 px-5 py-5 sm:px-6">
        <Link href="/" aria-label="Rearvy home" className="flex items-center gap-3">
          <Image src="/rearvy-logo.png" alt="Rearvy" width={34} height={34} priority />
          <span className="text-base font-semibold text-white">Rearvy</span>
        </Link>

        <nav className="hidden items-center gap-5 text-sm font-semibold text-white/78 md:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-white">
              {link.label}
            </Link>
          ))}
          <Link href="/login" className="transition hover:text-white">
            Sign in
          </Link>
          <a
            href={windowsDownloadUrl}
            download
            className="inline-flex items-center gap-2 rounded-[8px] bg-white px-4 py-2 font-semibold text-black shadow-sm shadow-black/15 transition hover:bg-cyan-50"
          >
            Download
            <Download className="h-4 w-4" aria-hidden />
          </a>
        </nav>
      </div>
    </header>
  );
}

function AppPreviewWindow({ scene }: { scene: CinematicScene }) {
  return (
    <div
      className="rearvy-download-window"
      data-scene={scene.id}
      aria-label="Animated Rearvy desktop app preview"
    >
      <div className="rearvy-download-titlebar">
        <div className="flex items-center gap-2">
          <span className="bg-[#ff6f61]" />
          <span className="bg-[#f7c948]" />
          <span className="bg-[#38d39f]" />
        </div>
        <strong>{scene.label}</strong>
        <div className="hidden items-center gap-2 text-white/50 sm:flex">
          <MonitorDown className="h-3.5 w-3.5" aria-hidden />
          desktop installer
        </div>
      </div>

      <div className="rearvy-download-window-body">
        <section className="rearvy-download-screen">
          <div className="rearvy-download-screen-shade" />
          <div className="rearvy-download-shot-header">
            <span>{scene.label}</span>
            <p>{scene.title}</p>
          </div>
          <div className="rearvy-download-focus-ring" />
          <div className="rearvy-download-cursor">
            <MousePointer2 className="h-5 w-5" aria-hidden />
          </div>
          <div
            key={`${scene.id}-primary-output`}
            className="rearvy-download-floating-output rearvy-download-floating-output-one"
          >
            <FileText className="h-4 w-4 text-[#7de7c7]" aria-hidden />
            <span>{scene.primaryOutput}</span>
          </div>
          <div
            key={`${scene.id}-secondary-output`}
            className="rearvy-download-floating-output rearvy-download-floating-output-two"
          >
            <Mail className="h-4 w-4 text-[#f7c948]" aria-hidden />
            <span>{scene.secondaryOutput}</span>
          </div>
        </section>
      </div>
    </div>
  );
}

function DownloadTheater() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const activeScene = cinematicScenes[activeSceneIndex] ?? cinematicScenes[0];

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    const interval = window.setInterval(() => {
      setActiveSceneIndex((currentIndex) => (currentIndex + 1) % cinematicScenes.length);
    }, videoSceneDuration);

    return () => window.clearInterval(interval);
  }, [prefersReducedMotion]);

  return (
    <div
      className="rearvy-download-theater"
      data-scene={activeScene.id}
      style={{ "--scene-color": activeScene.color } as CSSProperties}
    >
      <div className="rearvy-download-beam rearvy-download-beam-one" />
      <div className="rearvy-download-beam rearvy-download-beam-two" />
      <AppPreviewWindow scene={activeScene} />


    </div>
  );
}

export default function DownloadPage() {
  const router = useRouter();

  useEffect(() => {
    if (isElectron()) {
      router.replace("/login");
    }
  }, [router]);

  return (
    <main className="rearvy-download-page min-h-screen overflow-hidden text-white selection:bg-[#7de7c7] selection:text-black">
      <DownloadNav />

      <section className="relative z-10 mx-auto grid min-h-[92svh] w-full max-w-[1500px] items-center gap-10 overflow-hidden px-5 pb-12 pt-28 sm:px-6 lg:grid-cols-[minmax(0,0.78fr)_minmax(520px,1.05fr)]">
        <div className="min-w-0 w-full max-w-[calc(100vw-40px)] sm:max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-[8px] border border-white/14 bg-white/8 px-3 py-1.5 text-sm font-medium text-white/76 backdrop-blur-xl">
            <Zap className="h-3.5 w-3.5 text-[#f7c948]" aria-hidden />
            Website install, browser relay, and desktop release
          </div>

          <h1 className="mt-6 max-w-full break-words font-poster text-[40px] leading-[0.96] text-white sm:text-6xl lg:text-7xl">
            Install Rearvy from the website.
          </h1>

          <p className="mt-6 max-w-full break-words text-base font-medium leading-7 text-white/72 sm:max-w-2xl sm:text-lg">
            Install the Rearvy web app directly from the site, download the browser relay extension
            package, or use the native desktop app for local files, browser research, Gmail review,
            desktop actions, and AI workflows.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a
              href={windowsDownloadUrl}
              download
              className="inline-flex min-h-12 w-full max-w-full items-center justify-center gap-2 rounded-[8px] bg-white px-6 py-3 text-center font-semibold text-black shadow-sm shadow-black/20 transition hover:bg-cyan-50 sm:w-auto"
            >
              Download for Windows
              <Download className="h-4 w-4" aria-hidden />
            </a>
            <a
              href={macDownloadUrl}
              download
              className="inline-flex min-h-12 w-full max-w-full items-center justify-center gap-2 rounded-[8px] border border-white/28 bg-white/[0.04] px-6 py-3 text-center font-semibold text-white transition hover:border-white/55 hover:bg-white/10 sm:w-auto"
            >
              Download for Mac
              <Download className="h-4 w-4" aria-hidden />
            </a>
            <Link
              href="/signup"
              className="inline-flex min-h-12 w-full max-w-full items-center justify-center gap-2 rounded-[8px] border border-white/28 bg-black/20 px-6 py-3 text-center font-semibold text-white transition hover:border-white/55 hover:bg-white/10 sm:w-auto"
            >
              Open web workspace
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-2 sm:hidden">
            {heroStats.map((stat) => (
              <div
                key={stat.value}
                className="min-w-0 rounded-[8px] border border-white/12 bg-white/[0.07] px-3 py-3 backdrop-blur-xl"
              >
                <p className="text-sm font-semibold text-white">{stat.value}</p>
                <p className="mt-1 text-[11px] leading-4 text-white/68">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-7 hidden w-full max-w-full gap-3 sm:grid sm:max-w-2xl sm:grid-cols-3">
            {heroStats.map((stat) => (
              <div key={stat.value} className="rounded-[8px] border border-white/12 bg-white/7 p-4 backdrop-blur-xl">
                <p className="text-xl font-semibold text-white">{stat.value}</p>
                <p className="mt-1 text-sm leading-5 text-white/68">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <DownloadTheater />
      </section>

    </main>
  );
}
