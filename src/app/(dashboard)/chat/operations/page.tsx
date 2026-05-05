import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  Bot,
  Mic,
  MessageSquare,
  Sparkles,
  Sunrise,
  Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const metadata = {
  title: "Operations hub - Rearvy",
  description:
    "Launch automation, assets, meetings, investor work, and the morning brief from chat.",
};

const requestMenu = [
  {
    eyebrow: "Automation",
    title: "Browser and Python work",
    summary: "Run structured execution with approvals, evidence, and replayable steps.",
    detail:
      "Use this for browser tasks, scripted workflows, and anything that should produce a run log.",
    prompt: "Ask Rearvy to automate the task, explain the guardrails, and show the run timeline.",
    icon: Workflow,
  },
  {
    eyebrow: "Assets",
    title: "Campaign and board-ready output",
    summary: "Generate creative previews with lineage and approval history.",
    detail:
      "Use this when you need asset variants, deck pages, or publishable previews tied back to source inputs.",
    prompt: "Ask Rearvy to draft assets, preview the variants, and keep the lineage attached.",
    icon: Sparkles,
  },
  {
    eyebrow: "Meetings",
    title: "Transcript to commitment flow",
    summary: "Turn meeting notes into owners, follow-ups, and confidence scores.",
    detail:
      "Use this when the conversation should become a structured action list instead of another doc.",
    prompt: "Ask Rearvy to extract commitments, owners, and unresolved risks from the meeting.",
    icon: Mic,
  },
  {
    eyebrow: "Investor",
    title: "Update and board packet drafting",
    summary: "Keep fundraising context and board materials in one workspace.",
    detail:
      "Use this for investor updates, board packets, and lightweight founder-facing operating notes.",
    prompt: "Ask Rearvy to summarize the investor update and assemble a board packet draft.",
    icon: BriefcaseBusiness,
  },
  {
    eyebrow: "Morning brief",
    title: "Overnight review at a glance",
    summary: "Capture what changed overnight before the day starts.",
    detail:
      "Use this for a concise morning digest with actions taken, unresolved risks, and KPI deltas.",
    prompt: "Ask Rearvy to produce the morning brief and highlight anything that needs attention.",
    icon: Sunrise,
  },
];

const howItWorks = [
  "Start in chat and describe the job you want handled.",
  "Rearvy replies with the plan, the relevant context, and the working surface.",
  "Use this page to review the available capability and jump back into chat whenever you need to continue.",
];

export default function OperationsHubPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-10">
      <section className="relative overflow-hidden rounded-3xl border border-slate-800/90 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-8 text-white shadow-xl shadow-slate-950/10 md:px-8 md:py-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.2),_transparent_26%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.16),_transparent_24%)]" />
        <div className="relative space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.28em] text-white/70">
            <MessageSquare className="h-3.5 w-3.5" />
            Chat-requested feature
            <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] tracking-[0.2em] text-white/80">
              On demand
            </span>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.95fr] lg:items-end">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/85 backdrop-blur">
                <Bot className="h-4 w-4" />
                <span>Launch structured work from chat, not from the main dashboard</span>
              </div>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">
                  Operations hub
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-white/75 md:text-base">
                  When you ask Rearvy in chat to handle a serious task, this page becomes the
                  working surface. It keeps automation, asset generation, meeting intelligence,
                  investor work, and the morning brief behind a single chat entry point.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-white/15 bg-white/10 text-white/80">
                  Chat-only access
                </Badge>
                <Badge variant="outline" className="border-white/15 bg-white/10 text-white/80">
                  Approval-first
                </Badge>
                <Badge variant="outline" className="border-white/15 bg-white/10 text-white/80">
                  Audit-ready
                </Badge>
              </div>
              <div className="flex flex-wrap gap-3 pt-1">
                <Button asChild className="bg-white text-slate-950 hover:bg-slate-100">
                  <Link href="/chat/new">
                    Open chat
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                >
                  <Link href="/chat/new">Start a new request</Link>
                </Button>
              </div>
            </div>
            <Card className="border-white/15 bg-white/10 text-white shadow-none backdrop-blur">
              <CardHeader className="border-b border-white/10 pb-4">
                <CardTitle className="text-base text-white">How it works</CardTitle>
                <CardDescription className="text-white/70">
                  Use chat to request the work, then return here to inspect the available surface.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-6 text-sm text-white/80">
                {howItWorks.map((step, index) => (
                  <div key={step} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-white/10 text-xs font-semibold">
                      {index + 1}
                    </div>
                    <p>{step}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Request menu
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">Pick a job, then ask for it in chat</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Each capability stays behind the chat entry point so the request, context, and reply stay together.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {requestMenu.map((item) => {
            const Icon = item.icon;

            return (
              <Card key={item.title} className="group overflow-hidden border-border/70 bg-card/85 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                <div className="h-1 bg-gradient-to-r from-sky-500 via-cyan-500 to-emerald-500" />
                <CardHeader className="space-y-3 border-b border-border/70 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-950">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                        {item.eyebrow}
                      </p>
                      <CardTitle className="text-lg">{item.title}</CardTitle>
                    </div>
                  </div>
                  <CardDescription>{item.summary}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <p className="text-sm text-foreground/85">{item.detail}</p>
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-3 text-sm text-muted-foreground">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Ask in chat
                    </p>
                    <p className="mt-1">{item.prompt}</p>
                  </div>
                  <Button asChild variant="outline" className="w-full justify-between">
                    <Link href="/chat/new">
                      Open chat
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader className="border-b border-border/70 pb-4">
            <CardTitle className="text-base">Chat-first workflow</CardTitle>
            <CardDescription>
              Keep the request and the response attached to the same conversation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-6 text-sm text-muted-foreground">
            <p>1. Open chat and describe the task you want handled.</p>
            <p>2. Review the plan, guardrails, and next step before anything runs.</p>
            <p>3. Return here whenever you want the capability summary again.</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader className="border-b border-border/70 pb-4">
            <CardTitle className="text-base">Suggested requests</CardTitle>
            <CardDescription>
              Examples of the kinds of prompts that fit this page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-6 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border/70 p-4">
              "Automate the browser task and show me the run log."
            </div>
            <div className="rounded-2xl border border-border/70 p-4">
              "Draft the board packet and keep the source metrics attached."
            </div>
            <div className="rounded-2xl border border-border/70 p-4">
              "Turn the meeting transcript into commitments and owners."
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator className="bg-border/70" />
    </div>
  );
}