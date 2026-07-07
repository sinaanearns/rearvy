"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  CheckCircle2,
  Download,
  FileText,
  Globe2,
  Laptop,
  LockKeyhole,
  Mail,
  MonitorDown,
  MousePointer2,
  PlugZap,
  Send,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Terminal,
  Workflow,
  Zap,
} from "lucide-react";

import { isElectron } from "@/lib/utils/env";
import { resolveMacDownloadUrl, resolveWindowsDownloadUrl } from "@/lib/utils/download-url";
import { getConfiguredAppOrigin } from "@/lib/utils/url";

const windowsDownloadUrl = resolveWindowsDownloadUrl();
const macDownloadUrl = resolveMacDownloadUrl();
const installScriptUrl = new URL(
  "/install?win32=true",
  getConfiguredAppOrigin()
).toString();
const terminalInstallCommand = `irm '${installScriptUrl}' | iex`;
const videoSceneDuration = 3200;

const navLinks = [
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

const heroStats = [
  { value: "Win + Mac", label: "Desktop installers" },
  { value: "Native", label: "Desktop workspace" },
  { value: "Secure", label: "Hosted backend keys" },
];

const installerNotes = [
  "Windows 10 and Windows 11 x64 installer.",
  "macOS universal DMG for Apple Silicon and Intel Macs.",
  "Staged for standard desktop app releases.",
  "Private backend credentials stay on the hosted service.",
];

const sourceSignals = [
  {
    label: "Shopify",
    value: "Revenue, orders, customers",
    icon: ShoppingBag,
    color: "#7de7c7",
  },
  {
    label: "Analytics",
    value: "Traffic and growth signals",
    icon: BarChart3,
    color: "#69d7ff",
  },
  {
    label: "Gmail",
    value: "Drafts, replies, approvals",
    icon: Mail,
    color: "#f7c948",
  },
  {
    label: "Live web",
    value: "Browser research context",
    icon: Globe2,
    color: "#ff9f7a",
  },
];

const cinematicScenes = [
  {
    id: "install",
    label: "01 Install",
    title: "Rearvy opens as a native desktop workspace.",
    body: "The desktop app launches a focused business assistant workspace without shipping private backend keys.",
    command: "Install Rearvy, open the desktop window, and restore the secure workspace.",
    sourceIndex: 0,
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
    sourceIndex: 1,
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
    sourceIndex: 2,
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
    sourceIndex: 3,
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
    sourceIndex: 2,
    workflowIndex: 2,
    primaryOutput: "Email draft ready",
    secondaryOutput: "Approval required",
    approvalTitle: "Approval gate",
    approvalBody: "The user reviews the action before Rearvy sends anything.",
    color: "#7de7c7",
  },
] as const;

const workflowRows = [
  {
    title: "Understand the work",
    body: "Rearvy reads the sources your business already uses.",
    icon: PlugZap,
  },
  {
    title: "Do the research",
    body: "The assistant turns a short prompt into a runnable plan.",
    icon: Bot,
  },
  {
    title: "Review real actions",
    body: "Email, browser, files, and terminal work stay reviewable.",
    icon: ShieldCheck,
  },
];

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

const timelineSteps = [
  "Install the desktop app",
  "Open the connected workspace",
  "Ask Rearvy to prep the business review",
  "Approve the final email or desktop action",
];

const desktopFeatures = [
  {
    title: "Native launcher",
    body: "Start menu and desktop shortcuts open Rearvy in its own focused window.",
    icon: Laptop,
  },
  {
    title: "Desktop bridge",
    body: "Terminal, files, clipboard, screen capture, and device workflows run through the app bridge.",
    icon: Workflow,
  },
  {
    title: "Server-safe release",
    body: "The installer does not bundle private Firebase service credentials or provider API keys.",
    icon: LockKeyhole,
  },
];

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

function AnimatedSourceStack({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="rearvy-download-source-stack" aria-label="Connected app signals">
      {sourceSignals.map((signal, index) => {
        const Icon = signal.icon;
        const isActive = index === activeIndex;

        return (
          <div
            key={signal.label}
            className={
              isActive
                ? "rearvy-download-source rearvy-download-source-active"
                : "rearvy-download-source"
            }
            style={
              {
                "--source-color": signal.color,
                "--source-delay": `${index * 0.45}s`,
              } as CSSProperties
            }
          >
            <Icon className="h-4 w-4" aria-hidden />
            <div className="min-w-0">
              <p>{signal.label}</p>
              <span>{signal.value}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AssistantWorkflow({ scene }: { scene: CinematicScene }) {
  return (
    <div className="rearvy-download-assistant-panel">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rearvy-download-live-dot" />
          <p className="text-sm font-semibold text-white">Rearvy working plan</p>
        </div>
        <Sparkles className="h-4 w-4 text-[#f7c948]" aria-hidden />
      </div>

      <div className="mt-4 rounded-[8px] border border-white/10 bg-black/34 p-3">
        <p key={scene.command} className="rearvy-download-command">
          {scene.command}
        </p>
      </div>

      <div className="mt-4 grid gap-2">
        {workflowRows.map((row, index) => {
          const Icon = row.icon;
          const isActive = index === scene.workflowIndex;

          return (
            <div
              key={row.title}
              className={
                isActive
                  ? "rearvy-download-workflow-row rearvy-download-workflow-row-active"
                  : "rearvy-download-workflow-row"
              }
              style={{ "--row-delay": `${index * 0.8}s` } as CSSProperties}
            >
              <Icon className="h-4 w-4 text-[#69d7ff]" aria-hidden />
              <div className="min-w-0">
                <p>{row.title}</p>
                <span>{row.body}</span>
              </div>
              <CheckCircle2 className="ml-auto h-4 w-4 text-[#7de7c7]" aria-hidden />
            </div>
          );
        })}
      </div>
    </div>
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
          <div className="rearvy-download-source-strip">
            <AnimatedSourceStack activeIndex={scene.sourceIndex} />
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
          <AssistantWorkflow scene={scene} />
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
            Windows and macOS desktop release
          </div>

          <h1 className="mt-6 max-w-full break-words font-poster text-[44px] leading-[0.94] text-white sm:text-6xl lg:text-7xl">
            Download Rearvy Desktop. Watch the work move.
          </h1>

          <p className="mt-6 max-w-full break-words text-base font-medium leading-7 text-white/72 sm:max-w-2xl sm:text-lg">
            Install the native Rearvy window for connected business work: live data, browser research,
            Gmail review, desktop actions, and AI workflows in one focused app.
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

          <div className="mt-5 grid grid-cols-3 gap-2 sm:hidden">
            {heroStats.map((stat) => (
              <div
                key={stat.value}
                className="min-w-0 rounded-[8px] border border-white/12 bg-white/[0.07] px-3 py-3 backdrop-blur-xl"
              >
                <p className="truncate text-sm font-semibold text-white">{stat.value}</p>
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

      <section className="relative z-10 mx-auto grid w-full max-w-[1500px] gap-8 px-5 pb-16 sm:px-6 lg:grid-cols-[minmax(0,0.86fr)_minmax(360px,0.54fr)]">
        <div className="min-w-0">
          <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-[#7de7c7]">
            <Workflow className="h-4 w-4" aria-hidden />
            From installer to approved output
          </div>
          <div className="rearvy-download-timeline">
            {timelineSteps.map((step, index) => (
              <div key={step} className="rearvy-download-timeline-step">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{step}</p>
                {index < timelineSteps.length - 1 ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {desktopFeatures.map((feature) => {
              const Icon = feature.icon;

              return (
                <article
                  key={feature.title}
                  className="rounded-[8px] border border-white/12 bg-white/7 p-5 backdrop-blur-xl"
                >
                  <Icon className="h-5 w-5 text-[#69d7ff]" aria-hidden />
                  <h2 className="mt-4 text-base font-semibold text-white">{feature.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-white/70">{feature.body}</p>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="relative overflow-hidden rounded-[8px] border border-white/12 bg-black/42 p-5 shadow-sm shadow-black/25 backdrop-blur-xl">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f7c948]/70 to-transparent"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(247,201,72,0.1),transparent_42%),linear-gradient(245deg,rgba(105,215,255,0.1),transparent_38%)]"
          />

          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <MonitorDown className="h-4 w-4 text-[#f7c948]" aria-hidden />
                Install options
              </div>
              <p className="mt-2 text-sm leading-6 text-white/66">
                Choose the installer path that fits your operating system.
              </p>
            </div>
            <span className="rounded-[8px] border border-[#7de7c7]/20 bg-[#7de7c7]/10 px-3 py-1 text-xs font-semibold text-[#7de7c7]">
              Win + Mac
            </span>
          </div>

          <div className="relative mt-5 grid gap-3">
            <a
              href={windowsDownloadUrl}
              download
              className="group rounded-[8px] border border-white/12 bg-white/[0.07] p-4 transition hover:border-[#69d7ff]/42 hover:bg-[#69d7ff]/10"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-[#69d7ff]/24 bg-[#69d7ff]/12 text-[#69d7ff]">
                    <Download className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      Download Windows setup file
                    </p>
                    <p className="mt-1 text-xs leading-5 text-white/62">
                      Standard Windows installer for the desktop app.
                    </p>
                  </div>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-white/42 transition group-hover:translate-x-0.5 group-hover:text-white" />
              </div>
            </a>

            <a
              href={macDownloadUrl}
              download
              className="group rounded-[8px] border border-white/12 bg-white/[0.07] p-4 transition hover:border-[#7de7c7]/42 hover:bg-[#7de7c7]/10"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-[#7de7c7]/24 bg-[#7de7c7]/12 text-[#7de7c7]">
                    <Download className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      Download macOS DMG
                    </p>
                    <p className="mt-1 text-xs leading-5 text-white/62">
                      Universal Mac build for Apple Silicon and Intel Macs.
                    </p>
                  </div>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-white/42 transition group-hover:translate-x-0.5 group-hover:text-white" />
              </div>
            </a>

            <div className="rounded-[8px] border border-white/12 bg-white/[0.06] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Terminal className="h-4 w-4 text-[#f7c948]" aria-hidden />
                Windows PowerShell install
              </div>
              <code className="mt-3 block overflow-x-auto rounded-[8px] border border-white/10 bg-black/35 p-3 font-mono text-xs leading-6 text-white/82">
                {terminalInstallCommand}
              </code>
            </div>
          </div>

          <div className="relative mt-5 grid gap-2 text-sm leading-6 text-white/72">
            {installerNotes.map((item) => (
              <p
                key={item}
                className="flex gap-2 rounded-[8px] border border-white/10 bg-white/[0.045] px-3 py-2"
              >
                <Check className="mt-1 h-4 w-4 shrink-0 text-[#7de7c7]" aria-hidden />
                <span>{item}</span>
              </p>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
