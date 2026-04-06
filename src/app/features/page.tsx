import type { Metadata } from "next";
import Link from "next/link";
import { Check, Zap, MessageSquare, BarChart3, Bell, Globe } from "lucide-react";

export const metadata: Metadata = {
  title: "Features | Rearvy",
  description: "Explore the powerful features of Rearvy, your AI-powered business advisor.",
};

const FEATURES = [
  {
    title: "AI Business Advisor",
    description: "Rearvy acts as a 24/7 intelligent consultant for your business. It doesn't just show data; it understands it.",
    icon: Zap,
    points: [
      "Strategic Recommendations: Get data-driven advice on how to grow your business.",
      "Performance Analysis: Automated breakdown of your business health.",
      "Trend Identification: Discover patterns in your sales and customer behavior."
    ]
  },
  {
    title: "Chat With Your Data",
    description: "Interact with your metrics using natural language. No more complex SQL queries or spreadsheet formulas.",
    icon: MessageSquare,
    points: [
      "Plain English Queries: Ask 'How much did I make last Tuesday?' or 'What's my best-selling product this month?'.",
      "Context-Aware Responses: The AI understands your business history and provides relevant answers.",
      "Real-Time Access: Get answers based on the latest synced data from your integrations."
    ]
  },
  {
    title: "Live Data Visualization",
    description: "Transform raw numbers into beautiful, interactive charts and dashboards.",
    icon: BarChart3,
    points: [
      "Revenue Tracking: Monitor your top-line growth with clean, responsive charts.",
      "Product & Order Analytics: Visualize which products are performing and track order trends.",
      "Interactive Dashboards: Filter and drill down into specific timeframes or metrics."
    ]
  },
  {
    title: "Proactive Insights",
    description: "Stay informed without constantly checking the dashboard.",
    icon: Bell,
    points: [
      "Metric Alerts: Get notified instantly when significant changes occur in your KPIs.",
      "Opportunity Detection: The AI alerts you to potential growth areas or emerging issues."
    ]
  },
  {
    title: "Multi-Source Integrations",
    description: "Seamlessly connect your business ecosystem to a single source of truth.",
    icon: Globe,
    points: [
      "Shopify: Full integration for sales, products, and customer data.",
      "YouTube: Track video performance and engagement metrics.",
      "Google Analytics: Monitor web traffic and conversion data.",
      "Excel: Analyze spreadsheets and workbook tabs from your business files."
    ]
  }
];

const VERSION_HISTORY = [
  {
    version: "v1.1.0",
    title: "Enhanced Analytics & Administration",
    date: "May 2024",
    changes: [
      "Shopify SaaS Model: Refactored Shopify integration for a standalone SaaS model.",
      "Store Claiming: Robust store-claiming mechanism for unauthenticated installs.",
      "Admin Dashboard: Secure, high-level administrative interface for platform management.",
      "Improved Chat UI: Enhanced message rendering for code and complex formatting.",
      "Google AdSense: Support for ad integration to monetize public pages.",
      "Legal Compliance: Added dedicated Privacy Policy and Terms of Service sections.",
      "Performance Fixes: Resolved chat history loading and synchronization issues."
    ]
  },
  {
    version: "v1.0.0",
    title: "Initial Release",
    date: "March 2024",
    changes: [
      "Core Dashboard: Launched the main interface for users to view business metrics.",
      "AI Chat Integration: Introduced the natural language interface for data querying.",
      "Shopify Integration: Enabled seamless data sync for Shopify store owners.",
      "YouTube Integration: Added support for content creators to analyze channel performance.",
      "Google Analytics: Integrated web traffic data for holistic business views.",
      "Insights System: Basic AI-generated reports and metric tracking.",
      "Auth System: Secure Google and Email/Password login via Firebase.",
      "Project Management: Organize data and chats into specific projects."
    ]
  }
];

export default function FeaturesPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-4xl space-y-16">
        <header className="space-y-4 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-slate-600">
            Platform
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
            Rearvy Features
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Everything you need to transform your business data into actionable insights through advanced AI analysis.
          </p>
        </header>

        {/* Feature Sections */}
        <section className="space-y-12">
          {FEATURES.map((feature, idx) => (
            <div key={idx} className="group relative rounded-3xl border border-border/50 bg-card/50 p-8 transition-all hover:bg-card hover:shadow-xl hover:shadow-slate-500/5">
              <div className="flex flex-col gap-6 md:flex-row md:items-start">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 shadow-lg shadow-slate-900/20">
                  <feature.icon className="h-7 w-7 text-white" />
                </div>
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold tracking-tight">{feature.title}</h2>
                  <p className="text-lg text-muted-foreground">{feature.description}</p>
                  <ul className="grid gap-3 sm:grid-cols-1">
                    {feature.points.map((point, pIdx) => (
                      <li key={pIdx} className="flex items-start gap-3 text-sm text-foreground/80">
                        <Check className="mt-1 h-4 w-4 shrink-0 text-slate-600" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Version History */}
        <section className="space-y-8 rounded-3xl border border-slate-700/20 bg-slate-500/5 p-8 sm:p-12">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Version History</h2>
            <p className="text-muted-foreground">Track the evolution of Rearvy.</p>
          </div>
          <div className="space-y-10">
            {VERSION_HISTORY.map((v, idx) => (
              <div key={idx} className="relative border-l-2 border-slate-700/20 pl-8">
                <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 border-slate-700 bg-background" />
                <div className="space-y-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                    <span className="inline-flex w-fit rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white uppercase tracking-wider">
                      {v.version}
                    </span>
                    <h3 className="text-xl font-bold">{v.title}</h3>
                    <span className="text-sm text-muted-foreground">{v.date}</span>
                  </div>
                  <ul className="space-y-2">
                    {v.changes.map((change, cIdx) => (
                      <li key={cIdx} className="text-sm text-muted-foreground before:mr-2 before:content-['•']">
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-col items-center justify-center space-y-6 pt-10">
          <Link href="/signup">
            <button className="rounded-full bg-slate-900 px-10 py-4 text-lg font-bold text-white shadow-xl transition-all hover:scale-105 hover:bg-slate-800">
              Get Started for Free
            </button>
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
