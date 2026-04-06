"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/components/auth-provider";
import { getIdToken } from "@/lib/firebase/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ShoppingBag,
  IndianRupee,
  Instagram,
  Youtube,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Unplug,
  Package,
  ShoppingCart,
  Loader2,
  Video,
  MessageSquare,
  Image as ImageIcon,
  Globe,
  Copy,
  Check,
  Search,
  Mail,
  FileSpreadsheet,
} from "lucide-react";

type IntegrationData = {
  id: string;
  provider: string;
  provider_account_name: string | null;
  status: "active" | "expired" | "revoked" | "error";
  last_synced_at: string | null;
  scopes: string[];
  created_at: string;
};

type SyncedData = {
  products: number;
  orders: number;
  razorpayPayments: number;
  videos: number;
  youtubeComments: number;
  instagramPosts: number;
  instagramComments: number;
  facebookPosts: number;
  facebookComments: number;
  gmailMessages: number;
  excelWorkbooks: number;
  excelRows: number;
};

type IntegrationSlug =
  | "shopify"
  | "razorpay"
  | "youtube"
  | "instagram"
  | "facebook"
  | "google_analytics"
  | "gmail"
  | "excel";

type IntegrationMeta = {
  title: string;
  subtitle: string;
  description: string;
  category: string;
  capabilityType: string;
  website: string;
  connectLabel: string;
  previewChats: Array<{ user: string; reply: string }>;
  isComingSoon?: boolean;
};

const INTEGRATION_META: Record<IntegrationSlug, IntegrationMeta> = {
  shopify: {
    title: "Shopify",
    subtitle: "Analyze sales, products, and customer behavior",
    description:
      "Connect your Shopify store so Rearvy can answer questions about your sales performance, products, and customers using real store data.",
    category: "Ecommerce",
    capabilityType: "Interactive",
    website: "shopify.com",
    connectLabel: "Connect Shopify",
    isComingSoon: true,
    previewChats: [
      {
        user: "@Shopify show my top-selling products this week",
        reply: "Here are your top 3 products this week:\n• Wireless Earbuds — 142 sales (+18%)\n• Phone Stand Pro — 98 sales (+5%)\n• USB-C Hub — 74 sales (−3%)",
      },
      {
        user: "@Shopify how does this month's revenue compare to last month?",
        reply: "This month: $24,810 (+12% vs last month $22,152). Your average order value also increased from $38 to $43.",
      },
      {
        user: "@Shopify which customers haven't ordered in 60+ days?",
        reply: "Found 34 customers inactive for 60+ days. Top spenders include @alice@example.com ($420 LTV) and @bob@example.com ($310 LTV).",
      },
    ],
  },
  razorpay: {
    title: "Razorpay",
    subtitle: "Track direct collections and payment method mix",
    description:
      "Connect Razorpay so Rearvy can answer questions about direct collections, UPI totals, card vs wallet mix, and Shopify plus Razorpay combined performance.",
    category: "Payments",
    capabilityType: "Interactive",
    website: "razorpay.com",
    connectLabel: "Connect Razorpay",
    isComingSoon: true,
    previewChats: [
      {
        user: "@Razorpay how much did we do this month?",
        reply: "This month so far: Shopify ₹2,84,000 + direct Razorpay ₹96,500 = ₹3,80,500 total collections.",
      },
      {
        user: "@Razorpay break this month into Shopify vs UPI",
        reply: "Shopify drove 74.6% of collections. Within Razorpay, UPI contributed ₹61,200, ahead of cards at ₹22,800.",
      },
      {
        user: "@Razorpay is direct UPI growing faster than Shopify?",
        reply: "Yes. Direct UPI collections are up 18% vs the previous period, while Shopify is up 9%.",
      },
    ],
  },
  youtube: {
    title: "YouTube",
    subtitle: "Understand video performance and audience engagement",
    description:
      "Connect your YouTube channel and ask Rearvy anything about your video performance, watch time, comments, and subscriber trends.",
    category: "Social",
    capabilityType: "Interactive",
    website: "youtube.com",
    connectLabel: "Connect YouTube",
    previewChats: [
      {
        user: "@YouTube which video got the most watch time last month?",
        reply: "\"How I Built a SaaS in 7 Days\" led with 14,320 minutes of watch time — 2.4× your channel average.",
      },
      {
        user: "@YouTube which recent videos are turning viewers into subscribers?",
        reply: "Your last 3 uploads drove 61% of this month's subscriber growth. Tutorials are converting viewers better than announcement videos.",
      },
      {
        user: "@YouTube what's my subscriber growth trend?",
        reply: "You gained 412 subscribers this week, up 28% from last week. Your fastest growth came after Tuesday's upload.",
      },
    ],
  },
  instagram: {
    title: "Instagram",
    subtitle: "Track followers, engagement, and content performance",
    description:
      "Connect your Instagram Business account so Rearvy can analyze your posts, reels, reach, and engagement data in natural language.",
    category: "Social",
    capabilityType: "Interactive",
    website: "instagram.com",
    connectLabel: "Connect Instagram",
    previewChats: [
      {
        user: "@Instagram which posts got the most saves this week?",
        reply: "Your carousel \"5 Design Tips\" received 284 saves — 3× your average. Reels also outperformed static posts in reach.",
      },
      {
        user: "@Instagram compare my reels engagement vs regular posts",
        reply: "Reels avg engagement rate: 6.8%. Static posts: 3.1%. Reels are reaching 2.2× more non-followers this month.",
      },
      {
        user: "@Instagram summarize my audience growth this month",
        reply: "You gained 1,240 followers this month (+8.4%). Best performing day was Friday. 64% of new followers came from Explore.",
      },
    ],
  },
  facebook: {
    title: "Facebook",
    subtitle: "Manage pages and analyze audience engagement",
    description:
      "Connect your Facebook Page so Rearvy can analyze your posts, reach, and community interactions using real Page data.",
    category: "Social",
    capabilityType: "Interactive",
    website: "facebook.com",
    connectLabel: "Connect Facebook",
    previewChats: [
      {
        user: "@Facebook show my most engaged posts this week",
        reply: "Your post \"New Features Launch\" had the highest engagement with 420 likes and 85 comments. Reach was 12k.",
      },
      {
        user: "@Facebook how is my page growth this month?",
        reply: "You've gained 245 new followers this month (+4%). Your engagement rate is up 12% compared to last month.",
      },
      {
        user: "@Facebook which posts are driving the most reach this month?",
        reply: "Your product launch posts are reaching 2.1x more people than your average update. Short-form visuals are doing the heavy lifting.",
      },
    ],
  },
  google_analytics: {
    title: "Google Analytics",
    subtitle: "Turn GA4 data into clear business insights",
    description:
      "Connect your GA4 property so Rearvy can answer questions about website traffic, user behavior, and conversion metrics from your real data.",
    category: "Analytics",
    capabilityType: "Interactive",
    website: "analytics.google.com",
    connectLabel: "Connect Google Analytics",
    previewChats: [
      {
        user: "@Analytics what pages have the highest bounce rate?",
        reply: "Top 3 by bounce rate:\n• /pricing — 78%\n• /blog/post-12 — 71%\n• /contact — 65%\nAll above your site average of 52%.",
      },
      {
        user: "@Analytics compare traffic sources by conversion rate",
        reply: "Organic search converts at 3.2%, email at 5.8%, paid ads at 2.1%. Email campaigns are your most efficient channel.",
      },
      {
        user: "@Analytics how many users visited from mobile this week?",
        reply: "62% of sessions this week were on mobile (4,810 sessions). Mobile bounce rate is 14% higher than desktop.",
      },
    ],
  },
  gmail: {
    title: "Gmail",
    subtitle: "Correlate business emails with revenue outcomes",
    description:
      "Connect your Gmail account so Rearvy can analyze customer communications, categorize inquiries, and identify revenue patterns.",
    category: "Communication",
    capabilityType: "Interactive",
    website: "gmail.com",
    connectLabel: "Connect Gmail",
    previewChats: [
      {
        user: "@Gmail show me trending support issues this week",
        reply: "Detected high volume (8 inquiries) regarding \"shipping delays\" in the last 3 days. Most are linked to orders over $100.",
      },
      {
        user: "@Gmail which customers are at high churn risk?",
        reply: "Found 3 high-value customers expressing negative sentiment. Recommendation: Proactive reach-out to @customer_a (LTV: $1,200).",
      },
      {
        user: "@Gmail correlate pre-sale inquiries with this month's revenue",
        reply: "Conversion rate for pre-sale inquiries is 24%. Customers who ask about inventory convert 15% better than average.",
      },
    ],
  },
  excel: {
    title: "Excel",
    subtitle: "Analyze spreadsheets and workbook tabs",
    description:
      "Connect Microsoft Excel so Rearvy can analyze workbook data from your Microsoft account.",
    category: "Spreadsheet",
    capabilityType: "Connected workbook",
    website: "microsoft.com/excel",
    connectLabel: "Connect Excel",
    isComingSoon: false,
    previewChats: [
      {
        user: "@Excel what products are driving the most revenue in this workbook?",
        reply: "Top performers from the spreadsheet:\n• Bundle Plan A - 142 units\n• Starter Kit - 98 units\n• Premium Add-on - 74 units",
      },
      {
        user: "@Excel compare Q1 and Q2 sales by region",
        reply: "Q2 sales are up 12% overall, led by North America (+18%) and EMEA (+9%).",
      },
      {
        user: "@Excel which tabs have the freshest data?",
        reply: "The Orders and Revenue tabs were updated most recently. Inventory still looks stale by 4 days.",
      },
    ],
  },
};

export default function IntegrationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [integrations, setIntegrations] = useState<IntegrationData[]>([]);
  const [syncedData, setSyncedData] = useState<SyncedData>({
    products: 0,
    orders: 0,
    razorpayPayments: 0,
    videos: 0,
    youtubeComments: 0,
    instagramPosts: 0,
    instagramComments: 0,
    facebookPosts: 0,
    facebookComments: 0,
    gmailMessages: 0,
    excelWorkbooks: 0,
    excelRows: 0,
  });
  const [loading, setLoading] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);
  const [shopDomain, setShopDomain] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [rzpConnecting, setRzpConnecting] = useState(false);
  const [rzpSyncing, setRzpSyncing] = useState(false);
  const [rzpDisconnecting, setRzpDisconnecting] = useState(false);
  const [ytConnecting, setYtConnecting] = useState(false);
  const [ytSyncing, setYtSyncing] = useState(false);
  const [ytDisconnecting, setYtDisconnecting] = useState(false);
  const [igConnecting, setIgConnecting] = useState(false);
  const [igSyncing, setIgSyncing] = useState(false);
  const [igDisconnecting, setIgDisconnecting] = useState(false);
  const [ga4Connecting, setGa4Connecting] = useState(false);
  const [ga4Syncing, setGa4Syncing] = useState(false);
  const [ga4Disconnecting, setGa4Disconnecting] = useState(false);
  const [fbConnecting, setFbConnecting] = useState(false);
  const [fbSyncing, setFbSyncing] = useState(false);
  const [fbDisconnecting, setFbDisconnecting] = useState(false);
  const [gmConnecting, setGmConnecting] = useState(false);
  const [gmSyncing, setGmSyncing] = useState(false);
  const [gmDisconnecting, setGmDisconnecting] = useState(false);
  const [excelConnecting, setExcelConnecting] = useState(false);
  const [excelSyncing, setExcelSyncing] = useState(false);
  const [excelDisconnecting, setExcelDisconnecting] = useState(false);
  const [trackingSnippet, setTrackingSnippet] = useState<string | null>(null);
  const [detailsSlug, setDetailsSlug] = useState<IntegrationSlug | null>(null);
  const [snippetCopied, setSnippetCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchStatus = useCallback(async () => {
    try {
      if (!user) {
        setIntegrations([]);
        setLoading(false);
        return;
      }

      const token = await getIdToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await fetch("/api/integrations/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data.integrations);
        setSyncedData(data.syncedData);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    setLoading(true);
    fetchStatus();
  }, [authLoading, fetchStatus]);

  // Check URL params for OAuth callback results
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");

    const successMessages: Record<string, string> = {
      shopify_connected: "Shopify connected successfully! Data sync in progress.",
      razorpay_connected: "Razorpay connected successfully! Data sync in progress.",
      youtube_connected: "YouTube connected successfully! Data sync in progress.",
      instagram_connected: "Instagram connected successfully! Data sync in progress.",
      google_analytics_connected:
        "Google Analytics connected successfully! Data sync in progress.",
      facebook_connected: "Facebook connected successfully! Data sync in progress.",
      gmail_connected: "Gmail connected successfully! Data sync in progress.",
      excel_connected: "Excel connected successfully! Click Sync Now to import workbook data.",
    };

    if (success && successMessages[success]) {
      setSuccessMsg(successMessages[success]);
      window.history.replaceState({}, "", "/integrations");
      fetchStatus();
    }
    if (params.get("error")) {
      setError(`Connection failed: ${params.get("error")}`);
      window.history.replaceState({}, "", "/integrations");
    }
  }, [fetchStatus]);

  // Handlers
  const handleShopifyConnect = async () => {
    if (!shopDomain.trim()) {
      setError("Please enter your Shopify store domain.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Not authenticated. Please sign in again and try connecting.");
      }
      
      const shopifyUrl = `/api/integrations/shopify/connect?shop=${encodeURIComponent(shopDomain.trim())}`;
      const res = await fetch(shopifyUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to start connection (${res.status})`);
      }
      
      if (!data.url) {
        throw new Error("No authorization URL received from server");
      }
      
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setConnecting(false);
    }
  };

  const handleSync = async (provider: string) => {
    const setSyncingMap: Record<string, (val: boolean) => void> = {
      shopify: setSyncing,
      razorpay: setRzpSyncing,
      youtube: setYtSyncing,
      instagram: setIgSyncing,
      google_analytics: setGa4Syncing,
      facebook: setFbSyncing,
      gmail: setGmSyncing,
      excel: setExcelSyncing,
    };
    const setSyncingFn = setSyncingMap[provider];
    setSyncingFn(true);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/integrations/${provider.replace('_', '-')}/sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      if (provider === 'shopify') {
        setSuccessMsg(`Sync complete! ${data.synced.products} products, ${data.synced.orders} orders updated.`);
      } else if (provider === 'razorpay') {
        setSuccessMsg(`Sync complete! ${data.synced.payments} Razorpay payments updated.`);
      } else if (provider === 'youtube') {
        setSuccessMsg(`Sync complete! ${data.synced.videos} videos, ${data.synced.comments} comments updated.`);
      } else if (provider === 'gmail') {
        setSuccessMsg(`Sync complete! ${data.synced.messages} emails updated.`);
      } else if (provider === 'excel') {
        setSuccessMsg(`Sync complete! ${data.synced.rows} workbook rows across ${data.synced.sheets} sheets updated.`);
      } else {
        setSuccessMsg(`${INTEGRATION_META[provider as IntegrationSlug].title} sync complete!`);
      }
      fetchStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncingFn(false);
    }
  };

  const handleDisconnect = async (provider: string) => {
    const meta = INTEGRATION_META[provider as IntegrationSlug];
    if (!confirm(`Are you sure? This will remove all synced ${meta.title} data.`)) return;

    const setDisconnectingMap: Record<string, (val: boolean) => void> = {
      shopify: setDisconnecting,
      razorpay: setRzpDisconnecting,
      youtube: setYtDisconnecting,
      instagram: setIgDisconnecting,
      google_analytics: setGa4Disconnecting,
      facebook: setFbDisconnecting,
      gmail: setGmDisconnecting,
      excel: setExcelDisconnecting,
    };
    const setDisconnectingFn = setDisconnectingMap[provider];
    setDisconnectingFn(true);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/integrations/${provider.replace('_', '-')}/disconnect`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Disconnect failed");
      setSuccessMsg(`${meta.title} disconnected.`);
      fetchStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setDisconnectingFn(false);
    }
  };

  const handleServerConnect = async (provider: "razorpay") => {
    const setConnectingMap: Record<typeof provider, (val: boolean) => void> = {
      razorpay: setRzpConnecting,
    };

    const setConnectingFn = setConnectingMap[provider];
    setConnectingFn(true);
    setError(null);

    try {
      const token = await getIdToken();
      const res = await fetch(`/api/integrations/${provider}/connect`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to connect");
      }

      setDetailsSlug(null);
      setSuccessMsg(data.message || `${INTEGRATION_META[provider].title} connected successfully! Data sync in progress.`);
      fetchStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnectingFn(false);
    }
  };

  const handleOauthConnect = async (provider: string) => {
    const setConnectingMap: Record<string, (val: boolean) => void> = {
      youtube: setYtConnecting,
      instagram: setIgConnecting,
      google_analytics: setGa4Connecting,
      facebook: setFbConnecting,
      gmail: setGmConnecting,
      excel: setExcelConnecting,
    };
    const setConnectingFn = setConnectingMap[provider];
    setConnectingFn(true);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/integrations/${provider.replace('_', '-')}/connect`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start connection");
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setConnectingFn(false);
    }
  };

  const handleCopySnippet = async () => {
    if (!trackingSnippet) return;
    await navigator.clipboard.writeText(trackingSnippet);
    setSnippetCopied(true);
    setTimeout(() => setSnippetCopied(false), 2000);
  };

  const handleConnectFromDetails = () => {
    if (!detailsSlug) return;
    if (detailsSlug === "excel") {
      void handleOauthConnect("excel");
      return;
    }
    if (detailsSlug === "shopify") {
      setDetailsSlug(null);
      setConnectOpen(true);
      return;
    }
    if (detailsSlug === "razorpay") {
      void handleServerConnect("razorpay");
      return;
    }
    handleOauthConnect(detailsSlug);
  };

  const isDetailConnecting =
    (detailsSlug === "razorpay" && rzpConnecting) ||
    (detailsSlug === "youtube" && ytConnecting) ||
    (detailsSlug === "instagram" && igConnecting) ||
    (detailsSlug === "facebook" && fbConnecting) ||
    (detailsSlug === "google_analytics" && ga4Connecting) ||
    (detailsSlug === "gmail" && gmConnecting) ||
    (detailsSlug === "excel" && excelConnecting);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const INTEGRATION_CONFIG = {
    shopify: {
      icon: <ShoppingBag className="h-5 w-5 text-green-700 dark:text-green-300" />,
      bg: "bg-green-100 dark:bg-green-900",
      syncing: syncing,
      disconnecting: disconnecting,
      stats: (
        <>
          <span className="flex items-center gap-1.5"><Package className="h-3.5 w-3.5" />{syncedData.products} products</span>
          <span className="flex items-center gap-1.5"><ShoppingCart className="h-3.5 w-3.5" />{syncedData.orders} orders</span>
        </>
      ),
      onConnect: () => setDetailsSlug("shopify")
    },
    razorpay: {
      icon: <IndianRupee className="h-5 w-5 text-sky-700 dark:text-sky-300" />,
      bg: "bg-sky-100 dark:bg-sky-900/50",
      syncing: rzpSyncing,
      disconnecting: rzpDisconnecting,
      connecting: rzpConnecting,
      stats: (
        <>
          <span className="flex items-center gap-1.5"><IndianRupee className="h-3.5 w-3.5" />{syncedData.razorpayPayments} payments</span>
        </>
      ),
      onConnect: () => setDetailsSlug("razorpay")
    },
    youtube: {
      icon: <Youtube className="h-5 w-5 text-red-700 dark:text-red-300" />,
      bg: "bg-red-100 dark:bg-red-900",
      syncing: ytSyncing,
      disconnecting: ytDisconnecting,
      connecting: ytConnecting,
      stats: (
        <>
          <span className="flex items-center gap-1.5"><Video className="h-3.5 w-3.5" />{syncedData.videos} videos</span>
          <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" />{syncedData.youtubeComments} comments</span>
        </>
      ),
      onConnect: () => setDetailsSlug("youtube")
    },
    instagram: {
      icon: <Instagram className="h-5 w-5 text-pink-700 dark:text-pink-300" />,
      bg: "bg-pink-100 dark:bg-pink-900",
      syncing: igSyncing,
      disconnecting: igDisconnecting,
      connecting: igConnecting,
      stats: (
        <>
          <span className="flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" />{syncedData.instagramPosts} posts</span>
          <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" />{syncedData.instagramComments} comments</span>
        </>
      ),
      onConnect: () => setDetailsSlug("instagram")
    },
    google_analytics: {
      icon: <Globe className="h-5 w-5 text-orange-700 dark:text-orange-300" />,
      bg: "bg-orange-100 dark:bg-orange-900",
      syncing: ga4Syncing,
      disconnecting: ga4Disconnecting,
      connecting: ga4Connecting,
      stats: null,
      onConnect: () => setDetailsSlug("google_analytics")
    },
    facebook: {
      icon: <MessageSquare className="h-5 w-5 text-blue-700 dark:text-blue-300" />,
      bg: "bg-blue-100 dark:bg-blue-900/50",
      syncing: fbSyncing,
      disconnecting: fbDisconnecting,
      connecting: fbConnecting,
      stats: (
        <>
          <span className="flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" />{syncedData.facebookPosts} posts</span>
          <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" />{syncedData.facebookComments} comments</span>
        </>
      ),
      onConnect: () => setDetailsSlug("facebook")
    },
    gmail: {
      icon: <Mail className="h-5 w-5 text-indigo-700 dark:text-indigo-300" />,
      bg: "bg-indigo-100 dark:bg-indigo-900/50",
      syncing: gmSyncing,
      disconnecting: gmDisconnecting,
      connecting: gmConnecting,
      stats: (
        <>
          <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{syncedData.gmailMessages} emails</span>
        </>
      ),
      onConnect: () => setDetailsSlug("gmail")
    },
    excel: {
      icon: <FileSpreadsheet className="h-5 w-5 text-amber-700 dark:text-amber-300" />,
      bg: "bg-amber-100 dark:bg-amber-900/40",
      syncing: excelSyncing,
      disconnecting: excelDisconnecting,
      connecting: excelConnecting,
      stats: (
        <>
          <span className="flex items-center gap-1.5"><FileSpreadsheet className="h-3.5 w-3.5" />{syncedData.excelWorkbooks} workbooks</span>
          <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" />{syncedData.excelRows} rows</span>
        </>
      ),
      onConnect: () => setDetailsSlug("excel")
    }
  };

  const filteredSlugs = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return (Object.keys(INTEGRATION_META) as IntegrationSlug[]).filter((slug) => {
      const meta = INTEGRATION_META[slug];
      return meta.title.toLowerCase().includes(query) || meta.description.toLowerCase().includes(query);
    });
  }, [searchQuery]);

  const displaySlugs = searchQuery && filteredSlugs.length === 0
    ? (Object.keys(INTEGRATION_META) as IntegrationSlug[]).slice(0, 2)
    : filteredSlugs;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-muted-foreground">Connect your platforms so Rearvy can analyze your real data</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search integrations by title or description..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Status messages */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button className="ml-auto text-red-500 hover:text-red-700" onClick={() => setError(null)}>&times;</button>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
          <button className="ml-auto text-green-500 hover:text-green-700" onClick={() => setSuccessMsg(null)}>&times;</button>
        </div>
      )}


      {displaySlugs.map((slug) => {
        const meta = INTEGRATION_META[slug];
        const config = INTEGRATION_CONFIG[slug];
        const integration = integrations.find((i) => i.provider === slug);

        return (
          <Card key={slug}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${config.bg}`}>{config.icon}</div>
                  <div>
                    <CardTitle className="text-base">{meta.title}</CardTitle>
                    <CardDescription>{meta.subtitle}</CardDescription>
                  </div>
                </div>
                {integration && (
                  <Badge variant={integration.status === "active" ? "default" : "destructive"}>
                    {integration.status === "active" ? "Connected" : integration.status}
                  </Badge>
                )}
                {!integration && meta.isComingSoon && (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400">
                    Coming Soon
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading...</div>
              ) : integration && integration.status === "active" ? (
                <div className="space-y-4">
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="text-sm font-medium">{integration.provider_account_name}</p>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {config.stats}
                      {integration.last_synced_at && <span>Last synced: {formatTime(integration.last_synced_at)}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleSync(slug)} disabled={config.syncing}>
                      {config.syncing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                      {config.syncing ? "Syncing..." : "Sync Now"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDisconnect(slug)} disabled={config.disconnecting} className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950">
                      {config.disconnecting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Unplug className="mr-1.5 h-3.5 w-3.5" />}
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">{meta.description}</p>
                  <Button 
                    onClick={config.onConnect} 
                    disabled={meta.isComingSoon || ('connecting' in config && config.connecting)}
                    variant={meta.isComingSoon ? "outline" : "default"}
                  >
                    {'connecting' in config && config.connecting ? (
                      <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Redirecting...</>
                    ) : meta.isComingSoon ? (
                      <>Coming Soon</>
                    ) : (
                      <>{config.icon} {meta.connectLabel}</>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Integration Details Dialog */}
      {detailsSlug && (() => {
        const meta = INTEGRATION_META[detailsSlug];
        const config = INTEGRATION_CONFIG[detailsSlug];
        
        return (
          <Dialog open onOpenChange={(open) => { if (!open) setDetailsSlug(null); }}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${config.bg}`}>{config.icon}</div>
                  <div>
                    <DialogTitle className="text-2xl font-bold">{meta.title}</DialogTitle>
                    <DialogDescription className="mt-0.5 text-sm">{meta.subtitle}</DialogDescription>
                  </div>
                </div>
                <Button className="shrink-0 rounded-full px-5" onClick={handleConnectFromDetails} disabled={meta.isComingSoon || isDetailConnecting}>
                  {isDetailConnecting ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Connecting...</> : meta.connectLabel}
                </Button>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{meta.description}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {meta.previewChats.map((chat, i) => (
                  <div key={i} className="rounded-2xl border bg-gradient-to-b from-sky-50 to-indigo-50 p-2.5 dark:from-sky-950/40 dark:to-indigo-950/40">
                    <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-neutral-900">
                      <div className="mb-3 flex justify-end">
                        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-neutral-100 px-3 py-2 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">{chat.user}</div>
                      </div>
                      <div className="space-y-1.5">
                        {chat.reply.split("\n").map((line, li) => (
                          <p key={li} className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">{line}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-sm font-medium">{meta.subtitle}</p>
              <div className="mt-4 space-y-2">
                <h3 className="text-lg font-semibold">Information</h3>
                <div className="overflow-hidden rounded-xl border">
                  <div className="flex border-b"><span className="w-36 shrink-0 px-4 py-3 text-sm text-muted-foreground">Category</span><span className="px-4 py-3 text-sm font-medium">{meta.category}</span></div>
                  <div className="flex border-b"><span className="w-36 shrink-0 px-4 py-3 text-sm text-muted-foreground">Capabilities</span><span className="px-4 py-3 text-sm font-medium">{meta.capabilityType}</span></div>
                  <div className="flex"><span className="w-36 shrink-0 px-4 py-3 text-sm text-muted-foreground">Website</span><span className="px-4 py-3 text-sm font-medium text-primary">{meta.website}</span></div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Connect Shopify Store</DialogTitle><DialogDescription>Enter your store domain and you&apos;ll be redirected to Shopify to authorize Rearvy.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shop-domain">Store domain</Label>
              <Input id="shop-domain" placeholder="your-store.myshopify.com" value={shopDomain} onChange={(e) => setShopDomain(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleShopifyConnect(); }} />
              <p className="text-xs text-muted-foreground">You can enter just the store name (e.g. &quot;your-store&quot;) or the full domain.</p>
            </div>
            <Button className="w-full" onClick={handleShopifyConnect} disabled={connecting}>
              {connecting ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Redirecting...</> : <><ShoppingBag className="mr-1.5 h-4 w-4" />Connect with Shopify</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!trackingSnippet} onOpenChange={() => setTrackingSnippet(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Tracking Script</DialogTitle><DialogDescription>Add this snippet to your website&apos;s HTML, just before the closing &lt;/head&gt; tag.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-4"><code className="break-all text-sm">{trackingSnippet}</code></div>
            <Button className="w-full" onClick={handleCopySnippet}>
              {snippetCopied ? <><Check className="mr-1.5 h-4 w-4" />Copied!</> : <><Copy className="mr-1.5 h-4 w-4" />Copy Snippet</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
