import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  FileText,
  MessageSquare,
  Sparkles,
  Zap,
  MousePointer2,
  Layout,
  TrendingUp,
  Globe,
} from "lucide-react";

import { RearvyPublicShell } from "@/components/public/rearvy-public-shell";

const BLOG_POSTS = [
  // Category: Vision (Top Featured)
  {
    title: "Why Rearvy is the Future of Business and Earning",
    category: "Vision",
    readTime: "8 min read",
    summary: "The easiest and most futuristic way to earn. Why manual labor is becoming obsolete and how Rearvy leads the charge.",
  },
  {
    title: "The Easiest Way to Earn in 2026: Mastering AI Automation",
    category: "Vision",
    readTime: "6 min read",
    summary: "Discover why those who use Rearvy will outpace the competition by 100x. Automation is no longer optional—it's mandatory.",
  },
  {
    title: "Scaling to Infinity: The Mandatory Role of AI in Business",
    category: "Vision",
    readTime: "7 min read",
    summary: "You can't scale what you can't automate. Why Rearvy's integrated AI is essential for any modern business empire.",
  },
  // Category: Shopify
  {
    title: "How Maria Automates Your Shopify Store Management",
    category: "Shopify",
    readTime: "6 min read",
    summary: "Let Maria handle product listings, inventory updates, and order tracking while you focus on high-level growth.",
  },
  {
    title: "Scaling Your Shopify Store to 7 Figures with Rearvy AI",
    category: "Shopify",
    readTime: "8 min read",
    summary: "The ultimate guide to using AI for data-driven decisions and automated workflows in modern e-commerce.",
  },
  {
    title: "Winning the Shopify SEO Game: Content Automation with AI",
    category: "Shopify",
    readTime: "7 min read",
    summary: "Generate SEO-rich blog posts and product descriptions that search engines love, completely automatically.",
  },
  {
    title: "The Future of Dropshipping: Zero-Touch Fulfillment with Maria",
    category: "Shopify",
    readTime: "9 min read",
    summary: "From order placement to tracking updates—Maria handles the entire dropshipping lifecycle via desktop control.",
  },
  // Category: Content
  {
    title: "The Content Creator's Secret Weapon: Rearvy AI",
    category: "Content",
    readTime: "5 min read",
    summary: "From idea to viral post—automate your entire content creation workflow with Maria's intelligent desktop execution.",
  },
  {
    title: "Scaling Your YouTube Channel with Rearvy's Data Insights",
    category: "Content",
    readTime: "7 min read",
    summary: "Analyze trends, generate scripts, and optimize titles with the power of integrated AI that sees all your data.",
  },
  {
    title: "Automating Social Media Posting with Mouse-Control Precision",
    category: "Content",
    readTime: "6 min read",
    summary: "Maria can log into your accounts and post for you, ensuring your brand stays active 24/7 without manual effort.",
  },
  // Category: SEO & Niches
  {
    title: "Niche Business SEO: Dominating Local Search with AI",
    category: "SEO",
    readTime: "7 min read",
    summary: "How specialized businesses use Rearvy to outrank big competitors in local search results through automated strategy.",
  },
  {
    title: "Boutique Agency SEO: Winning High-Value Clients with Data",
    category: "SEO",
    readTime: "7 min read",
    summary: "Prove your value with AI-generated reports and data-driven SEO strategies that execute on your behalf.",
  },
  {
    title: "Real Estate Automation: How Maria Finds Your Next Deal",
    category: "Real Estate",
    readTime: "8 min read",
    summary: "Scrape listings, analyze market data, and contact sellers automatically with Rearvy's advanced browser access.",
  },
  // Category: Automation
  {
    title: "Meet Maria: The AI That Controls Your Desktop",
    category: "Automation",
    readTime: "5 min read",
    summary: "Discover how Maria uses mouse and keyboard control to execute complex business tasks just like a human assistant.",
  },
  {
    title: "Browser Automation 2.0: Beyond Simple Scrapers",
    category: "Automation",
    readTime: "6 min read",
    summary: "Maria can navigate websites, fill forms, and interact with web apps seamlessly to scale your operations.",
  },
  {
    title: "Zero-Touch Workflows: Connecting Your Apps with Rearvy",
    category: "Automation",
    readTime: "7 min read",
    summary: "Build complex, cross-app workflows that execute automatically with Rearvy's deep integration engine.",
  },
  // More Topics (Truncated for brevity in UI, but available for LLM)
  { title: "Automating Lead Generation for Boutique Agencies", category: "Agencies", readTime: "6 min read", summary: "Find and qualify leads automatically. Let Maria handle the initial outreach and follow-up." },
  { title: "The Consultant's AI Sidekick: Managing Clients with Rearvy", category: "Consulting", readTime: "5 min read", summary: "Organize meetings, summarize calls, and draft proposals without lifting a finger." },
  { title: "Scaling Your Coaching Business with Automated Workflows", category: "Coaching", readTime: "7 min read", summary: "Focus on your clients, not the paperwork. How Rearvy automates the admin of coaching." },
  { title: "Data-Driven SEO for Niche E-commerce Sites", category: "SEO", readTime: "6 min read", summary: "Go beyond keywords. Use Rearvy to analyze user intent and optimize for conversions." },
  { title: "SaaS Growth Hacking with Rearvy's Integrated Analytics", category: "SaaS", readTime: "7 min read", summary: "Identify growth opportunities and automate your funnel with AI-powered insights." },
  { title: "The Future of Freelancing: Using AI to Work Less and Earn More", category: "Freelancing", readTime: "5 min read", summary: "Stop trading time for money. Use Rearvy to automate your tasks and scale your income." },
  { title: "Podcast Automation: From Recording to Show Notes", category: "Content", readTime: "6 min read", summary: "Automate the tedious parts of podcasting. Transcripts, summaries, and social clips made easy." },
  { title: "The Power of Integrated Data: Why One Brain is Better Than Ten", category: "Automation", readTime: "5 min read", summary: "Connect Shopify, YouTube, Gmail, and more for unified business intelligence." },
  { title: "From Employee to Empire Builder with Rearvy AI", category: "Vision", readTime: "9 min read", summary: "How one person can run a multi-million dollar business using Rearvy's automation tools." },
  { title: "Why Manual Coding is Over: The Future of AI-Driven Creation", category: "Vision", readTime: "7 min read", summary: "Just like white coding, business is evolving. Rearvy is leading the charge into the next era." },
  { title: "Automating Shopify Customer Support with Rearvy", category: "Shopify", readTime: "5 min read", summary: "Turn inquiries into sales automatically. How Maria uses your data to provide perfect responses." },
  { title: "Real-time Inventory Management: The Maria Advantage", category: "Shopify", readTime: "4 min read", summary: "Never oversell again. Maria monitors stock across platforms and updates Shopify instantly." },
  { title: "Optimizing Shopify SEO with Rearvy's Intelligent Insights", category: "Shopify", readTime: "7 min read", summary: "Rank higher and sell more. Use AI to identify high-converting keywords automatically." },
  { title: "Managing Multiple Shopify Stores Seamlessly with Rearvy", category: "Shopify", readTime: "6 min read", summary: "Centralize your operations. Control all your Shopify instances from one Rearvy dashboard." },
  { title: "Boosting Shopify Conversion Rates Using AI Personalization", category: "Shopify", readTime: "5 min read", summary: "Tailor the shopping experience with AI that analyzes user data for perfect suggestions." },
  { title: "Automated Shopify Marketing: From Email to Social Ads", category: "Shopify", readTime: "7 min read", summary: "Let Rearvy draft and launch your Shopify marketing campaigns based on real-time sales data." },
  { title: "Shopify Analytics Redefined: Asking Maria for Truth", category: "Shopify", readTime: "4 min read", summary: "Stop digging through reports. Ask Maria 'How are my sales today?' and get instant answers." },
  { title: "Seamless Shopify Migrations: How Maria Simplifies the Move", category: "Shopify", readTime: "6 min read", summary: "Moving to Shopify? Let Maria handle the data transfer and setup with mouse-control precision." },
  { title: "Protecting Your Shopify Store: AI-Driven Fraud Detection", category: "Shopify", readTime: "5 min read", summary: "Identify and block fraudulent orders before they impact your bottom line with Rearvy AI." },
  { title: "Shopify App Integration: Connecting Everything via Rearvy", category: "Shopify", readTime: "6 min read", summary: "Connect your favorite Shopify apps to one central AI brain for unified intelligence." },
  { title: "The Power of Voice: Managing Shopify with Maria Voice", category: "Shopify", readTime: "4 min read", summary: "Talk to your store. Use Maria Voice to check orders, update prices, and manage customers." },
  { title: "From Raw Footage to Polished Scripts: Rearvy for Creators", category: "Content", readTime: "8 min read", summary: "Transcribe, summarize, and draft scripts from your videos in seconds using Rearvy AI." },
  { title: "Building a Profitable Newsletter with Rearvy Content Hub", category: "Content", readTime: "6 min read", summary: "Curate content and draft engaging newsletters automatically based on the latest trends." },
  { title: "The Future of Influencer Marketing: Data-Driven Partnerships", category: "Content", readTime: "5 min read", summary: "Use Rearvy to find the perfect partners and track campaign ROI with integrated analytics." },
  { title: "Repurposing Content Like a Pro: One Video, Ten Posts", category: "Content", readTime: "7 min read", summary: "Let Maria turn your long-form content into Tweets, Reels, and LinkedIn posts instantly." },
  { title: "Mastering Instagram SEO with Rearvy's Intelligent Tagging", category: "Content", readTime: "4 min read", summary: "Get more eyes on your posts. Use AI to find the best hashtags and keywords automatically." },
  { title: "Automated Community Management: Engaging with Your Fans", category: "Content", readTime: "6 min read", summary: "Let Maria handle the routine comments and DMs so you can focus on creation." },
  { title: "The AI Scriptwriter: Crafting Viral Hooks with Rearvy", category: "Content", readTime: "5 min read", summary: "Stop staring at a blank page. Use Rearvy to generate high-engagement hooks for videos." },
  { title: "Monetizing Your Content: Rearvy's Revenue Strategies", category: "Content", readTime: "7 min read", summary: "Identify new revenue streams and optimize existing ones with AI-driven financial insights." },
  { title: "Building a Brand Identity with Rearvy's Creative Assistant", category: "Content", readTime: "6 min read", summary: "Keep your brand consistent with AI-generated style guides and creative assets." },
  { title: "Video SEO: Ranking Your Content on Page One", category: "Content", readTime: "5 min read", summary: "Optimize your video metadata and descriptions for maximum reach with Rearvy AI." },
  { title: "The Creator Economy in 2026: Why Rearvy is Mandatory", category: "Content", readTime: "8 min read", summary: "Stay ahead of the curve. Why AI-driven automation is the key to thriving as a creator." },
  { title: "E-learning Redefined: Automating Course Management", category: "Education", readTime: "6 min read", summary: "Manage students, grade assignments, and update content automatically with Maria." },
  { title: "How Maria Handles Your Boring Administrative Tasks", category: "Automation", readTime: "4 min read", summary: "Email sorting, data entry, and file management—Maria does it all so you don't have to." },
  { title: "The Security of Automation: How Rearvy Protects Your Data", category: "Automation", readTime: "6 min read", summary: "Automate with peace of mind. Learn about Rearvy's secure, desktop-first approach." },
  { title: "Custom Workflows for Niche Businesses: Building with Maria", category: "Automation", readTime: "7 min read", summary: "No coding required. Teach Maria to handle your unique business processes via desktop." },
];

const USE_CASES = [
  {
    title: "Shopify Automation",
    description:
      "Automate listings, fulfillment, and customer service. Maria executes tasks on Shopify exactly like a human would.",
    icon: Layout,
  },
  {
    title: "Niche SEO Growth",
    description:
      "Dominate your niche with AI-driven SEO strategies that find the best keywords and execute the content plan.",
    icon: TrendingUp,
  },
  {
    title: "Content Empire",
    description:
      "Scale your creation. From YouTube scripts to social posting, Rearvy handles the workflow while you dream.",
    icon: Sparkles,
  },
  {
    title: "Desktop Execution",
    description:
      "Maria controls your mouse and keyboard. Sign in to any app, move data, and execute tasks on your behalf.",
    icon: MousePointer2,
  },
];

const READING_PATHS = [
  {
    step: "01",
    title: "Connect Your Data",
    detail: "Integrate Shopify, YouTube, Gmail, and your local files. AI needs context to win.",
    icon: Globe,
  },
  {
    step: "02",
    title: "Deploy Maria",
    detail: "Give Maria tasks. Watch as she controls your browser and desktop to execute for you.",
    icon: MousePointer2,
  },
  {
    step: "03",
    title: "Scale Earnings",
    detail: "Automate the repetitive and focus on the futuristic. Earn more by working smarter.",
    icon: TrendingUp,
  },
];

const FEATURED_TAKEAWAYS = [
  "Integrated data access: AI knows your entire business context.",
  "Desktop control: Maria executes tasks by controlling your mouse and keyboard.",
  "SEO Mastery: Automate niche-based SEO for unstoppable growth.",
];

function BlogHeroPanel() {
  return (
    <div className="relative mx-auto w-full max-w-[640px] overflow-hidden rounded-[8px] border border-white/12 bg-black/55 p-4 shadow-sm shadow-black/25 backdrop-blur-xl">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-200/0 via-cyan-200/70 to-emerald-200/0" />
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-cyan-100/74">
            <TrendingUp className="h-3.5 w-3.5" />
            Growth Engine
          </div>
          <p className="mt-2 text-xl font-semibold leading-tight text-white">
            Scaling niche business with futuristic AI
          </p>
        </div>
        <span className="rounded-[8px] border border-emerald-200/18 bg-emerald-200/10 px-3 py-1 text-xs font-semibold text-emerald-100">
          Scaling
        </span>
      </div>

      <div className="grid gap-3 py-4">
        {[
          {
            label: "Goal",
            text: "Scale Shopify store to 7 figures via niche SEO automation.",
            icon: TrendingUp,
          },
          {
            label: "AI Agent",
            text: "Maria: Controlling browser, signing in Shopify, updating products.",
            icon: MousePointer2,
          },
          {
            label: "Result",
            text: "300% increase in organic reach with zero manual effort.",
            icon: Zap,
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.label} className="grid grid-cols-[40px_minmax(0,1fr)] gap-3 rounded-[8px] border border-white/10 bg-white/[0.06] p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-white/12 bg-white/8 text-cyan-100">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-white/58">
                  {item.label}
                </p>
                <p className="mt-1 text-sm leading-6 text-white/78">{item.text}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-3">
        {[
          ["Automate", "Desktop control"],
          ["Integrate", "All your data"],
          ["Earn", "Futuristic growth"],
        ].map(([value, label]) => (
          <div key={value} className="rounded-[8px] border border-white/10 bg-black/24 p-3">
            <p className="text-sm font-semibold text-white">{value}</p>
            <p className="mt-1 text-xs font-medium text-white/58">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export const metadata: Metadata = {
  title: "Blog | Rearvy",
  description:
    "How to scale niche businesses, automate Shopify, and dominate SEO with Rearvy's futuristic AI agents.",
};

export default function BlogPage() {
  const [featuredPost, ...readNextPosts] = BLOG_POSTS;

  return (
    <RearvyPublicShell
      eyebrow={
        <>
          <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
          The Future of Earning
        </>
      }
      title={
        <>
          Scale your business
          <span className="block">with futuristic</span>
          <span className="block">AI automation.</span>
        </>
      }
      description="The easiest and most futuristic way of earning is using Rearvy. Mandatory for scaling any niche business, from Shopify to content creation."
      primaryCta={{ href: "/download", label: "Start Scaling", icon: ArrowUpRight }}
      secondaryCta={{ href: "/demo", label: "See Maria in Action" }}
      sidePanel={<BlogHeroPanel />}
      stats={[
        { value: "50+", label: "Niche strategies" },
        { value: "01", label: "Integrated AI Brain" },
        { value: "Zero", label: "Manual Effort" },
      ]}
    >
      <section aria-labelledby="blog-reading-paths-title" className="mx-auto w-full max-w-[1180px] px-6">
        <div className="grid gap-5 border-y border-white/12 bg-white/[0.04] py-6 backdrop-blur-xl lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <div className="px-0 sm:px-2">
            <p className="text-sm font-medium text-cyan-100/74">
              Your path to empire
            </p>
            <h2 id="blog-reading-paths-title" className="mt-3 max-w-md text-[clamp(1.65rem,3.2vw,2.55rem)] font-semibold leading-tight text-white">
              The blueprint for AI-driven scaling.
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-6 text-white/68">
              Rearvy isn't just a tool; it's a mandatory partner for anyone serious about winning in the modern online economy.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {READING_PATHS.map((path) => {
              const Icon = path.icon;

              return (
                <article key={path.step} className="min-w-0 rounded-[8px] border border-white/12 bg-black/24 p-4 shadow-sm shadow-black/15">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-white/46">{path.step}</span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-white/12 bg-white/8 text-cyan-100">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                  </div>
                  <h3 className="mt-5 text-base font-semibold text-white">{path.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/66">{path.detail}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-6 w-full max-w-[1180px] px-6">
        <div className="rounded-[8px] border border-white/12 bg-black/45 p-6 shadow-sm shadow-black/25 backdrop-blur-xl sm:p-8">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {USE_CASES.map((item) => {
              const Icon = item.icon;

              return (
                <article key={item.title} className="rounded-[8px] border border-white/10 bg-white/7 p-5">
                  <Icon className="h-6 w-6 text-cyan-100" />
                  <h2 className="mt-4 text-lg font-semibold text-white">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-white/68">{item.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-6 w-full max-w-[1180px] px-6">
        <div className="grid items-start gap-5 lg:grid-cols-[1.08fr_0.92fr]">
          {featuredPost ? (
            <article className="relative overflow-hidden rounded-[8px] border border-cyan-200/22 bg-cyan-200/[0.08] p-6 shadow-sm shadow-black/20 backdrop-blur-xl sm:p-7">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(105,215,255,0.12),transparent_44%),linear-gradient(245deg,rgba(125,231,199,0.1),transparent_38%)]"
              />

              <div className="relative">
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-cyan-100/74">
                  <span className="inline-flex items-center gap-2 rounded-[8px] border border-cyan-200/18 bg-cyan-200/10 px-3 py-1">
                    <BookOpen className="h-3.5 w-3.5" aria-hidden />
                    Featured Strategy
                  </span>
                  <span>{featuredPost.category}</span>
                  <span>{featuredPost.readTime}</span>
                </div>

                <h2 className="mt-5 max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
                  {featuredPost.title}
                </h2>
                <p className="mt-4 max-w-[68ch] text-base leading-7 text-white/72">
                  {featuredPost.summary}
                </p>

                <div className="mt-6 grid gap-2">
                  {FEATURED_TAKEAWAYS.map((takeaway) => (
                    <div
                      key={takeaway}
                      className="flex gap-3 rounded-[8px] border border-white/10 bg-black/24 p-3"
                    >
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200"
                        aria-hidden
                      />
                      <p className="text-sm leading-6 text-white/68">{takeaway}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 border-t border-white/10 pt-4">
                  <Link
                    href="/signup"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/85"
                  >
                    Start your empire
                    <ArrowUpRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              </div>
            </article>
          ) : null}

          <div className="rounded-[8px] border border-white/12 bg-black/45 p-5 shadow-sm shadow-black/20 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <p className="text-xs font-medium text-cyan-100/74">Knowledge Base</p>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  50+ Strategies for Scaling
                </h2>
              </div>
              <FileText className="h-5 w-5 text-cyan-100" aria-hidden />
            </div>

            <div className="grid max-h-[800px] gap-3 overflow-y-auto pt-4 pr-2 custom-scrollbar">
              {readNextPosts.map((post) => (
                <article
                  key={post.title}
                  className="rounded-[8px] border border-white/10 bg-white/[0.06] p-4 transition hover:border-white/22 hover:bg-white/10"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-white/56">
                    <span className="rounded-[8px] border border-white/12 px-2.5 py-1">
                      {post.category}
                    </span>
                    <span>{post.readTime}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold leading-tight text-white">
                    {post.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-white/66">
                    {post.summary}
                  </p>
                  <Link
                    href="/signup"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white transition hover:text-cyan-100"
                  >
                    Deploy Rearvy
                    <ArrowUpRight className="h-4 w-4" aria-hidden />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </RearvyPublicShell>
  );
}
