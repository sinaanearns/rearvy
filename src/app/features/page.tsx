import type { Metadata } from "next";
import Link from "next/link";
import {
  Bell,
  FileText,
  FolderKanban,
  LineChart,
  MessageSquare,
  Plug,
  ShieldCheck,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Features | Rearvy",
  description:
    "See how Rearvy helps growth agencies connect client data, generate weekly briefs, and surface the next action.",
};

const CURRENT_CAPABILITIES = [
  {
    title: "Connected data chat",
    description:
      "Ask questions across connected client data instead of pulling updates from multiple tools manually.",
    icon: MessageSquare,
    points: [
      "Natural-language questions over connected store, social, traffic, inbox, and spreadsheet data.",
      "Project-scoped chat history so context stays attached to the right client or initiative.",
      "Source-aware answers designed to explain what changed, not just dump metrics.",
    ],
  },
  {
    title: "Insights and alerts",
    description:
      "Rearvy already generates insight cards and alert-like workflows that can evolve into true weekly review prep.",
    icon: Bell,
    points: [
      "Trend and anomaly style insight generation for supported data sources.",
      "Signals that help an account manager notice what needs an explanation first.",
      "A strong base for recurring digests, risk flags, and weekly client briefs.",
    ],
  },
  {
    title: "Client workspaces via projects",
    description:
      "Projects are the current path toward client workspaces and should become the default container for agency work.",
    icon: FolderKanban,
    points: [
      "Organize related chats, context, and collaboration by client, campaign, or goal.",
      "Keeps follow-up questions from turning into disconnected one-off chats.",
      "Provides the cleanest migration path to a future client-workspace model.",
    ],
  },
  {
    title: "Agency-ready data connections",
    description:
      "The real first-class integrations in the repo are narrower than the old marketing story, but still useful for agency workflows.",
    icon: Plug,
    points: [
      "Implemented surfaces include Shopify, Google Analytics, Instagram, Facebook, YouTube, Gmail, Excel, Razorpay, and GitHub.",
      "The product should market only implemented integrations clearly and honestly.",
      "The next step is deeper quality on core agency sources, not broader promise inflation.",
    ],
  },
];

const ROADMAP_PRIORITIES = [
  {
    title: "Weekly client brief",
    detail:
      "Auto-generate a Monday-ready summary with wins, risks, causes, and next steps.",
    icon: FileText,
  },
  {
    title: "Anomaly-to-playbook flow",
    detail:
      "Turn a detected issue into a suggested action list your team can assign or include in client notes.",
    icon: ShieldCheck,
  },
  {
    title: "Multi-client command center",
    detail:
      "Give agencies one place to see which accounts need attention before the week gets away from them.",
    icon: LineChart,
  },
];

export default function FeaturesPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-5xl space-y-16">
        <header className="space-y-4 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-slate-600">
            Product Focus
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
            Rearvy for agency review workflows
          </h1>
          <p className="mx-auto max-w-3xl text-lg text-muted-foreground">
            Rearvy is strongest when it helps a growth agency connect client data, explain the latest changes,
            and prepare a clear next move before the client meeting starts.
          </p>
        </header>

        <section className="space-y-12">
          {CURRENT_CAPABILITIES.map((feature) => (
            <div
              key={feature.title}
              className="group relative rounded-3xl border border-border/50 bg-card/50 p-8 transition-all hover:bg-card hover:shadow-xl hover:shadow-slate-500/5"
            >
              <div className="flex flex-col gap-6 md:flex-row md:items-start">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 shadow-lg shadow-slate-900/20">
                  <feature.icon className="h-7 w-7 text-white" />
                </div>
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold tracking-tight">{feature.title}</h2>
                  <p className="text-lg text-muted-foreground">{feature.description}</p>
                  <ul className="grid gap-3">
                    {feature.points.map((point) => (
                      <li key={point} className="flex items-start gap-3 text-sm text-foreground/80">
                        <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-slate-700 dark:bg-slate-300" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-8 rounded-3xl border border-slate-700/20 bg-slate-500/5 p-8 sm:p-12">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Near-term roadmap</h2>
            <p className="text-muted-foreground">
              The next wins should deepen the agency workflow, not widen the story.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {ROADMAP_PRIORITIES.map((item) => (
              <div key={item.title} className="rounded-2xl border bg-background/80 p-6">
                <item.icon className="h-6 w-6 text-slate-700 dark:text-slate-300" />
                <h3 className="mt-4 text-xl font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-col items-center justify-center space-y-6 pt-10">
          <Link href="/signup">
            <button className="rounded-full bg-slate-900 px-10 py-4 text-lg font-bold text-white shadow-xl transition-all hover:scale-105 hover:bg-slate-800">
              Start free
            </button>
          </Link>
          <Link href="/" className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
