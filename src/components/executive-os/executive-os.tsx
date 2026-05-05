import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  BriefcaseBusiness,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Gauge,
  LayoutDashboard,
  Mic,
  PackageOpen,
  ShieldCheck,
  Sparkles,
  Sunrise,
  TimerReset,
  Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type ExecutiveIcon = ComponentType<{ className?: string }>;

export type ExecutiveOsModuleKey =
  | "automation"
  | "assets"
  | "meetings"
  | "investor"
  | "briefing";

export type AutomationStatus =
  | "queued"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "canceled";

export type RiskLevel = "low" | "medium" | "high";

export interface ExecutiveOsModuleMeta {
  key: ExecutiveOsModuleKey;
  href: string;
  eyebrow: string;
  title: string;
  summary: string;
  outcome: string;
  status: string;
  accent: string;
  icon: ExecutiveIcon;
  metrics: Array<{ label: string; value: string }>;
  nextSteps: string[];
  ctaLabel: string;
}

export interface ExecutiveOsPhase {
  label: string;
  title: string;
  timeline: string;
  deliverables: string[];
  acceptance: string;
  accent: string;
}

export interface TimelineItem {
  title: string;
  description: string;
  status: AutomationStatus;
  detail?: string;
}

const statusStyles: Record<AutomationStatus, string> = {
  queued: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  running: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  awaiting_approval:
    "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  completed:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  failed: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  canceled:
    "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

export const EXECUTIVE_OS_MODULES: ExecutiveOsModuleMeta[] = [
  {
    key: "automation",
    href: "/dashboard/automation",
    eyebrow: "Module 01",
    title: "Automation",
    summary:
      "Browser and Python execution with policy gates, audit logs, and replayable steps.",
    outcome:
      "Autonomous work stays fast enough to be useful and controlled enough to be trusted.",
    status: "Phase 1 foundation",
    accent: "from-cyan-500 via-sky-500 to-indigo-500",
    icon: Workflow,
    metrics: [
      { label: "Runtime cap", value: "120s sandbox" },
      { label: "Guardrail", value: "Approval-first" },
      { label: "Surface", value: "Browser + Python" },
    ],
    nextSteps: [
      "Launch approved runs from the queue.",
      "Inspect evidence and step timelines.",
      "Promote repeated flows into recipes.",
    ],
    ctaLabel: "Open automation",
  },
  {
    key: "assets",
    href: "/dashboard/assets",
    eyebrow: "Module 02",
    title: "Assets",
    summary:
      "Generate campaign creatives, board-deck pages, and approved artifact previews.",
    outcome:
      "Every asset ships with lineage, preview state, and publish approval history.",
    status: "Phase 2 delivery",
    accent: "from-fuchsia-500 via-pink-500 to-amber-400",
    icon: Sparkles,
    metrics: [
      { label: "Primary use", value: "Campaign variants" },
      { label: "Storage", value: "Cloud Storage" },
      { label: "Target approval", value: ">= 40% pilot" },
    ],
    nextSteps: [
      "Preview generated variants before publish.",
      "Track approval and publish timestamps.",
      "Connect the artifact lineage to source inputs.",
    ],
    ctaLabel: "Open assets",
  },
  {
    key: "meetings",
    href: "/dashboard/meetings",
    eyebrow: "Module 03",
    title: "Meetings",
    summary:
      "Convert transcripts into commitments, then push follow-up updates into the operating system.",
    outcome:
      "Meeting notes become structured actions instead of another lost doc.",
    status: "Phase 2 delivery",
    accent: "from-emerald-500 via-teal-500 to-cyan-500",
    icon: Mic,
    metrics: [
      { label: "Input", value: "Transcript + roster" },
      { label: "Output", value: "Commitments" },
      { label: "Confidence target", value: ">= 0.8" },
    ],
    nextSteps: [
      "Review extracted commitments before applying updates.",
      "Capture confidence thresholds by meeting type.",
      "Sync commitments back into business pulse summaries.",
    ],
    ctaLabel: "Open meetings",
  },
  {
    key: "investor",
    href: "/dashboard/investor",
    eyebrow: "Module 04",
    title: "Investor OS",
    summary:
      "Manage updates, board packets, and fundraising pipeline context in one workspace.",
    outcome:
      "Founders get a lightweight command center without replacing legal or cap table systems.",
    status: "Phase 3 delivery",
    accent: "from-slate-700 via-slate-900 to-indigo-700",
    icon: BriefcaseBusiness,
    metrics: [
      { label: "Primary object", value: "Investor workspace" },
      { label: "Deliverable", value: "Board packets" },
      { label: "Boundary", value: "Compliance aware" },
    ],
    nextSteps: [
      "Generate investor updates from live metrics.",
      "Assemble board packets from approved sources.",
      "Track pipeline stage changes with notes.",
    ],
    ctaLabel: "Open investor OS",
  },
  {
    key: "briefing",
    href: "/dashboard/briefing",
    eyebrow: "Module 05",
    title: "Morning Brief",
    summary:
      "Deliver an 8 AM local-time brief that summarizes overnight actions, risks, and KPI deltas.",
    outcome:
      "Decision-making starts with a concise operating review instead of a blank inbox.",
    status: "Phase 1 live",
    accent: "from-amber-500 via-orange-500 to-rose-500",
    icon: Sunrise,
    metrics: [
      { label: "Delivery target", value: "8:05 AM local" },
      { label: "Mode", value: "In-app first" },
      { label: "Recovery", value: "Retry + history" },
    ],
    nextSteps: [
      "Review what was resolved overnight.",
      "Escalate unresolved risks before the workday starts.",
      "Test alternate delivery channels after in-app rollout.",
    ],
    ctaLabel: "Open briefing",
  },
];

export const EXECUTIVE_OS_PHASES: ExecutiveOsPhase[] = [
  {
    label: "Phase 1",
    title: "Execution Foundation",
    timeline: "Weeks 1-4",
    deliverables: [
      "Unified automation run model and UI timeline",
      "Browser run engine v1 for high-value workflows",
      "Python sandbox v1 with strict policy controls",
      "Morning brief v1 delivered inside the app",
    ],
    acceptance:
      "80 percent success on predefined browser workflows and 95 percent sandbox runs finishing inside limits.",
    accent: "from-cyan-500 to-sky-500",
  },
  {
    label: "Phase 2",
    title: "Operational Intelligence",
    timeline: "Weeks 5-8",
    deliverables: [
      "Meeting transcription ingestion and commitment extraction",
      "Recipe recorder beta from guided demonstrations",
      "Asset generation v1 for social and ad variants",
    ],
    acceptance:
      "Commitment extraction precision should reach at least 0.8 on validation data and asset approval should clear pilot thresholds.",
    accent: "from-emerald-500 to-teal-500",
  },
  {
    label: "Phase 3",
    title: "Executive OS",
    timeline: "Weeks 9-12",
    deliverables: [
      "Investor workspace v1 with update and board packet generation",
      "Morning brief v2 with low-risk autonomous actions",
      "Approval workflows and policy editor coverage across all modules",
    ],
    acceptance:
      "Pilot accounts should report measurable executive time savings with recurring low-risk actions resolved overnight.",
    accent: "from-slate-700 to-indigo-700",
  },
];

const EXECUTIVE_OS_STATS = [
  { label: "Modules", value: "5" },
  { label: "Phases", value: "3" },
  { label: "Sandbox limit", value: "120s" },
  { label: "Brief SLA", value: "8:05 AM" },
];

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium text-white/90 shadow-sm backdrop-blur">
      {children}
    </span>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
        {eyebrow}
      </p>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold tracking-tight">{value}</p>
    </div>
  );
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  const styles: Record<RiskLevel, string> = {
    low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    medium: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    high: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  };

  return <Badge variant="outline" className={styles[level]}>{level}</Badge>;
}

export function AutomationRunTimeline({ items }: { items: TimelineItem[] }) {
  return (
    <Card className="border-border/70 bg-card/80 shadow-sm">
      <CardHeader className="space-y-1 border-b border-border/70 pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-sky-500" />
          Execution timeline
        </CardTitle>
        <CardDescription>
          A compact view of the queued, running, and approval-sensitive steps.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {items.map((item, index) => (
          <div key={`${item.title}-${index}`} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className={cn("mt-1 h-3 w-3 rounded-full border", statusStyles[item.status])} />
              {index < items.length - 1 && <span className="mt-2 h-full w-px bg-border" />}
            </div>
            <div className="flex-1 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">{item.title}</h3>
                <Badge variant="outline" className={statusStyles[item.status]}>
                  {item.status.replaceAll("_", " ")}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              {item.detail && <p className="mt-2 text-xs text-muted-foreground">{item.detail}</p>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ApprovalPanel({
  title,
  riskLevel,
  state,
  policy,
  bullets,
}: {
  title: string;
  riskLevel: RiskLevel;
  state: string;
  policy: string;
  bullets: string[];
}) {
  return (
    <Card className="border-border/70 bg-card/80 shadow-sm">
      <CardHeader className="space-y-2 border-b border-border/70 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <RiskBadge level={riskLevel} />
        </div>
        <CardDescription>{state}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6 text-sm text-muted-foreground">
        <p>{policy}</p>
        <ul className="space-y-2">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function ArtifactPreviewCard({
  title,
  subtitle,
  lineage,
  status,
  details,
  href,
}: {
  title: string;
  subtitle: string;
  lineage: string;
  status: string;
  details: string[];
  href?: string;
}) {
  const content = (
    <Card className="group overflow-hidden border-border/70 bg-card/80 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <CardHeader className="space-y-2 border-b border-border/70 pb-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="outline" className="border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300">
            {status}
          </Badge>
        </div>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6 text-sm">
        <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <PackageOpen className="h-3.5 w-3.5" />
            Lineage
          </div>
          <p className="mt-2 text-sm text-foreground">{lineage}</p>
        </div>
        <ul className="space-y-2 text-muted-foreground">
          {details.map((detail) => (
            <li key={detail} className="flex items-start gap-2">
              <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
              <span>{detail}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}

export function MorningBriefCard({
  dateLabel,
  timezone,
  summary,
  actionsTaken,
  unresolvedRisks,
  kpiDeltas,
  deliveryChannels,
  status,
}: {
  dateLabel: string;
  timezone: string;
  summary: string;
  actionsTaken: string[];
  unresolvedRisks: string[];
  kpiDeltas: Array<{ label: string; value: string }>;
  deliveryChannels: string[];
  status: string;
}) {
  return (
    <Card className="border-border/70 bg-card/80 shadow-sm">
      <CardHeader className="space-y-2 border-b border-border/70 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{dateLabel}</CardTitle>
          <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300">
            {status}
          </Badge>
        </div>
        <CardDescription>
          {timezone} - delivered after overnight triage and before the first work block.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-background to-muted/40 p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <Sunrise className="h-3.5 w-3.5" />
            Summary
          </div>
          <p className="mt-3 text-sm text-foreground">{summary}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Actions taken</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {actionsTaken.map((action) => (
                <li key={action} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Unresolved risks</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {unresolvedRisks.map((risk) => (
                <li key={risk} className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {kpiDeltas.map((item) => (
            <div key={item.label} className="rounded-2xl border border-border/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{item.label}</p>
              <p className="mt-2 text-lg font-semibold tracking-tight">{item.value}</p>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Delivery channels</p>
          <p className="mt-2">{deliveryChannels.join(" · ")}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ExecutiveModulePage({
  pageModule,
  children,
}: {
  pageModule: ExecutiveOsModuleMeta;
  children?: ReactNode;
}) {
  const Icon = pageModule.icon;

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-10">
      <section className="relative overflow-hidden rounded-3xl border border-slate-800/90 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-8 text-white shadow-xl shadow-slate-950/10 md:px-8 md:py-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.18),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(168,85,247,0.16),_transparent_26%)]" />
        <div className="relative space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.28em] text-white/70">
            <LayoutDashboard className="h-3.5 w-3.5" />
            Executive OS
            <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] tracking-[0.2em] text-white/80">
              {pageModule.status}
            </span>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr] lg:items-end">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/85 backdrop-blur">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                  <Icon className="h-4 w-4" />
                </span>
                <span>{pageModule.eyebrow}</span>
              </div>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">
                  {pageModule.title}
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-white/75 md:text-base">
                  {pageModule.summary}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Pill>{pageModule.outcome}</Pill>
                <Pill>Guardrails first</Pill>
                <Pill>Tenant scoped</Pill>
                <Pill>Audit ready</Pill>
              </div>
              <div className="flex flex-wrap gap-3 pt-1">
                <Button asChild className="bg-white text-slate-950 hover:bg-slate-100">
                  <Link href={pageModule.href}>
                    {pageModule.ctaLabel}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                  <Link href="/dashboard/briefing">Open morning brief</Link>
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {EXECUTIVE_OS_STATS.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">{stat.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          eyebrow="Module detail"
          title={`${pageModule.title} operating view`}
          description={pageModule.outcome}
        />
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-border/70 bg-card/80 shadow-sm">
            <CardHeader className="space-y-2 border-b border-border/70 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">Key controls</CardTitle>
                <Badge variant="outline" className="border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300">
                  Active
                </Badge>
              </div>
              <CardDescription>
                The module runs inside the existing approval, audit, and workspace guardrails.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 pt-6 sm:grid-cols-3">
              {pageModule.metrics.map((metric) => (
                <MetricCard key={metric.label} {...metric} />
              ))}
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/80 shadow-sm">
            <CardHeader className="space-y-2 border-b border-border/70 pb-4">
              <CardTitle className="text-base">What happens next</CardTitle>
              <CardDescription>
                These are the next operational actions once the module is enabled.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-6 text-sm text-muted-foreground">
              {pageModule.nextSteps.map((step, index) => (
                <div key={step} className="flex items-start gap-3 rounded-2xl border border-border/70 p-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                    {index + 1}
                  </div>
                  <p>{step}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      {children && <div className="space-y-8">{children}</div>}

      <section className="space-y-4">
        <SectionHeading
          eyebrow="Phase map"
          title="Delivery plan"
          description="The first 90 days are staged to build execution depth before autonomous action expands."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          {EXECUTIVE_OS_PHASES.map((phase) => (
            <Card key={phase.label} className="overflow-hidden border-border/70 bg-card/80 shadow-sm">
              <div className={cn("h-1 bg-gradient-to-r", phase.accent)} />
              <CardHeader className="space-y-2 border-b border-border/70 pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-border/70 bg-background/60">{phase.label}</Badge>
                  <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{phase.timeline}</span>
                </div>
                <CardTitle className="text-base">{phase.title}</CardTitle>
                <CardDescription>{phase.acceptance}</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {phase.deliverables.map((deliverable) => (
                    <li key={deliverable} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{deliverable}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator className="bg-border/70" />
    </div>
  );
}

export function ExecutiveOsLanding() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-10">
      <section className="relative overflow-hidden rounded-3xl border border-slate-800/90 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-8 text-white shadow-xl shadow-slate-950/10 md:px-8 md:py-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.2),_transparent_26%),radial-gradient(circle_at_bottom_left,_rgba(168,85,247,0.16),_transparent_24%)]" />
        <div className="relative space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.28em] text-white/70">
            <LayoutDashboard className="h-3.5 w-3.5" />
            Executive OS
            <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] tracking-[0.2em] text-white/80">
              Control plane
            </span>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.95fr] lg:items-end">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/85 backdrop-blur">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                  <Bot className="h-4 w-4" />
                </span>
                <span>Autonomous execution with guardrails, approvals, and evidence</span>
              </div>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">
                  Run the company from one operating layer.
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-white/75 md:text-base">
                  Rearvy now has a dedicated Executive OS surface for automation, asset generation,
                  meeting intelligence, investor work, and the morning brief. It is built to be
                  auditable first and autonomous where safe.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Pill>Approval-first</Pill>
                <Pill>Client scoped</Pill>
                <Pill>Traceable actions</Pill>
                <Pill>Delivery phased</Pill>
              </div>
              <div className="flex flex-wrap gap-3 pt-1">
                <Button asChild className="bg-white text-slate-950 hover:bg-slate-100">
                  <Link href="/dashboard/automation">
                    Open automation
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                  <Link href="/dashboard/briefing">View morning brief</Link>
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {EXECUTIVE_OS_STATS.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">{stat.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          eyebrow="Modules"
          title="Build out the operating layer in working slices"
          description="Each module maps to one of the initiatives in the implementation spec and can be opened directly from the dashboard."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {EXECUTIVE_OS_MODULES.map((module) => {
            const Icon = module.icon;

            return (
              <Card key={module.key} className="group overflow-hidden border-border/70 bg-card/85 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                <div className={cn("h-1 bg-gradient-to-r", module.accent)} />
                <CardHeader className="space-y-3 border-b border-border/70 pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-sm", `bg-gradient-to-br ${module.accent}`)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{module.eyebrow}</p>
                        <CardTitle className="text-lg">{module.title}</CardTitle>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-border/70 bg-background/70">{module.status}</Badge>
                  </div>
                  <CardDescription>{module.summary}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <p className="text-sm text-foreground/85">{module.outcome}</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {module.metrics.map((metric) => (
                      <div key={metric.label} className="rounded-2xl border border-border/70 bg-muted/30 p-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{metric.label}</p>
                        <p className="mt-1 text-sm font-semibold tracking-tight">{metric.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {module.nextSteps.slice(0, 2).map((step) => (
                      <span key={step} className="rounded-full border border-border/70 bg-background/70 px-3 py-1.5">
                        {step}
                      </span>
                    ))}
                  </div>
                  <Button asChild variant="outline" className="w-full justify-between">
                    <Link href={module.href}>
                      {module.ctaLabel}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          eyebrow="Delivery plan"
          title="Three phases, one control plane"
          description="The implementation spec is organized into sequenced phases so the highest-value control surfaces ship first."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          {EXECUTIVE_OS_PHASES.map((phase) => (
            <Card key={phase.label} className="overflow-hidden border-border/70 bg-card/80 shadow-sm">
              <div className={cn("h-1 bg-gradient-to-r", phase.accent)} />
              <CardHeader className="space-y-2 border-b border-border/70 pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-border/70 bg-background/60">{phase.label}</Badge>
                  <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{phase.timeline}</span>
                </div>
                <CardTitle className="text-base">{phase.title}</CardTitle>
                <CardDescription>{phase.acceptance}</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {phase.deliverables.map((deliverable) => (
                    <li key={deliverable} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{deliverable}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

export function getExecutiveOsModule(key: ExecutiveOsModuleKey): ExecutiveOsModuleMeta {
  const foundModule = EXECUTIVE_OS_MODULES.find((entry) => entry.key === key);

  if (!foundModule) {
    return EXECUTIVE_OS_MODULES[0];
  }

  return foundModule;
}
