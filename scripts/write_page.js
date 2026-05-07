import fs from 'fs';
const content = `import FeaturesClient from "./FeaturesClient";

export const metadata = {
  title: "Features — Rearvy",
};

const CURRENT_CAPABILITIES = [
  {
    title: "Connected data chat",
    description:
      "Ask questions across connected client data instead of pulling updates from multiple tools manually.",
    icon: "MessageSquare",
    points: [
      "Natural-language questions over connected store, social, traffic, inbox, and spreadsheet data.",
      "Project-scoped chat history so context stays attached to the right client or initiative.",
      "Source-aware answers designed to explain what changed, not just dump metrics.",
    ],
  },
  {
    title: "Insights and alerts",
    description:
      "Rearvy already generates insight cards and alert-like workflows that can evolve into true weekly review prep.",
    icon: "Bell",
    points: [
      "Trend and anomaly style insight generation for supported data sources.",
      "Signals that help an account manager notice what needs an explanation first.",
      "A strong base for recurring digests, risk flags, and weekly client briefs.",
    ],
  },
  {
    title: "Client workspaces via projects",
    description:
      "Projects are the current path toward client workspaces and should become the default container for agency work.",
    icon: "FolderKanban",
    points: [
      "Organize related chats, context, and collaboration by client, campaign, or goal.",
      "Keeps follow-up questions from turning into disconnected one-off chats.",
      "Provides the cleanest migration path to a future client-workspace model.",
    ],
  },
  {
    title: "Agency-ready data connections",
    description:
      "The real first-class integrations in the repo are narrower than the old marketing story, but still useful for agency workflows.",
    icon: "Plug",
    points: [
      "Implemented surfaces include Shopify, Google Analytics, Instagram, Facebook, YouTube, Gmail, Excel, Razorpay, and GitHub.",
      "The product should market only implemented integrations clearly and honestly.",
      "The next step is deeper quality on core agency sources, not broader promise inflation.",
    ],
  },
];

const ROADMAP_PRIORITIES = [
  {
    title: "Weekly client brief",
    detail:
      "Auto-generate a Monday-ready summary with wins, risks, causes, and next steps.",
    icon: "FileText",
  },
  {
    title: "Anomaly-to-playbook flow",
    detail:
      "Turn a detected issue into a suggested action list your team can assign or include in client notes.",
    icon: "ShieldCheck",
  },
  {
    title: "Multi-client command center",
    detail:
      "Give agencies one place to see which accounts need attention before the week gets away from them.",
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
`;
fs.writeFileSync('src/app/features/page.tsx', content, 'utf8');
console.log('Wrote src/app/features/page.tsx');
