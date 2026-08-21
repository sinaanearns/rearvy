"use client";

import { useState, useMemo } from "react";
import {
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Search,
  ArrowUpRight,
  CreditCard,
  Globe,
  Database,
  Users,
  CheckCircle2,
  Layers,
  Plus,
  Tag,
  Code2,
  Check,
  Send,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface B2BPartner {
  id: string;
  name: string;
  category: "fintech" | "proxies" | "crm" | "infra" | "operations";
  categoryLabel: string;
  tagline: string;
  description: string;
  perk: {
    badge: string;
    title: string;
    description: string;
    promoCode?: string;
  };
  website: string;
  affiliateUrl: string;
  connectorTemplate: {
    platformType: string;
    capabilityDraft: string;
  };
  verified: boolean;
  featured?: boolean;
}

export const CURATED_B2B_PARTNERS: B2BPartner[] = [
  {
    id: "stripe",
    name: "Stripe",
    category: "fintech",
    categoryLabel: "Payments & Invoicing",
    tagline: "Global payments infrastructure for online businesses",
    description:
      "Accept payments, send payouts, and manage online sales globally with enterprise-grade reliability and fraud prevention.",
    perk: {
      badge: "Exclusive Partner Perk",
      title: "$500 in Fee-Free Processing",
      description: "First $500 in Stripe payment processing fees waived for new Rearvy business accounts.",
      promoCode: "REARVY-STRIPE-500",
    },
    website: "https://stripe.com",
    affiliateUrl: "https://stripe.com/partners/rearvy",
    connectorTemplate: {
      platformType: "SaaS platform",
      capabilityDraft:
        "Stripe payments connector: Automates invoice creation, payment status webhooks, customer subscription upgrades, and financial payout reporting for Rearvy business workflows.",
    },
    verified: true,
    featured: true,
  },
  {
    id: "mercury",
    name: "Mercury",
    category: "fintech",
    categoryLabel: "Banking & Treasury",
    tagline: "Banking built for startups, tech businesses & agencies",
    description:
      "FDIC-insured business bank accounts, high-yield treasury vaults, virtual debit cards, and automated wires with zero monthly fees.",
    perk: {
      badge: "Cash Bonus Perk",
      title: "$250 Cash Bonus + Zero Wire Fees",
      description: "Receive $250 cash deposited after depositing $10k in first 60 days, plus lifetime free domestic and international USD wires.",
      promoCode: "REARVY-MERCURY-VIP",
    },
    website: "https://mercury.com",
    affiliateUrl: "https://mercury.com/partner/rearvy",
    connectorTemplate: {
      platformType: "Internal business system",
      capabilityDraft:
        "Mercury banking connector: Syncs real-time account balances, generates automated daily cash-flow summaries, and alerts on unusual outbound wire activity.",
    },
    verified: true,
    featured: true,
  },
  {
    id: "brightdata",
    name: "Bright Data",
    category: "proxies",
    categoryLabel: "Scraping & Proxies",
    tagline: "The world's #1 web data platform & residential proxy network",
    description:
      "Power your Rearvy headless browser agents with 72M+ residential IPs, Web Unlocker for anti-bot bypass, and scalable SERP scraping.",
    perk: {
      badge: "Proxy Credit Perk",
      title: "$250 Free Proxy & Scraping Credits",
      description: "Get $250 in free residential proxy credits on your first deposit to run continuous headless agent scraping.",
      promoCode: "REARVY-BRIGHT-250",
    },
    website: "https://brightdata.com",
    affiliateUrl: "https://brightdata.com/?rearvy_ref=partner_hub",
    connectorTemplate: {
      platformType: "AI service",
      capabilityDraft:
        "Bright Data scraping connector: Provides rotating residential proxies and automated CAPTCHA solving for Rearvy browser-use autonomous market research agents.",
    },
    verified: true,
    featured: true,
  },
  {
    id: "apify",
    name: "Apify",
    category: "proxies",
    categoryLabel: "Scraping & Cloud Actors",
    tagline: "Cloud platform for web scraping, data extraction & web automation",
    description:
      "Deploy serverless web actors to extract structured data from social media, e-commerce stores, real estate sites, and Google Maps.",
    perk: {
      badge: "Developer Perk",
      title: "$100 Cloud Compute Credit",
      description: "$100 recurring monthly cloud compute credits for running custom scraper actors on Apify cloud infrastructure.",
      promoCode: "APIFY-REARVY-100",
    },
    website: "https://apify.com",
    affiliateUrl: "https://apify.com/?ref=rearvy",
    connectorTemplate: {
      platformType: "SaaS platform",
      capabilityDraft:
        "Apify actor connector: Triggers cloud scrapers for e-commerce catalog price syncs, LinkedIn lead discovery, and social media sentiment tracking.",
    },
    verified: true,
  },
  {
    id: "hubspot",
    name: "HubSpot for Startups",
    category: "crm",
    categoryLabel: "CRM & Inbound Sales",
    tagline: "Customer platform with AI-powered marketing, sales, and service software",
    description:
      "All-in-one CRM suite to track deals, automate lead follow-ups, host landing pages, and organize customer ticketing.",
    perk: {
      badge: "Startup Discount",
      title: "Up to 75% Off Year 1 + Free Onboarding",
      description: "Eligible Rearvy ecosystem startups get up to 75% discount off HubSpot Professional Suite for the entire first year.",
      promoCode: "REARVY-HUBSPOT-75",
    },
    website: "https://hubspot.com/startups",
    affiliateUrl: "https://hubspot.com/startups?partner=rearvy",
    connectorTemplate: {
      platformType: "SaaS platform",
      capabilityDraft:
        "HubSpot CRM connector: Ingests website inbound leads, logs AI-drafted meeting summaries, updates deal stages, and queries contact records for Rearvy executive planning.",
    },
    verified: true,
    featured: true,
  },
  {
    id: "close",
    name: "Close CRM",
    category: "crm",
    categoryLabel: "High-Velocity Sales",
    tagline: "The CRM built specifically for high-growth tech sales teams",
    description:
      "Built-in VoIP calling, SMS, predictive email follow-ups, and automated sales pipeline dashboards with zero bloat.",
    perk: {
      badge: "Extended Trial",
      title: "30-Day Extended Trial + 20% Off Annual",
      description: "Double the trial duration and lock in 20% off all seat tiers for high-velocity outbound teams.",
      promoCode: "CLOSE-REARVY-20",
    },
    website: "https://close.com",
    affiliateUrl: "https://close.com/?partner=rearvy",
    connectorTemplate: {
      platformType: "SaaS platform",
      capabilityDraft:
        "Close CRM connector: Syncs outbound sales email draft sequences, logs phone call transcripts from AssemblyAI, and updates lead pipeline opportunities.",
    },
    verified: true,
  },
  {
    id: "openrouter",
    name: "OpenRouter & DeepSeek",
    category: "infra",
    categoryLabel: "AI Models & Routing",
    tagline: "Unified API for cutting-edge LLMs with high throughput & fallbacks",
    description:
      "Access DeepSeek R1, Claude 3.7 Sonnet, Llama 3.3, and GPT-4o through a single low-latency endpoint with intelligent rate-limit failovers.",
    perk: {
      badge: "AI Credit Perk",
      title: "$50 Model Token Grant",
      description: "Receive $50 in API compute tokens to benchmark fast reasoning models and multi-agent workflows.",
      promoCode: "REARVY-OR-50",
    },
    website: "https://openrouter.ai",
    affiliateUrl: "https://openrouter.ai/?ref=rearvy",
    connectorTemplate: {
      platformType: "AI service",
      capabilityDraft:
        "OpenRouter LLM connector: Routes specialized agent reasoning tasks to DeepSeek R1 for logic and Claude 3.7 for coding via Rearvy AI brain orchestration.",
    },
    verified: true,
  },
  {
    id: "google-workspace",
    name: "Google Workspace",
    category: "infra",
    categoryLabel: "Email & Cloud Workspace",
    tagline: "Custom business email, secure cloud drive storage & Google Meet",
    description:
      "Professional business email (@yourcompany.com), 2TB pooled storage per user, and enterprise security management.",
    perk: {
      badge: "Annual Discount",
      title: "10% Off First Year Business Starter / Standard",
      description: "10% discount promo code for newly configured company domains and team inboxes.",
      promoCode: "REARVY-GW-10OFF",
    },
    website: "https://workspace.google.com",
    affiliateUrl: "https://workspace.google.com/partner/rearvy",
    connectorTemplate: {
      platformType: "SaaS platform",
      capabilityDraft:
        "Google Workspace connector: Reads unread VIP emails, creates Google Calendar events, and archives operational files to Google Drive automatically.",
    },
    verified: true,
  },
  {
    id: "gusto",
    name: "Gusto & Deel",
    category: "operations",
    categoryLabel: "Payroll & Global Hiring",
    tagline: "Automated payroll, employee benefits, contractor invoices & HR compliance",
    description:
      "Hire remote contractors and full-time staff across 150+ countries with automated tax filings and compliance guarantees.",
    perk: {
      badge: "HR Partner Perk",
      title: "3 Months Free Payroll Processing",
      description: "3 months of free payroll software fees when onboarding your first contractor or team member.",
      promoCode: "REARVY-GUSTO-3MO",
    },
    website: "https://gusto.com",
    affiliateUrl: "https://gusto.com/partner/rearvy",
    connectorTemplate: {
      platformType: "Internal business system",
      capabilityDraft:
        "Gusto payroll connector: Summarizes monthly company payroll expenditure, tracks employee time-off requests, and generates automated contractor payout summaries.",
    },
    verified: true,
  },
];

interface B2BPartnershipsPanelProps {
  onPreFillConnector?: (template: { platformType: string; capabilityDraft: string }) => void;
}

export function B2BPartnershipsPanel({ onPreFillConnector }: B2BPartnershipsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedPartner, setSelectedPartner] = useState<B2BPartner | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Apply Partner Modal State
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [applicantCompanyName, setApplicantCompanyName] = useState("");
  const [applicantWebsite, setApplicantWebsite] = useState("");
  const [applicantPerk, setApplicantPerk] = useState("");
  const [applicantContact, setApplicantContact] = useState("");
  const [isSubmittingApp, setIsSubmittingApp] = useState(false);

  const categories = [
    { id: "all", label: "All Partners" },
    { id: "fintech", label: "Payments & Banking" },
    { id: "proxies", label: "Scraping & Proxies" },
    { id: "crm", label: "CRM & Growth" },
    { id: "infra", label: "Cloud & Dev Infra" },
    { id: "operations", label: "Payroll & Operations" },
  ];

  const filteredPartners = useMemo(() => {
    return CURATED_B2B_PARTNERS.filter((partner) => {
      const matchesCategory =
        selectedCategory === "all" || partner.category === selectedCategory;
      const matchesSearch =
        partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        partner.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        partner.perk.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        partner.categoryLabel.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  const handleCopyPromoCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Promo code "${code}" copied to clipboard!`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleConfigureConnector = (partner: B2BPartner) => {
    if (onPreFillConnector) {
      onPreFillConnector(partner.connectorTemplate);
      toast.success(
        `Pre-filled connector brief for ${partner.name}! Switch to Connector Setup to refine and submit.`
      );
    } else {
      navigator.clipboard.writeText(partner.connectorTemplate.capabilityDraft);
      toast.success(
        `Copied connector capability draft for ${partner.name}. Paste it into Connector Setup tab.`
      );
    }
    setSelectedPartner(null);
  };

  const handlePartnerApplicationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicantCompanyName.trim() || !applicantWebsite.trim()) {
      toast.error("Please fill in your company name and website.");
      return;
    }
    setIsSubmittingApp(true);
    setTimeout(() => {
      setIsSubmittingApp(false);
      setIsApplyModalOpen(false);
      toast.success(
        "Partner application submitted! Our ecosystem team will review your tool within 48 hours."
      );
      setApplicantCompanyName("");
      setApplicantWebsite("");
      setApplicantPerk("");
      setApplicantContact("");
    }, 900);
  };

  return (
    <section className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-transparent p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.08] text-white shadow-inner">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-white">B2B Partner Perks & Verified Ecosystem</h2>
                <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs">
                  Verified Directory
                </Badge>
              </div>
              <p className="mt-1 text-xs leading-5 text-white/65 max-w-2xl">
                Exclusive discounts, credits, and pre-built connector templates from verified software partners. 
                Power your Rearvy AI agents with top-tier banking, scraping proxies, CRMs, and developer infrastructure.
              </p>
            </div>
          </div>

          <Button
            onClick={() => setIsApplyModalOpen(true)}
            className="shrink-0 rounded-xl border border-white/20 bg-white font-semibold text-black shadow-lg shadow-black/40 hover:bg-white/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            List Your SaaS / Become a Partner
          </Button>
        </div>

        {/* Search & Filter Bar */}
        <div className="mt-6 flex flex-col gap-3 border-t border-white/[0.08] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search partner, perk, or category..."
              className="h-10 rounded-xl border-white/10 bg-black/60 pl-10 text-xs text-white placeholder:text-white/35 focus-visible:border-white/35"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                  selectedCategory === cat.id
                    ? "bg-white font-semibold text-black shadow-md"
                    : "border border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Partner Cards Grid */}
      {filteredPartners.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/40 py-16 text-center">
          <SlidersHorizontal className="h-8 w-8 text-white/30 mb-2" />
          <p className="text-sm font-semibold text-white/80">No partners found</p>
          <p className="text-xs text-white/50 max-w-sm mt-1">
            Try adjusting your search terms or select a different category filter.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPartners.map((partner) => (
            <article
              key={partner.id}
              className={cn(
                "group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0b0b0b]/90 p-5 shadow-xl shadow-black/25 backdrop-blur-xl transition-all duration-200 hover:border-white/25 hover:bg-[#101010]"
              )}
            >
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white group-hover:text-white">
                        {partner.name}
                      </h3>
                      {partner.verified && (
                        <span title="Verified Rearvy Partner">
                          <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-white/50">{partner.categoryLabel}</span>
                  </div>

                  <Badge
                    variant="outline"
                    className="border-white/15 bg-white/[0.04] text-[10px] text-white/70"
                  >
                    {partner.perk.badge}
                  </Badge>
                </div>

                <p className="text-xs leading-5 text-white/70 line-clamp-2">
                  {partner.description}
                </p>

                {/* Perk Box */}
                <div className="rounded-xl border border-white/15 bg-gradient-to-r from-emerald-500/[0.08] via-teal-500/[0.04] to-transparent p-3.5 space-y-1.5 shadow-inner">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                    <Tag className="h-3.5 w-3.5" />
                    <span>{partner.perk.title}</span>
                  </div>
                  <p className="text-[11px] leading-4 text-white/65">
                    {partner.perk.description}
                  </p>
                  {partner.perk.promoCode && (
                    <div className="flex items-center justify-between pt-1 border-t border-white/10 mt-1.5">
                      <span className="font-mono text-[10px] uppercase text-white/50">Code:</span>
                      <button
                        type="button"
                        onClick={() => handleCopyPromoCode(partner.perk.promoCode!)}
                        className="flex items-center gap-1 font-mono text-xs font-bold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded transition"
                      >
                        {copiedCode === partner.perk.promoCode ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" /> Copied
                          </>
                        ) : (
                          <>
                            <span>{partner.perk.promoCode}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-5 flex items-center gap-2 border-t border-white/10 pt-4">
                <a
                  href={partner.affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black shadow-md hover:bg-white/90 transition"
                >
                  Claim Perk
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedPartner(partner)}
                  className="rounded-lg border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white hover:bg-white/10 hover:text-white"
                  title="Configure Rearvy Agent integration"
                >
                  <Code2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Partner Details & Connector Config Modal */}
      {selectedPartner && (
        <Dialog open={Boolean(selectedPartner)} onOpenChange={(open) => !open && setSelectedPartner(null)}>
          <DialogContent className="max-w-xl border-white/15 bg-[#0b0b0b] text-white p-6 shadow-2xl">
            <DialogHeader className="space-y-2 border-b border-white/10 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-xl font-bold text-white">{selectedPartner.name}</DialogTitle>
                  <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs">
                    Verified Partner
                  </Badge>
                </div>
              </div>
              <DialogDescription className="text-xs text-white/60">
                {selectedPartner.tagline}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              {/* Perk Details */}
              <div className="rounded-xl border border-white/15 bg-emerald-500/[0.06] p-4 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Active Offer</h4>
                <p className="text-sm font-semibold text-white">{selectedPartner.perk.title}</p>
                <p className="text-xs leading-5 text-white/70">{selectedPartner.perk.description}</p>
                {selectedPartner.perk.promoCode && (
                  <div className="flex items-center gap-3 pt-2">
                    <span className="text-xs text-white/50">Redemption Code:</span>
                    <Button
                      size="sm"
                      onClick={() => handleCopyPromoCode(selectedPartner.perk.promoCode!)}
                      className="bg-white text-xs font-mono font-bold text-black hover:bg-white/90 h-7"
                    >
                      {copiedCode === selectedPartner.perk.promoCode ? (
                        <>
                          <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> Copied!
                        </>
                      ) : (
                        <>
                          {selectedPartner.perk.promoCode}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Ready-to-use Connector Template */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Code2 className="h-4 w-4 text-white/60" />
                  Rearvy Sub-Agent Connector Specification
                </h4>
                <p className="text-[11px] text-white/50">
                  Pre-configured specification so your Rearvy autonomous agent can interact with this service.
                </p>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-black/60 p-3 font-mono text-xs text-white/80 whitespace-pre-wrap">
                  {selectedPartner.connectorTemplate.capabilityDraft}
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 border-t border-white/10 pt-4">
              <Button
                variant="outline"
                onClick={() => setSelectedPartner(null)}
                className="w-full sm:w-auto border-white/15 text-xs text-white/70 hover:bg-white/10 hover:text-white"
              >
                Close
              </Button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  onClick={() => handleConfigureConnector(selectedPartner)}
                  className="w-full sm:w-auto bg-white/10 text-xs font-semibold text-white hover:bg-white/20 border border-white/15"
                >
                  <Code2 className="mr-1.5 h-3.5 w-3.5" />
                  Pre-fill in Connector Setup
                </Button>

                <a
                  href={selectedPartner.affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90"
                >
                  Claim Perk & Open
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Become a Partner / List Your SaaS Modal */}
      <Dialog open={isApplyModalOpen} onOpenChange={setIsApplyModalOpen}>
        <DialogContent className="max-w-md border-white/15 bg-[#0b0b0b] text-white p-6 shadow-2xl">
          <DialogHeader className="border-b border-white/10 pb-4">
            <DialogTitle className="text-lg font-bold text-white">Apply for Rearvy Ecosystem Directory</DialogTitle>
            <DialogDescription className="text-xs text-white/60">
              Feature your SaaS, API, or service to thousands of business owners and autonomous AI agents.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePartnerApplicationSubmit} className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-white/80">Company / Product Name</label>
              <Input
                required
                value={applicantCompanyName}
                onChange={(e) => setApplicantCompanyName(e.target.value)}
                placeholder="e.g. ScrapeEngine.io"
                className="border-white/10 bg-black/60 text-xs text-white focus-visible:border-white/35"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-white/80">Product Website URL</label>
              <Input
                required
                type="url"
                value={applicantWebsite}
                onChange={(e) => setApplicantWebsite(e.target.value)}
                placeholder="https://example.com"
                className="border-white/10 bg-black/60 text-xs text-white focus-visible:border-white/35"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-white/80">Proposed Rearvy Member Perk / Discount</label>
              <Input
                value={applicantPerk}
                onChange={(e) => setApplicantPerk(e.target.value)}
                placeholder="e.g. $100 free credits or 20% lifetime discount"
                className="border-white/10 bg-black/60 text-xs text-white focus-visible:border-white/35"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-white/80">Contact Email / Telegram</label>
              <Input
                required
                value={applicantContact}
                onChange={(e) => setApplicantContact(e.target.value)}
                placeholder="partner@yourcompany.com"
                className="border-white/10 bg-black/60 text-xs text-white focus-visible:border-white/35"
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsApplyModalOpen(false)}
                className="border-white/15 text-xs text-white/70 hover:bg-white/10 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingApp}
                className="bg-white font-semibold text-xs text-black hover:bg-white/90"
              >
                {isSubmittingApp ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <Send className="mr-1.5 h-3.5 w-3.5" /> Submit Application
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
