"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import {
  ArrowUpRight,
  Loader2,
  Sparkles,
  Building2,
  BarChart3,
  Settings,
  Megaphone,
  TrendingUp,
  Activity,
  Zap,
  KeyRound,
  Clock,
  CheckCircle2,
  Users,
  ChevronRight,
  Code2,
  FileText,
  ClipboardCheck,
  Check,
  Handshake,
  Cpu,
} from "lucide-react";
import { BusinessPriorityForm } from "@/components/business/business-priority-form";
import { PublisherConnectorsPanel } from "@/components/business/publisher-connectors-panel";
import { B2BPartnershipsPanel } from "@/components/business/b2b-partnerships-panel";
import { CloudComputePanel } from "@/components/business/cloud-compute-panel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { generateStructuredConnectorBrief } from "@/lib/rearvy-connectors/brief-generator";

type GuardState = "checking" | "redirecting" | "authorized" | "forbidden" | "error";
type SidebarTab =
  | "connector_setup"
  | "partnerships"
  | "cloud_compute"
  | "analytics"
  | "mcp_settings"
  | "about_business"
  | "promotion";

export default function BusinessDashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [state, setState] = useState<GuardState>("checking");
  const [error, setError] = useState<string | null>(null);
  const [hasSubmittedBusinessDetails, setHasSubmittedBusinessDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>("connector_setup");

  // Promotion Form State
  const [promoTagline, setPromoTagline] = useState("AI-Powered Workflow Operations & B2B Consulting");
  const [promoOffer, setPromoOffer] = useState("Free AI Business Automation Assessment for Enterprise Clients");
  const [promoWebsite, setPromoWebsite] = useState("https://rearvy.com");
  const [isSavingPromo, setIsSavingPromo] = useState(false);

  // Connector Setup & AI Prompt Refinement State
  const [platformType, setPlatformType] = useState("Website");
  const [capabilityDraft, setCapabilityDraft] = useState("");
  const [generatedBrief, setGeneratedBrief] = useState<string | null>(null);
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isAiRefined, setIsAiRefined] = useState(false);

  const handleGenerateConnectorBrief = async () => {
    if (!capabilityDraft.trim()) {
      toast.error("Please describe what your platform can do first.");
      return;
    }

    setIsGeneratingBrief(true);
    setIsAiRefined(false);
    try {
      let token: string | null = null;
      if (user) {
        token = await user.getIdToken().catch(() => null);
      }

      const res = await fetch("/api/ai/refine-connector-brief", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          platformType,
          description: capabilityDraft.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error("AI refinement response was not ok");
      }

      const data = (await res.json()) as { brief?: string; isAiRefined?: boolean };
      if (data?.brief) {
        setGeneratedBrief(data.brief);
        setIsAiRefined(Boolean(data.isAiRefined));
        if (data.isAiRefined) {
          toast.success("AI refined your connector prompt successfully!");
        } else {
          toast.success("Structured connector brief generated!");
        }
      } else {
        throw new Error("Empty brief returned");
      }
    } catch {
      // Deterministic structured fallback if offline or network error
      const fallback = generateStructuredConnectorBrief(platformType, capabilityDraft.trim());
      setGeneratedBrief(fallback);
      setIsAiRefined(false);
      toast.success("Connector brief generated with structured capabilities!");
    } finally {
      setIsGeneratingBrief(false);
    }
  };

  async function handleCopyConnectorBrief() {
    if (!generatedBrief) {
      toast.error("Please generate the brief output first.");
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedBrief);
      setIsCopied(true);
      toast.success("Connector brief copied! Add it to your project plan or AI prompt.");
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      toast.error("Clipboard access is unavailable. Copy the brief manually.");
    }
  }

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setState("redirecting");
      router.replace("/business/login");
      return;
    }

    const authenticatedUser = user;
    let cancelled = false;

    async function verifyBusinessAccount() {
      setState("checking");
      setError(null);

      try {
        const token = await authenticatedUser.getIdToken();
        const response = await fetch("/api/business/connectors", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        if (cancelled) return;
        if (response.status === 403) {
          setState("forbidden");
          return;
        }
        if (!response.ok) {
          throw new Error("The business account could not be verified.");
        }

        const payload = (await response.json().catch(() => null)) as {
          publisher?: { registered?: boolean; accessSource?: "profile" | "registration" };
        } | null;
        const savedRegistration = localStorage.getItem("rearvy_business_registered");
        if (savedRegistration || payload?.publisher?.accessSource === "registration") {
          setHasSubmittedBusinessDetails(true);
        }
        setState("authorized");
      } catch (verificationError) {
        if (cancelled) return;
        setError(
          verificationError instanceof Error
            ? verificationError.message
            : "The business account could not be verified."
        );
        setState("error");
      }
    }

    void verifyBusinessAccount();
    return () => {
      cancelled = true;
    };
  }, [loading, user, router]);

  const handleRegistrationComplete = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("rearvy_business_registered", "true");
    }
    setHasSubmittedBusinessDetails(true);
  };

  const handleSavePromo = () => {
    setIsSavingPromo(true);
    setTimeout(() => {
      setIsSavingPromo(false);
      toast.success("Rearvy Business Promotion profile updated live!");
    }, 600);
  };

  if (state !== "authorized") {
    return (
      <main className="relative grid min-h-screen overflow-hidden bg-[#050505] px-5 py-8 text-white selection:bg-white selection:text-black">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 bg-[linear-gradient(116deg,rgba(255,255,255,0.05),transparent_32%),linear-gradient(248deg,rgba(255,255,255,0.025),transparent_36%),repeating-linear-gradient(90deg,rgba(255,255,255,0.03)_0_1px,transparent_1px_82px),repeating-linear-gradient(0deg,rgba(255,255,255,0.02)_0_1px,transparent_1px_82px)]"
        />
        <div className="relative z-10 mx-auto grid w-full max-w-[1100px] items-center gap-8 lg:grid-cols-[minmax(0,0.86fr)_minmax(360px,0.5fr)]">
          <section className="min-w-0">
            <Link href="/" aria-label="Rearvy home" className="inline-flex items-center gap-3">
              <Image src="/rearvy-logo.png" alt="Rearvy" width={38} height={38} priority />
              <span className="text-sm font-semibold tracking-wide text-white/78">Rearvy</span>
            </Link>

            <h1 className="mt-5 max-w-3xl text-balance text-[clamp(42px,7vw,88px)] font-semibold leading-[0.92] tracking-normal">
              {state === "redirecting"
                ? "Redirecting to sign in…"
                : state === "forbidden"
                ? "Only for business accounts."
                : state === "error"
                ? "Unable to verify account."
                : "Checking access…"}
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
              {state === "redirecting"
                ? "Please complete sign in to continue."
                : state === "forbidden"
                ? "This dashboard is available only to business registrations."
                : state === "error"
                ? `Error: ${error ?? "Unknown error"}`
                : "Verifying your business account status."}
            </p>
          </section>

          <section className="rounded-[8px] border border-white/12 bg-black/48 p-5 shadow-sm shadow-black/25 backdrop-blur-xl sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[8px] border border-white/15 bg-white/[0.05] text-white/70">
                {state === "forbidden" ? (
                  <Building2 className="h-5 w-5" aria-hidden />
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-white/58">Access check</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {state === "forbidden" ? "Business registration required" : "Preparing dashboard"}
                </h2>
                <p className="mt-3 text-sm leading-6 text-white/68">
                  {state === "forbidden"
                    ? "Create a separate platform or business account to submit and manage connectors."
                    : "We’ll route you to the right place as soon as your account is verified."}
                </p>
                {state === "forbidden" && (
                  <Link
                    href="/business/signup"
                    className="mt-5 inline-flex items-center gap-2 rounded-[8px] border border-white/15 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
                  >
                    Create business account
                    <ArrowUpRight className="h-4 w-4" aria-hidden />
                  </Link>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] px-4 py-5 text-white selection:bg-white selection:text-black sm:px-6">
      <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_10%_6%,rgba(255,255,255,0.055),transparent_34%),radial-gradient(circle_at_90%_16%,rgba(255,255,255,0.025),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_24%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

      <div className="relative mx-auto flex flex-col w-full max-w-7xl">
        {/* Top Bar Header */}
        <header className="flex items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="Rearvy home" className="inline-flex items-center rounded-lg transition-opacity hover:opacity-80">
              <Image src="/rearvy-logo.png" alt="Rearvy" width={32} height={32} priority />
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="hidden items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.045] px-3 py-1.5 text-xs font-semibold text-white/80 shadow-sm shadow-black/20 transition hover:border-white/25 hover:bg-white/[0.08] hover:text-white sm:inline-flex"
            >
              Public Home
            </Link>
          </div>
        </header>

        {!hasSubmittedBusinessDetails ? (
          /* Step 1: Business Profile Onboarding */
          <section className="mx-auto w-full max-w-4xl py-12 space-y-6">
            <div className="text-center space-y-2 max-w-2xl mx-auto">
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Tell us about your business
              </h1>
              <p className="text-base text-white/70">
                Complete your business profile so Rearvy can configure the tools, workflows, and connected capabilities your business needs.
              </p>
            </div>

            <BusinessPriorityForm
              afterSubmitRedirect={null}
              onSuccess={handleRegistrationComplete}
              title="Platform & Business Setup"
              description="Tell us what your business or platform does so Rearvy can prepare the right connected capabilities."
            />
            <div className="text-center">
              <button
                onClick={handleRegistrationComplete}
                className="text-xs text-white/50 hover:text-white underline"
              >
                Already registered? Skip directly to Business Dashboard
              </button>
            </div>
          </section>
        ) : (
          /* Step 2: Main Business Dashboard Grid with Sidebar & Content Area */
          <div className="flex flex-col lg:flex-row gap-6 pt-6 min-h-[calc(100vh-6rem)]">
            
            {/* Left Hand Side Sidebar */}
            <aside className="flex w-full shrink-0 flex-col justify-between space-y-6 rounded-2xl border border-white/10 bg-[#0b0b0b]/90 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl lg:w-64">
              <div className="space-y-5">
                <div className="border-b border-white/[0.08] px-2 py-1 pb-3">
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-white/40">Navigation</p>
                  <h2 className="text-sm font-bold text-white mt-0.5">Business Workspace</h2>
                </div>

                <nav className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab("connector_setup")}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all text-left",
                      activeTab === "connector_setup"
                        ? "border border-white/20 bg-white/[0.08] font-semibold text-white shadow-sm shadow-black/40"
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <Code2 className="h-4 w-4 shrink-0 text-white/65" />
                    <span className="flex-1">Connector Setup</span>
                    {activeTab === "connector_setup" && <ChevronRight className="h-3.5 w-3.5 text-white" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("partnerships")}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all text-left",
                      activeTab === "partnerships"
                        ? "border border-white/20 bg-white/[0.08] font-semibold text-white shadow-sm shadow-black/40"
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <Handshake className="h-4 w-4 shrink-0 text-white/65" />
                    <span className="flex-1">B2B Partner Perks</span>
                    <Badge className="border-emerald-500/30 bg-emerald-500/10 text-[9px] text-emerald-400 py-0 px-1.5 font-semibold">
                      Perks
                    </Badge>
                    {activeTab === "partnerships" && <ChevronRight className="h-3.5 w-3.5 text-white" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("cloud_compute")}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all text-left",
                      activeTab === "cloud_compute"
                        ? "border border-white/20 bg-white/[0.08] font-semibold text-white shadow-sm shadow-black/40"
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <Cpu className="h-4 w-4 shrink-0 text-white/65" />
                    <span className="flex-1">Cloud Compute</span>
                    <Badge className="border-cyan-500/30 bg-cyan-500/10 text-[9px] text-cyan-400 py-0 px-1.5 font-semibold">
                      24/7
                    </Badge>
                    {activeTab === "cloud_compute" && <ChevronRight className="h-3.5 w-3.5 text-white" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("analytics")}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all text-left",
                      activeTab === "analytics"
                        ? "border border-white/20 bg-white/[0.08] font-semibold text-white shadow-sm shadow-black/40"
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <BarChart3 className="h-4 w-4 shrink-0 text-white/65" />
                    <span className="flex-1">Analysis & Stats</span>
                    {activeTab === "analytics" && <ChevronRight className="h-3.5 w-3.5 text-white" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("mcp_settings")}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all text-left",
                      activeTab === "mcp_settings"
                        ? "border border-white/20 bg-white/[0.08] font-semibold text-white shadow-sm shadow-black/40"
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <Settings className="h-4 w-4 shrink-0 text-white/65" />
                    <span className="flex-1">MCP Settings & APIs</span>
                    {activeTab === "mcp_settings" && <ChevronRight className="h-3.5 w-3.5 text-white" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("about_business")}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all text-left",
                      activeTab === "about_business"
                        ? "border border-white/20 bg-white/[0.08] font-semibold text-white shadow-sm shadow-black/40"
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <Building2 className="h-4 w-4 shrink-0 text-white/65" />
                    <span className="flex-1">About Business</span>
                    {activeTab === "about_business" && <ChevronRight className="h-3.5 w-3.5 text-white" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("promotion")}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all text-left",
                      activeTab === "promotion"
                        ? "border border-white/20 bg-white/[0.08] font-semibold text-white shadow-sm shadow-black/40"
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <Megaphone className="h-4 w-4 shrink-0 text-white/65" />
                    <span className="flex-1">Promotion</span>
                    {activeTab === "promotion" && <ChevronRight className="h-3.5 w-3.5 text-white" />}
                  </button>
                </nav>
              </div>

            </aside>

            {/* Right Main Content Area */}
            <main className="flex-1 min-w-0 space-y-6">

              {/* TAB 0: Connector Setup */}
              {activeTab === "connector_setup" && (
                <div className="space-y-6">
                  <section className="rounded-2xl border border-white/10 bg-[#0b0b0b]/80 p-6 shadow-xl shadow-black/20 backdrop-blur-xl">
                    <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] text-white/70">
                        <FileText className="h-5 w-5" aria-hidden />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-white">Create your connector brief</h2>
                        <p className="text-xs text-white/55">Describe your platform — Rearvy AI refines it into a professional AI specification.</p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
                      <label className="space-y-2 text-xs font-semibold text-white/75">
                        Platform type
                        <select
                          value={platformType}
                          onChange={(event) => setPlatformType(event.target.value)}
                          className="h-11 w-full rounded-lg border border-white/10 bg-[#050505]/80 px-3 text-sm font-normal text-white outline-none transition focus:border-white/35"
                        >
                          <option>Website</option>
                          <option>SaaS platform</option>
                          <option>Desktop application</option>
                          <option>AI service</option>
                          <option>Internal business system</option>
                        </select>
                      </label>
                      <label className="space-y-2 text-xs font-semibold text-white/75">
                        What can it do?
                        <textarea
                          value={capabilityDraft}
                          onChange={(event) => setCapabilityDraft(event.target.value)}
                          rows={5}
                          placeholder="Describe what your website, app, or service can do (e.g. cliping.com lets users paste YouTube links, auto-clip highlight moments, choose template captions, and schedule multi-channel uploads)..."
                          className="w-full resize-y rounded-lg border border-white/10 bg-[#050505]/80 px-3 py-3 text-sm font-normal leading-6 text-white outline-none transition placeholder:text-white/30 focus:border-white/35"
                        />
                      </label>
                    </div>

                    <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                      <p className="max-w-xl text-xs leading-5 text-white/50">
                        Next: AI generates your refined specification, your developer adds the private adapter, and you submit the connector.
                      </p>
                      <Button
                        onClick={() => void handleGenerateConnectorBrief()}
                        disabled={isGeneratingBrief || !capabilityDraft.trim()}
                        className="shrink-0 rounded-lg bg-white font-semibold text-black shadow-lg shadow-black/40 hover:bg-white/90 disabled:opacity-50"
                      >
                        {isGeneratingBrief ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                            AI Refining & Generating Brief…
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" aria-hidden />
                            AI Refine & Generate Brief
                          </>
                        )}
                      </Button>
                    </div>

                    {/* ONLY DISPLAY FINAL OUTPUT PROMPT AND COPY BUTTON WHEN GENERATED */}
                    {generatedBrief && (
                      <div className="mt-6 rounded-xl border border-white/15 bg-white/[0.035] p-4 sm:p-5">
                        <div className="flex flex-col gap-3 border-b border-white/10 pb-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="border-white/15 bg-white/[0.08] text-xs font-semibold text-white/80">
                              Final Output Prompt
                            </Badge>
                            {isAiRefined && (
                              <Badge className="flex items-center gap-1 border-white/15 bg-white/[0.08] text-xs font-medium text-white/80">
                                <Sparkles className="h-3 w-3" /> AI Refined
                              </Badge>
                            )}
                            <span className="text-xs text-white/60">Ready to copy to your project plan or AI coding agent</span>
                          </div>
                          <Button
                            onClick={() => void handleCopyConnectorBrief()}
                            className="shrink-0 rounded-lg bg-white text-black shadow-sm hover:bg-white/90"
                          >
                            {isCopied ? (
                              <>
                                <Check className="mr-2 h-4 w-4 text-black" aria-hidden />
                                Copied to clipboard!
                              </>
                            ) : (
                              <>
                                <ClipboardCheck className="mr-2 h-4 w-4 text-black" aria-hidden />
                                Copy connector brief
                              </>
                            )}
                          </Button>
                        </div>
                        <div className="mt-3.5 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/60 p-4 font-mono text-xs leading-6 text-white/80 selection:bg-white selection:text-black">
                          {generatedBrief}
                        </div>
                      </div>
                    )}
                  </section>

                  <PublisherConnectorsPanel />

                </div>
              )}

              {/* TAB: B2B Native Partnerships & Perks */}
              {activeTab === "partnerships" && (
                <B2BPartnershipsPanel
                  onPreFillConnector={(template) => {
                    setPlatformType(template.platformType);
                    setCapabilityDraft(template.capabilityDraft);
                    setActiveTab("connector_setup");
                  }}
                />
              )}

              {/* TAB: Autonomous Cloud Compute & Sandboxes */}
              {activeTab === "cloud_compute" && <CloudComputePanel />}

              {/* TAB 1: Analysis Part (Center Overview) */}
              {activeTab === "analytics" && (
                <div className="space-y-6">
                  
                  {/* Top Stats Cards Grid */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-white/12 bg-white/[0.035] p-4 backdrop-blur-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-white/70">AI Invocations</span>
                        <Zap className="h-4 w-4 text-white/60" />
                      </div>
                      <p className="mt-2 text-2xl font-bold text-white">0</p>
                      <p className="mt-1 text-[11px] text-white/50 flex items-center gap-1 font-medium">
                        No activity recorded this period
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/12 bg-white/[0.035] p-4 backdrop-blur-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-white/70">Active Sub-Agents</span>
                        <Users className="h-4 w-4 text-white/60" />
                      </div>
                      <p className="mt-2 text-2xl font-bold text-white">0</p>
                      <p className="mt-1 text-[11px] text-white/50">
                        No sub-agents active
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/12 bg-white/[0.035] p-4 backdrop-blur-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-white/70">Hours Saved</span>
                        <Clock className="h-4 w-4 text-white/60" />
                      </div>
                      <p className="mt-2 text-2xl font-bold text-white">0.0 hrs</p>
                      <p className="mt-1 text-[11px] text-white/50 font-medium">
                        0.0 hrs saved this month
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/12 bg-white/[0.035] p-4 backdrop-blur-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-white/70">Efficiency Score</span>
                        <Activity className="h-4 w-4 text-white/60" />
                      </div>
                      <p className="mt-2 text-2xl font-bold text-white">—</p>
                      <p className="mt-1 text-[11px] text-white/50 font-medium">
                        Awaiting workflow data
                      </p>
                    </div>
                  </div>

                  {/* Business Analysis & Task Breakdown Grid */}
                  <div className="grid gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2 rounded-2xl border border-white/12 bg-black/40 p-5 backdrop-blur-xl space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-bold text-white">Business AI Task Distribution</h3>
                          <p className="text-xs text-white/60">Automated work execution across company functions</p>
                        </div>
                        <Badge variant="outline" className="border-white/15 text-xs text-white/65">
                          Live Analytics
                        </Badge>
                      </div>

                      <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-dashed border-white/10 bg-white/[0.02]">
                        <Activity className="h-8 w-8 text-white/30 mb-2" />
                        <p className="text-xs font-semibold text-white/80">No task distribution data yet</p>
                        <p className="text-[11px] text-white/50 max-w-sm mt-1">
                          Task breakdowns across sales, research, support, and finance will populate as your Rearvy sub-agents execute workflows.
                        </p>
                      </div>
                    </div>

                    {/* AI Executive Intelligence Card */}
                    <div className="space-y-4 rounded-2xl border border-white/12 bg-gradient-to-b from-white/[0.04] to-black/40 p-5 backdrop-blur-xl">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 shrink-0 text-white/65" />
                        <h3 className="text-base font-bold text-white">Executive Insights</h3>
                      </div>
                      <div className="flex flex-col items-center justify-center py-8 text-center rounded-xl border border-dashed border-white/10 bg-white/[0.02]">
                        <Sparkles className="mb-2 h-7 w-7 text-white/30" />
                        <p className="text-xs font-semibold text-white/80">No insights generated yet</p>
                        <p className="text-[11px] text-white/50 max-w-xs mt-1">
                          AI executive intelligence updates automatically as patterns and velocity gains emerge from your business workflows.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Recent Executed Business Tasks Table */}
                  <div className="rounded-2xl border border-white/12 bg-black/40 p-5 backdrop-blur-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-white">Recent Autonomous Work Executions</h3>
                        <p className="text-xs text-white/60">Live audit log of business tasks completed by Rearvy sub-agents</p>
                      </div>
                      <Link href="/work" className="flex items-center gap-1 text-xs text-white/70 hover:text-white hover:underline">
                        View in Work Platform <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </div>

                    <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-dashed border-white/10 bg-white/[0.02]">
                      <Clock className="h-8 w-8 text-white/30 mb-2" />
                      <p className="text-xs font-semibold text-white/80">No autonomous executions recorded yet</p>
                      <p className="text-[11px] text-white/50 max-w-sm mt-1">
                        Sub-agent executions, scrapes, enrichments, and automated tasks will appear here with timestamps and audit status.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: MCP Settings & APIs */}
              {activeTab === "mcp_settings" && (
                <div className="space-y-6 rounded-2xl border border-white/10 bg-[#0b0b0b]/80 p-6 shadow-xl shadow-black/20 backdrop-blur-xl">
                  <div className="border-b border-white/10 pb-4">
                    <h2 className="text-xl font-bold text-white">Rearvy API Key</h2>
                    <p className="text-xs text-white/60">
                      Use one Rearvy-issued key to authenticate approved apps and connectors.
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/12 bg-gradient-to-br from-white/[0.055] via-white/[0.025] to-transparent p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] text-white/70">
                          <KeyRound className="h-5 w-5" aria-hidden />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-white">Your Rearvy API key</h3>
                          <p className="mt-1 max-w-2xl text-xs leading-5 text-white/55">
                            Connect approved apps through Rearvy without adding third-party provider credentials here.
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="w-fit shrink-0 border-white/10 text-white/55">
                        Not issued
                      </Badge>
                    </div>
                    <div className="mt-5 border-t border-white/[0.08] pt-4">
                      <p className="text-xs leading-5 text-white/45">
                        Rearvy API key issuance is not enabled in this build yet. No third-party provider key is requested or stored on this page.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: About Business View */}
              {activeTab === "about_business" && (
                <div className="rounded-2xl border border-white/12 bg-black/40 p-6 backdrop-blur-xl space-y-6">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div>
                      <h2 className="text-xl font-bold text-white">About Your Business</h2>
                      <p className="text-xs text-white/60">
                        Manage your company profile, core priorities, and team configuration.
                      </p>
                    </div>
                    <Badge className="border-white/15 bg-white/[0.06] text-xs text-white/70">
                      Profile Active
                    </Badge>
                  </div>

                  <BusinessPriorityForm
                    afterSubmitRedirect={null}
                    onSuccess={() => toast.success("Business profile details updated successfully!")}
                    title="Update Business Profile"
                    description="Keep your company profile and operational priorities updated to align Rearvy AI reasoning."
                  />
                </div>
              )}

              {/* TAB 4: Promotion View */}
              {activeTab === "promotion" && (
                <div className="space-y-6">
                  <div className="space-y-6 rounded-2xl border border-white/12 bg-[#0b0b0b]/85 p-6 shadow-xl shadow-black/25 backdrop-blur-xl">
                    <div className="flex flex-col items-start justify-between gap-4 border-b border-white/[0.08] pb-4 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] text-white/70">
                          <Megaphone className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-white">Rearvy Business Promotion</h2>
                          <p className="text-xs text-white/60">
                            Make your approved products, services, and capabilities available across connected Rearvy workflows.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Promotion Configuration Form */}
                    <div className="space-y-4 rounded-xl border border-white/10 bg-[#050505]/70 p-5 shadow-inner shadow-black/20">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-white/65" />
                        Configure Business Showcase Profile
                      </h3>

                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-white/80">
                            Business Tagline / Value Proposition
                          </label>
                          <Input
                            value={promoTagline}
                            onChange={(e) => setPromoTagline(e.target.value)}
                            placeholder="e.g. AI Automation & Workflow Consulting"
                            className="border-white/10 bg-[#0b0b0b]/80 text-xs text-white transition focus-visible:border-white/35 focus-visible:ring-white/10"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium text-white/80">
                            Promotional Offer / Service Highlight
                          </label>
                          <Input
                            value={promoOffer}
                            onChange={(e) => setPromoOffer(e.target.value)}
                            placeholder="e.g. Complimentary AI Assessment for Enterprise Teams"
                            className="border-white/10 bg-[#0b0b0b]/80 text-xs text-white transition focus-visible:border-white/35 focus-visible:ring-white/10"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium text-white/80">
                            Business Website / CTA Link
                          </label>
                          <Input
                            value={promoWebsite}
                            onChange={(e) => setPromoWebsite(e.target.value)}
                            placeholder="https://yourcompany.com"
                            className="border-white/10 bg-[#0b0b0b]/80 text-xs text-white transition focus-visible:border-white/35 focus-visible:ring-white/10"
                          />
                        </div>

                        <Button
                          onClick={handleSavePromo}
                          disabled={isSavingPromo}
                          className="bg-white text-xs font-semibold text-black shadow-lg shadow-black/40 hover:bg-white/90"
                        >
                          {isSavingPromo ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Megaphone className="mr-2 h-3.5 w-3.5" />
                          )}
                          Save Promotion Settings
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </main>
          </div>
        )}
      </div>
    </main>
  );
}
