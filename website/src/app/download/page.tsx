"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import {
  Activity,
  Check,
  ChevronRight,
  Download,
  FileText,
  Mail,
  Sparkles,
} from "lucide-react";

import { isElectron } from "@/lib/utils/env";
import {
  resolveMacDownloadUrl,
  resolveWindowsDownloadUrl,
} from "@/lib/utils/download-url";

const windowsDownloadUrl = resolveWindowsDownloadUrl();
const macDownloadUrl = resolveMacDownloadUrl();
const videoSceneDuration = 5600;

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
  const workflowSteps = [
    { title: "Gather context", detail: "Connected sources and recent activity" },
    { title: "Build the output", detail: scene.primaryOutput },
    { title: "Review and approve", detail: scene.secondaryOutput },
  ];

  return (
    <div
      className="rearvy-download-window"
      data-scene={scene.id}
      aria-label={`Rearvy desktop preview: ${scene.label}`}
    >
      <div className="rearvy-download-titlebar">
        <div className="flex items-center gap-2">
          <span className="bg-[#ff6f61]" />
          <span className="bg-[#f7c948]" />
          <span className="bg-[#38d39f]" />
        </div>
        <strong>Rearvy Workspace</strong>
        <div className="hidden items-center gap-2 text-white/50 sm:flex">
          <span className="rearvy-download-live-indicator" />
          Live workspace
        </div>
      </div>

      <div className="rearvy-download-window-body">
        <section className="rearvy-download-product">
          <aside className="rearvy-download-product-sidebar" aria-label="Workspace navigation">
            <div className="rearvy-download-product-logo">
              <Sparkles className="h-4 w-4" aria-hidden />
            </div>
            <div className="rearvy-download-product-nav" aria-hidden>
              <span className="is-active" />
              <span />
              <span />
              <span />
            </div>
            <div className="rearvy-download-product-health">
              <Activity className="h-3.5 w-3.5" aria-hidden />
              <span>Online</span>
            </div>
          </aside>

          <div className="rearvy-download-product-main">
            <header className="rearvy-download-product-header">
              <div>
                <span>{scene.label}</span>
                <h2>{scene.title}</h2>
              </div>
              <div className="rearvy-download-product-status">
                <span />
                Working
              </div>
            </header>

            <div className="rearvy-download-product-prompt">
              <div className="rearvy-download-product-avatar">You</div>
              <div>
                <span>Request</span>
                <p>{scene.command}</p>
              </div>
            </div>

            <div className="rearvy-download-product-grid">
              <article className="rearvy-download-product-brief">
                <div className="rearvy-download-product-card-header">
                  <div>
                    <FileText className="h-4 w-4" aria-hidden />
                    <span>Business review</span>
                  </div>
                  <span>Generated</span>
                </div>
                <p>{scene.body}</p>
                <div className="rearvy-download-product-metrics">
                  <div>
                    <span>Context</span>
                    <strong>Ready</strong>
                  </div>
                  <div>
                    <span>Sources</span>
                    <strong>4 synced</strong>
                  </div>
                  <div>
                    <span>Output</span>
                    <strong>Drafted</strong>
                  </div>
                </div>
              </article>

              <article className="rearvy-download-product-plan">
                <div className="rearvy-download-product-card-header">
                  <div>
                    <Sparkles className="h-4 w-4" aria-hidden />
                    <span>Working plan</span>
                  </div>
                </div>
                <div className="rearvy-download-product-steps">
                  {workflowSteps.map((step, index) => {
                    const isComplete = index < scene.workflowIndex;
                    const isActive = index === scene.workflowIndex;

                    return (
                      <div
                        key={step.title}
                        className={isActive ? "is-active" : undefined}
                      >
                        <span className="rearvy-download-product-step-icon">
                          {isComplete ? <Check className="h-3 w-3" aria-hidden /> : index + 1}
                        </span>
                        <div>
                          <strong>{step.title}</strong>
                          <span>{step.detail}</span>
                        </div>
                        {isActive ? <ChevronRight className="h-3.5 w-3.5" aria-hidden /> : null}
                      </div>
                    );
                  })}
                </div>
              </article>
            </div>

            <footer className="rearvy-download-product-footer">
              <div>
                <FileText className="h-3.5 w-3.5" aria-hidden />
                {scene.primaryOutput}
              </div>
              <div>
                <Mail className="h-3.5 w-3.5" aria-hidden />
                {scene.secondaryOutput}
              </div>
            </footer>
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
  }, [activeSceneIndex, prefersReducedMotion]);

  return (
    <div
      className="rearvy-download-theater"
      data-scene={activeScene.id}
      style={{ "--scene-color": activeScene.color } as CSSProperties}
    >
      <div className="rearvy-download-beam rearvy-download-beam-one" />
      <div className="rearvy-download-beam rearvy-download-beam-two" />
      <AppPreviewWindow key={activeScene.id} scene={activeScene} />

      <div className="rearvy-download-scene-nav">
        <div className="rearvy-download-scene-dots" role="group" aria-label="Preview scenes">
          {cinematicScenes.map((scene, index) => (
            <button
              key={scene.id}
              type="button"
              aria-label={`View ${scene.label} preview`}
              aria-pressed={index === activeSceneIndex}
              onClick={() => setActiveSceneIndex(index)}
            />
          ))}
        </div>
      </div>
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
          </div>

        </div>

        <DownloadTheater />
      </section>

    </main>
  );
}
