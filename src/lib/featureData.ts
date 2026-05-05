export type Feature = {
  id: string;
  title: string;
  introduced: string;
  description: string;
  benefit: string;
};

export const FEATURES: Feature[] = [
  {
    id: "ai-business-advisor",
    title: "AI Business Advisor",
    introduced: "v1.0.0 (March 2024)",
    description:
      "Rearvy acts as a 24/7 intelligent consultant for your business. It provides strategic recommendations, performance analysis, and trend identification.",
    benefit:
      "Get data-driven advice to grow your business, prioritize opportunities, and monitor overall health without manual analysis.",
  },
  {
    id: "chat-with-data",
    title: "Chat With Your Data",
    introduced: "v1.0.0 (March 2024)",
    description:
      "Interact with your business metrics using natural language. Ask plain-English questions and receive context-aware answers based on your synced data.",
    benefit:
      "Eliminates the need for SQL or spreadsheets — ask questions and get immediate, actionable answers.",
  },
  {
    id: "live-visualization",
    title: "Live Data Visualization",
    introduced: "v1.0.0 (March 2024)",
    description:
      "Turn raw numbers into interactive charts and dashboards for revenue tracking, product analytics, and order trends.",
    benefit:
      "Visualize performance and drill down into specifics for faster, more confident decisions.",
  },
  {
    id: "proactive-insights",
    title: "Proactive Insights & Notifications",
    introduced: "v1.0.0 (March 2024)",
    description:
      "Automated metric alerts and opportunity detection keep you informed of important changes without constant checking.",
    benefit:
      "Receive timely notifications about KPI shifts and growth opportunities so you can act quickly.",
  },
  {
    id: "multi-source-integrations",
    title: "Multi-Source Integrations",
    introduced: "v1.0.0 (March 2024)",
    description:
      "Connect Shopify, YouTube, Google Analytics, and backend stores (Firebase/Supabase) to centralize your business data.",
    benefit:
      "Aggregate data from multiple platforms into a single source of truth for unified analysis and reporting.",
  },
  {
    id: "whispernet",
    title: "Whispernet",
    introduced: "Internal feature",
    description:
      "Specialized internal system for secure data handling, background processing, and summarization (internal name: Whispernet).",
    benefit:
      "Handles secure processing tasks and generates summaries and signals used by insights and alerts.",
  },
  {
    id: "shopify-saas",
    title: "Shopify SaaS Model",
    introduced: "v1.1.0 (May 2024)",
    description:
      "Refactored the Shopify integration into a standalone SaaS model to support multi-tenant store installs.",
    benefit:
      "Simpler onboarding and better scalability for store owners using Rearvy as a SaaS offering.",
  },
  {
    id: "store-claiming",
    title: "Store Claiming",
    introduced: "v1.1.0 (May 2024)",
    description:
      "Robust mechanism to claim stores for unauthenticated installs and properly assign ownership.",
    benefit:
      "Ensures each store is securely associated with the correct owner, even across different install flows.",
  },
  {
    id: "admin-dashboard",
    title: "Admin Dashboard",
    introduced: "v1.1.0 (May 2024)",
    description:
      "A secure, high-level administrative interface for platform management and monitoring.",
    benefit:
      "Gives operators visibility and control over stores, users, and system health.",
  },
  {
    id: "improved-chat-ui",
    title: "Improved Chat UI",
    introduced: "v1.1.0 (May 2024)",
    description:
      "Enhanced message rendering to better display code, tables, and complex formatting in chat.",
    benefit:
      "Improves readability and usability of AI responses, especially for technical or data-heavy answers.",
  },
  {
    id: "ads-and-monetization",
    title: "Google AdSense Integration",
    introduced: "v1.1.0 (May 2024)",
    description:
      "Support for integrating ads to monetize public-facing pages.",
    benefit:
      "Provides an additional revenue stream for public pages and content.",
  },
  {
    id: "legal-compliance",
    title: "Legal & Compliance Pages",
    introduced: "v1.1.0 (May 2024)",
    description:
      "Dedicated Privacy Policy and Terms of Service pages added to the product.",
    benefit:
      "Helps meet legal requirements and builds trust with users and store owners.",
  },
  {
    id: "performance-fixes",
    title: "Performance Fixes",
    introduced: "v1.1.0 (May 2024)",
    description:
      "Fixes addressing chat history loading and synchronization issues across the app.",
    benefit:
      "Improves reliability and provides a smoother user experience.",
  },
  {
    id: "auth-system",
    title: "Authentication System",
    introduced: "v1.0.0 (March 2024)",
    description:
      "Secure Google and Email/Password login powered by Firebase.",
    benefit:
      "Provides safe, familiar sign-in options and account security.",
  },
  {
    id: "project-management",
    title: "Project Management",
    introduced: "v1.0.0 (March 2024)",
    description:
      "Organize data, chats, and analyses into project scopes for better context and collaboration.",
    benefit:
      "Keeps related work grouped so teams can focus on a single business area at a time.",
  },
];

export default FEATURES;
