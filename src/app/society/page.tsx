import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Coins, Handshake, MessageSquare, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Rearvy Society | Build Ideas Together",
  description:
    "Rearvy Society is an open business platform where people build strong ideas together, collaborate through chat, and get rewarded for meaningful contributions.",
};

const CORE_POINTS = [
  {
    title: "Open Business Platform",
    description:
      "Rearvy Society is built for people with real ideas. If you have a concept, a draft plan, or early traction, you can bring it in and build with others.",
    icon: Users,
  },
  {
    title: "Contribution-Based Rewards",
    description:
      "People who create strong impact are recognized and rewarded. We focus on practical value, execution quality, and measurable results.",
    icon: Coins,
  },
  {
    title: "Collaboration by Design",
    description:
      "You can connect with others, send requests by username, and build trusted working relationships around projects and opportunities.",
    icon: Handshake,
  },
];

const CHAT_INTRO = [
  "Rearvy Chat helps you understand how the platform works and how contribution can lead to monthly profit opportunities.",
  "Elite Chat is an admin-guided channel for direct strategic support and high-signal conversations.",
  "Each month, members are expected to share: what they did, issues they faced, and what they want next for the business.",
];

export default function SocietyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-5xl space-y-14">
        <header className="space-y-5 text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-slate-500/20 bg-slate-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">
            <Sparkles className="h-3.5 w-3.5" />
            New Community Track
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
            Join Rearvy Society
          </h1>
          <p className="mx-auto max-w-3xl text-lg text-muted-foreground sm:text-xl">
            Rearvy Society is an open business platform. If you have a great idea, we work on it together with execution support, strategy, and collaboration from the community.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup?society=1">
              <Button size="lg" className="bg-gradient-to-r from-slate-700 to-slate-800 px-8 text-base">
                Join Society
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login?society=1&redirect=%2Fdashboard">
              <Button size="lg" variant="outline" className="px-8 text-base">
                I already have an account
              </Button>
            </Link>
          </div>
        </header>

        <section className="grid gap-5 md:grid-cols-3">
          {CORE_POINTS.map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-border/60 bg-card/70 p-6 shadow-sm"
            >
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-700 text-white">
                <item.icon className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-bold tracking-tight">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-border/60 bg-card/70 p-6 shadow-sm sm:p-8">
          <div className="mb-5 flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
              <MessageSquare className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">How communication works</h2>
          </div>

          <ul className="space-y-4 text-muted-foreground">
            {CHAT_INTRO.map((item) => (
              <li key={item} className="rounded-xl border border-border/50 bg-background/70 p-4 text-sm leading-6">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-slate-500/30 bg-slate-500/10 p-6 sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight">What happens after you join</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            Your account can move into a society dashboard experience with a chat-first workflow, default community channels, collaboration requests, and progress tracking for monthly contribution reviews.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup?society=1">
              <Button className="bg-gradient-to-r from-slate-700 to-slate-800">Start with Rearvy Society</Button>
            </Link>
            <Link href="/">
              <Button variant="ghost">Back to home</Button>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
