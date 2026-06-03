import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, FileText, MessageSquare, Sparkles, Zap } from "lucide-react";

import { RearvyPublicShell } from "@/components/public/rearvy-public-shell";

const BLOG_POSTS = [
  {
    title: "Why Rearvy feels more like a business assistant than a chatbot",
    category: "Product thinking",
    readTime: "4 min read",
    summary:
      "Rearvy is built to help teams ask better questions, keep context attached, and turn raw answers into something they can actually use at work.",
  },
  {
    title: "How to go from a rough note to a clear plan in one workspace",
    category: "Workflow",
    readTime: "5 min read",
    summary:
      "Instead of moving between docs, chats, and tabs, Rearvy helps you collect the context, organize the next steps, and keep moving.",
  },
  {
    title: "What to automate first when you bring AI into operations",
    category: "Automation",
    readTime: "6 min read",
    summary:
      "The best first automations are repeated tasks that slow the team down every week: summaries, follow-ups, research, and status updates.",
  },
  {
    title: "How teams can use Rearvy for research, writing, and follow-through",
    category: "Team playbook",
    readTime: "7 min read",
    summary:
      "Rearvy helps founders, operators, and marketers turn scattered inputs into briefs, posts, messages, and next actions without losing the thread.",
  },
];

const USE_CASES = [
  {
    title: "Business assistant",
    description:
      "Draft client replies, meeting summaries, follow-up emails, and internal updates that sound like your team.",
    icon: MessageSquare,
  },
  {
    title: "Research assistant",
    description:
      "Compare sources, summarize what matters, and spot patterns before the next decision gets made.",
    icon: Sparkles,
  },
  {
    title: "Writing assistant",
    description:
      "Turn rough notes into polished copy, blog drafts, campaign ideas, and structured docs.",
    icon: FileText,
  },
  {
    title: "Automation assistant",
    description:
      "Use Rearvy to support repeated desktop workflows and the routine tasks that keep coming back.",
    icon: Zap,
  },
];

export const metadata: Metadata = {
  title: "Blog | Rearvy",
  description:
    "Ideas, use cases, and workflows showing how Rearvy helps teams talk to AI like a business assistant.",
};

export default function BlogPage() {
  return (
    <RearvyPublicShell
      eyebrow={
        <>
          <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
          Rearvy blog
        </>
      }
      title={
        <>
          Talk to AI
          <span className="block">like a business</span>
          <span className="block">assistant.</span>
        </>
      }
      description="Ideas, use cases, and workflows for teams using Rearvy to turn everyday prompts into decisions, drafts, and follow-up."
      primaryCta={{ href: "/download", label: "Download", icon: ArrowUpRight }}
      secondaryCta={{ href: "/signup", label: "Start free" }}
      stats={[
        { value: "01", label: "Ask better questions" },
        { value: "02", label: "Keep context together" },
        { value: "03", label: "Ship the next step" },
      ]}
    >
      <section className="mx-auto w-full max-w-[1180px] px-6">
        <div className="rounded-xl border border-white/12 bg-black/45 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-8">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {USE_CASES.map((item) => {
              const Icon = item.icon;

              return (
                <article key={item.title} className="rounded-xl border border-white/10 bg-white/7 p-5">
                  <Icon className="h-6 w-6 text-cyan-100" />
                  <h2 className="mt-4 text-lg font-semibold text-white">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-white/64">{item.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-6 w-full max-w-[1180px] px-6">
        <div className="grid gap-5 lg:grid-cols-2">
          {BLOG_POSTS.map((post) => (
            <article
              key={post.title}
              className="rounded-xl border border-white/12 bg-white/7 p-6 backdrop-blur-xl transition hover:border-white/22 hover:bg-white/10"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-white/50">
                <span className="rounded-full border border-white/12 px-3 py-1">{post.category}</span>
                <span>{post.readTime}</span>
              </div>
              <h3 className="mt-4 text-2xl font-semibold leading-tight text-white">
                {post.title}
              </h3>
              <p className="mt-4 text-base leading-7 text-white/68">{post.summary}</p>
              <div className="mt-6 border-t border-white/10 pt-4">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-white transition hover:text-cyan-100"
                >
                  Use Rearvy
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </RearvyPublicShell>
  );
}
