import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

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

export const metadata: Metadata = {
  title: "Blog | Rearvy",
  description:
    "Ideas, use cases, and workflows showing how Rearvy helps teams talk to AI like a business assistant.",
};

export default function BlogPage() {
  return (
    <RearvyPublicShell
      title=""
      description=""
    >
      <section className="mx-auto w-full max-w-[1180px] px-6 pb-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
          {BLOG_POSTS.map((post) => (
            <article
              key={post.title}
              className="rounded-[8px] border border-white/12 bg-black/45 p-6 shadow-sm shadow-black/20 backdrop-blur-xl transition hover:border-white/22 hover:bg-white/10"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-white/56">
                <span className="rounded-[8px] border border-white/12 px-2.5 py-1">
                  {post.category}
                </span>
                <span>{post.readTime}</span>
              </div>
              <h3 className="mt-4 text-xl font-semibold leading-tight text-white">
                {post.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-white/66">
                {post.summary}
              </p>
              <Link
                href="/signup"
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white transition hover:text-cyan-100"
              >
                Read article
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            </article>
          ))}
        </div>
      </section>
    </RearvyPublicShell>
  );
}
