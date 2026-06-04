import FeaturesClient from "./FeaturesClient";

const CURRENT_CAPABILITIES = [
  {
    title: "Connected business chat",
    description:
      "Ask questions across connected business data instead of pulling updates from multiple tools manually.",
    icon: "MessageSquare",
    points: [
      "Natural-language questions over connected store, social, traffic, inbox, and spreadsheet data.",
      "Project-scoped chat history so context stays attached to the right account or initiative.",
      "Source-aware answers designed to explain what changed, not just dump metrics.",
    ],
  },
  {
    title: "Insights and alerts",
    description:
      "Rearvy generates insight cards and alert-like workflows that support business review prep.",
    icon: "Bell",
    points: [
      "Trend and anomaly style insight generation for supported data sources.",
      "Signals that help a team notice what needs an explanation first.",
      "A strong base for recurring digests, risk flags, and weekly business briefs.",
    ],
  },
  {
    title: "Business workflow assistant",
    description:
      "Rearvy turns short business requests into analysis, drafts, browser research, and approval-ready work.",
    icon: "ShieldCheck",
    points: [
      "Draft customer replies, follow-up emails, operating notes, and reports from the same workspace.",
      "Use browser research when current public information matters.",
      "Keep sends, files, terminal commands, and desktop actions visible before execution.",
    ],
  },
  {
    title: "Desktop app and updates",
    description:
      "The Windows desktop app opens the hosted workspace and includes built-in update checks.",
    icon: "Download",
    points: [
      "Installer builds stage a downloadable .exe for Windows users.",
      "The app can restart into updates from the profile menu.",
      "Private backend credentials stay on the hosted app instead of shipping inside the installer.",
    ],
  },
  {
    title: "Business workspaces via projects",
    description:
      "Projects are the current path for grouping business context, initiatives, and recurring work.",
    icon: "FolderKanban",
    points: [
      "Organize related chats, context, and collaboration by account, campaign, or goal.",
      "Keeps follow-up questions from turning into disconnected one-off chats.",
      "Provides the cleanest migration path to a stronger business-workspace model.",
    ],
  },
  {
    title: "Business-ready data connections",
    description:
      "Implemented integrations are broad enough for real workflows, but the UI now presents them as sources rather than promises.",
    icon: "Plug",
    points: [
      "Implemented surfaces include Shopify, Google Analytics, Instagram, Facebook, YouTube, Gmail, Excel, Razorpay, and GitHub.",
      "The product should market only implemented integrations clearly and honestly.",
      "The next step is deeper quality on core business sources, not broader promise inflation.",
    ],
  },
];

const ROADMAP_PRIORITIES = [
  {
    title: "Daily business brief",
    detail:
      "Auto-generate a ready-to-review summary with wins, risks, causes, and next steps.",
    icon: "FileText",
  },
  {
    title: "Anomaly-to-playbook flow",
    detail:
      "Turn a detected issue into a suggested action list your team can assign or include in review notes.",
    icon: "ShieldCheck",
  },
  {
    title: "Multi-workstream command center",
    detail:
      "Give teams one place to see which accounts, projects, and actions need attention first.",
    icon: "LineChart",
  },
];

export default function FeaturesPage() {
  return (
    <FeaturesClient
      currentCapabilities={CURRENT_CAPABILITIES}
      roadmapPriorities={ROADMAP_PRIORITIES}
    />
  );
}
