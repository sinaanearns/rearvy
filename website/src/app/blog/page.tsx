import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, FileText, MessageSquare, Sparkles, Zap } from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "HOME" },
  { href: "/features", label: "FEATURES" },
  { href: "/download", label: "DOWNLOAD" },
  { href: "/blog", label: "BLOG" },
  { href: "/contact", label: "CONTACT" },
];

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
      "The best first automations are the repetitive tasks that slow the team down every week: summaries, follow-ups, research, and status updates.",
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
    <div className="min-h-screen overflow-x-hidden bg-[#f2f2f2] text-[#050505] selection:bg-black selection:text-white">
      <header className="fixed left-0 right-0 top-0 z-50 border-b-2 border-black bg-[#f2f2f2]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center justify-between px-4 sm:px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-4" aria-label="Rearvy home">
            <span className="font-poster text-[19px] uppercase tracking-[0.28em] sm:text-[21px]">
              Rearvy
            </span>
          </Link>

          <nav className="hidden items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] lg:flex xl:text-[11px] xl:tracking-[0.24em]">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="border-2 border-transparent px-3 py-2 transition-colors hover:border-black hover:bg-black hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="campaign-button campaign-button-light h-10 px-4">
              Login
            </Link>
            <Link href="/signup" className="campaign-button campaign-button-dark h-10 px-4">
              Start free
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-[72px]">
        <section className="poster-grain xerox-noise relative isolate overflow-hidden border-b-2 border-black bg-[#f2f2f2]">
          <div className="mx-auto grid min-h-[calc(100svh-72px)] max-w-[1500px] grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.58fr_0.42fr] lg:items-center lg:px-10 lg:py-12">
            <div className="poster-rise relative z-10 max-w-4xl">
              <div className="mb-6 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.2em] sm:text-[11px]">
                <span className="stamp-label">Rearvy blog</span>
                <span className="stamp-label">Business assistant</span>
                <span className="stamp-label">AI workflows</span>
              </div>

              <h1 className="font-poster text-[50px] leading-[0.86] text-black sm:text-[82px] lg:text-[108px] xl:text-[126px]">
                <span className="block">TALK TO AI</span>
                <span className="block">LIKE A BUSINESS</span>
                <span className="block">ASSISTANT.</span>
              </h1>

              <div className="mt-7 grid max-w-3xl gap-6 border-t-4 border-black pt-6 sm:grid-cols-[1fr_auto] sm:items-end">
                <p className="max-w-xl text-base font-black leading-7 text-black sm:text-lg">
                  Rearvy helps teams research faster, write cleaner, stay organized, and
                  turn everyday prompts into decisions, drafts, and workflows they can
                  actually ship.
                </p>
                <div className="flex flex-wrap gap-3 sm:flex-col">
                  <Link href="/download" className="campaign-button campaign-button-light h-12 px-5">
                    Download for Windows
                  </Link>
                  <Link href="/chat" className="campaign-button campaign-button-dark h-12 px-5">
                    Open the workspace
                    <ArrowUpRight size={16} />
                  </Link>
                </div>
              </div>

              <div className="mt-8 grid max-w-4xl gap-4 border-y-2 border-black py-5 sm:grid-cols-3 sm:gap-0 sm:divide-x-2 sm:divide-black">
                <div className="pr-4">
                  <p className="font-poster text-[38px] leading-none">01</p>
                  <p className="mt-2 text-[11px] font-black uppercase tracking-[0.18em] text-black/62">
                    Ask better questions
                  </p>
                </div>
                <div className="sm:px-4">
                  <p className="font-poster text-[38px] leading-none">02</p>
                  <p className="mt-2 text-[11px] font-black uppercase tracking-[0.18em] text-black/62">
                    Keep context together
                  </p>
                </div>
                <div className="sm:px-4">
                  <p className="font-poster text-[38px] leading-none">03</p>
                  <p className="mt-2 text-[11px] font-black uppercase tracking-[0.18em] text-black/62">
                    Ship the next step
                  </p>
                </div>
              </div>
            </div>

            <aside className="poster-rise relative min-h-[360px] overflow-hidden border-2 border-black bg-white p-2 shadow-[10px_10px_0_#050505] lg:min-h-[700px]">
              <div className="absolute inset-2 border border-black bg-white p-5">
                <div className="flex h-full flex-col justify-between gap-6">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-black/60">
                      Featured angle
                    </p>
                    <p className="mt-3 font-poster text-[36px] leading-[0.95] sm:text-[52px]">
                      REARVY IS YOUR WORKSPACE FOR THE QUESTIONS THAT MOVE THE BUSINESS.
                    </p>
                  </div>

                  <div className="grid gap-4">
                    {USE_CASES.map((item) => {
                      const Icon = item.icon;

                      return (
                        <div key={item.title} className="border-2 border-black bg-[#f8f8f8] p-4 shadow-[4px_4px_0_#050505]">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-black bg-white">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <h2 className="text-sm font-black uppercase tracking-[0.14em]">
                                {item.title}
                              </h2>
                              <p className="mt-1 text-sm leading-6 text-black/80">
                                {item.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-2 border-black bg-black px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                    From prompts to plans, drafts, and follow-up.
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="border-b-2 border-black bg-black px-4 py-16 text-white sm:px-6 lg:px-10 lg:py-20">
          <div className="mx-auto max-w-[1500px] space-y-8">
            <div className="max-w-3xl">
              <p className="stamp-label stamp-label-invert inline-flex">Use cases</p>
              <h2 className="mt-5 font-poster text-[44px] leading-[0.92] sm:text-[72px] lg:text-[88px]">
                WHAT REARVY HELPS WITH.
              </h2>
              <p className="mt-5 border-l-4 border-white pl-5 text-base font-black leading-7 text-white sm:text-lg">
                If your team already uses chat to think through work, Rearvy gives that
                conversation a real operating surface: research, writing, planning, and
                automation in one place.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {USE_CASES.map((item) => {
                const Icon = item.icon;

                return (
                  <article key={item.title} className="border-2 border-white bg-white p-6 text-black shadow-[6px_6px_0_rgba(255,255,255,0.3)]">
                    <Icon className="h-7 w-7 text-black" />
                    <h3 className="mt-4 text-xl font-black uppercase tracking-[0.12em]">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-black/78">{item.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-b-2 border-black bg-[#f2f2f2] px-4 py-16 sm:px-6 lg:px-10 lg:py-20">
          <div className="mx-auto max-w-[1500px] space-y-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-[10px] font-black uppercase tracking-[0.26em] text-black/60">
                  Recent posts
                </p>
                <h2 className="mt-4 font-poster text-[44px] leading-[0.92] sm:text-[68px] lg:text-[84px]">
                  PRACTICAL IDEAS FOR PEOPLE WHO NEED AI TO HELP, NOT HINDER.
                </h2>
              </div>
              <Link href="/signup" className="campaign-button campaign-button-dark h-12 px-5">
                Start using Rearvy
                <ArrowUpRight size={16} />
              </Link>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {BLOG_POSTS.map((post) => (
                <article key={post.title} className="border-2 border-black bg-white p-6 shadow-[6px_6px_0_#050505] transition-transform hover:-translate-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-black/60">
                    <span className="border border-black px-2 py-1">{post.category}</span>
                    <span>{post.readTime}</span>
                  </div>
                  <h3 className="mt-4 text-2xl font-black leading-tight text-black sm:text-[28px]">
                    {post.title}
                  </h3>
                  <p className="mt-4 text-base leading-7 text-black/78">{post.summary}</p>
                  <div className="mt-6 flex items-center justify-between gap-3 border-t-2 border-black pt-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/60">
                      Rearvy blog
                    </span>
                    <Link href="/chat" className="campaign-button campaign-button-light h-10 px-4">
                      Use Rearvy
                      <ArrowUpRight size={15} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-10 lg:py-20">
          <div className="mx-auto grid max-w-[1500px] gap-8 lg:grid-cols-[0.46fr_0.54fr] lg:items-end">
            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-black/60">
                Next step
              </p>
              <h2 className="font-poster text-[44px] leading-[0.92] sm:text-[68px] lg:text-[84px]">
                OPEN THE WORKSPACE AND TRY IT ON REAL WORK.
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Link href="/download" className="campaign-button campaign-button-light h-12 px-5">
                Download Rearvy
                <ArrowUpRight size={16} />
              </Link>
              <Link href="/login" className="campaign-button campaign-button-dark h-12 px-5">
                Login
                <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}