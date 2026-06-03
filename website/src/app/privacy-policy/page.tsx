import type { Metadata } from "next";
import {
  ArrowRight,
  CheckCircle2,
  DatabaseZap,
  EyeOff,
  FileKey2,
  Fingerprint,
  GitBranch,
  KeyRound,
  LockKeyhole,
  Mail,
  PlugZap,
  RotateCcw,
  ServerCog,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TimerReset,
  Trash2,
} from "lucide-react";

import { RearvyPublicShell } from "@/components/public/rearvy-public-shell";
import { buildMailto, PRIVACY_CONTACT_EMAIL } from "@/lib/public-contact";
import { PrivacyBriefing } from "./privacy-briefing";
import { PrivacyChoiceLab } from "./privacy-choice-lab";
import { PrivacyCircuit } from "./privacy-circuit";
import { PrivacyCommandBar } from "./privacy-command-bar";
import { PrivacyExplorer } from "./privacy-explorer";
import { PrivacyFaqConsole } from "./privacy-faq-console";
import { PrivacyGlossaryDecoder } from "./privacy-glossary-decoder";
import { PrivacyHelpTerminal } from "./privacy-help-terminal";
import { PrivacyPolicyReader } from "./privacy-policy-reader";
import { PrivacyReceiptConsole } from "./privacy-receipt-console";
import { PrivacyRequestBuilder } from "./privacy-request-builder";
import { PrivacyRightsConsole } from "./privacy-rights-console";
import { PrivacySectionFinder } from "./privacy-section-finder";
import { PrivacySnapshot } from "./privacy-snapshot";

export const metadata: Metadata = {
  title: "Privacy Policy | Rearvy Trust Center",
  description:
    "Explore Rearvy's privacy model for account data, integrations, AI workflows, retention, deletion, and user rights.",
  alternates: {
    canonical: "/privacy-policy",
  },
  openGraph: {
    title: "Rearvy Privacy Policy",
    description:
      "A clear, interactive view of how Rearvy handles account data, integrations, AI workflows, retention, and deletion.",
    url: "/privacy-policy",
    siteName: "Rearvy",
    images: [
      {
        url: "/rearvy-social.png",
        width: 1200,
        height: 800,
        alt: "Rearvy Privacy Policy",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rearvy Privacy Policy",
    description:
      "Explore Rearvy's privacy model for account data, integrations, AI workflows, retention, deletion, and user rights.",
    images: ["/rearvy-social.png"],
  },
};

const LAST_UPDATED = "April 7, 2026";

const privacyPrinciples = [
  {
    icon: EyeOff,
    title: "We do not sell personal data",
    body: "Rearvy is built to help you work, not to trade your identity. We do not sell your personal information.",
  },
  {
    icon: SlidersHorizontal,
    title: "You choose what connects",
    body: "Third-party integrations only run after you authorize them, and you can remove connected access from app or provider settings.",
  },
  {
    icon: LockKeyhole,
    title: "Tokens are treated as sensitive",
    body: "Integration credentials and access tokens are handled as operational secrets needed to provide the service.",
  },
  {
    icon: Trash2,
    title: "Deletion is supported",
    body: "You can request deletion of Rearvy account data by contacting us from the email address tied to your account.",
  },
];

const trustSignals = [
  {
    label: "No data sale",
    value: "Off",
    detail: "Personal data sales are not part of Rearvy's model.",
  },
  {
    label: "Deletion path",
    value: "Ready",
    detail: "Account data deletion requests have a documented path.",
  },
  {
    label: "Access model",
    value: "Scoped",
    detail: "Integrations use authorized provider permissions.",
  },
  {
    label: "AI reliance",
    value: "Review",
    detail: "Critical AI outputs should be verified before use.",
  },
];

const privacyPulse = [
  {
    label: "Consent clarity",
    value: "Scoped",
    meter: "92%",
    detail: "Connected data starts with sign-in or provider authorization.",
  },
  {
    label: "Control paths",
    value: "Visible",
    meter: "86%",
    detail: "Deletion, disconnect, access, correction, and export paths are mapped.",
  },
  {
    label: "AI caution",
    value: "Review",
    meter: "78%",
    detail: "Important outputs are framed as review-first instead of automatic truth.",
  },
];

const boundaryMatrix = [
  {
    topic: "Personal data",
    does: "Use account and product data to provide Rearvy features, support, security, and service operations.",
    doesNot: "Sell personal information or turn your identity into an advertising product.",
  },
  {
    topic: "Integrations",
    does: "Access connected services only through user-authorized permission flows and required scopes.",
    doesNot: "Bypass provider controls or claim access that the connected service did not authorize.",
  },
  {
    topic: "AI workflows",
    does: "Process task context, prompts, outputs, and connected data needed to complete requested work.",
    doesNot: "Guarantee that beta AI outputs are always accurate or safe for critical decisions without review.",
  },
  {
    topic: "Deletion",
    does: "Support deletion or anonymization requests for eligible account data.",
    doesNot: "Delete records that must be retained for legal, security, dispute, or compliance reasons.",
  },
];

const scorecardItems = [
  {
    label: "No personal data sales",
    score: "Clear",
    detail: "Rearvy does not sell personal information.",
  },
  {
    label: "User-authorized integrations",
    score: "Scoped",
    detail: "Connected platforms use provider permission flows and selected access scopes.",
  },
  {
    label: "Deletion workflow",
    score: "Available",
    detail: "Users can request eligible account data deletion from the account email.",
  },
  {
    label: "AI output handling",
    score: "Review",
    detail: "Beta AI outputs should be verified before critical use.",
  },
];

const auditSignals = [
  {
    label: "Data sale",
    state: "Pass",
    detail: "Not part of Rearvy's model.",
    tone: "border-emerald-200/24 bg-emerald-200/10 text-emerald-100",
  },
  {
    label: "Integration access",
    state: "Scoped",
    detail: "Provider permissions control what connects.",
    tone: "border-cyan-200/24 bg-cyan-200/10 text-cyan-100",
  },
  {
    label: "AI reliance",
    state: "Review",
    detail: "Important outputs should be checked.",
    tone: "border-amber-200/24 bg-amber-200/10 text-amber-100",
  },
  {
    label: "Deletion",
    state: "Available",
    detail: "Eligible account data can be requested for removal.",
    tone: "border-violet-200/24 bg-violet-200/10 text-violet-100",
  },
];

const mythRealityItems = [
  {
    myth: "Connecting an integration gives Rearvy unlimited access.",
    reality: "Access depends on the provider permissions you authorize, and you can revoke it from Rearvy or the provider.",
  },
  {
    myth: "AI output should be treated as final truth.",
    reality: "Important business, finance, campaign, or automated-action outputs should be reviewed before use.",
  },
  {
    myth: "Deletion means every record disappears instantly.",
    reality: "Eligible data can be deleted or anonymized, while some records may be retained for legal, security, dispute, or compliance reasons.",
  },
  {
    myth: "Privacy controls only live in legal text.",
    reality: "Rearvy surfaces controls through integration disconnects, request flows, provider settings, and privacy support.",
  },
];

const deletionChecklist = [
  {
    title: "Use your account email",
    detail: "Send the request from the email address tied to your Rearvy account so ownership can be verified.",
  },
  {
    title: "Use the deletion subject line",
    detail: 'Set the subject to "Data Deletion Request" so the request is easy to identify and route.',
  },
  {
    title: "Disconnect providers too",
    detail: "If you connected platforms like Meta, remove Rearvy access in those provider settings as well.",
  },
  {
    title: "Expect lawful retention limits",
    detail: "Rearvy deletes or anonymizes eligible personal data unless retention is required for legal, security, dispute, or compliance reasons.",
  },
];

const retentionClock = [
  {
    phase: "Active use",
    status: "Needed now",
    detail: "Account, workflow, and integration data may be used while the service or connected task is active.",
  },
  {
    phase: "Disconnect",
    status: "User controlled",
    detail: "Provider access can be removed from Rearvy where available or from the provider permission panel.",
  },
  {
    phase: "Deletion request",
    status: "Review queue",
    detail: "Eligible account data can be requested for deletion or anonymization from the account email.",
  },
  {
    phase: "Required retention",
    status: "Limited hold",
    detail: "Some records may remain only when needed for legal, security, dispute, compliance, or operational reasons.",
  },
];

const integrationPermissions = [
  {
    name: "Google",
    access: "Gmail, YouTube, analytics, or account data only when the user connects the relevant Google flow.",
    removal: "Remove Rearvy access in Google account app permissions or disconnect inside Rearvy where available.",
  },
  {
    name: "Shopify",
    access: "Store, product, order, customer, or business metadata needed for authorized commerce workflows.",
    removal: "Disconnect the Shopify integration or remove app access from the Shopify admin.",
  },
  {
    name: "Meta",
    access: "Facebook or Instagram data only through approved permissions and connected account settings.",
    removal: "Remove Rearvy from Meta app and business integration settings.",
  },
  {
    name: "GitHub",
    access: "Repository, organization, issue, pull request, and profile metadata based on granted OAuth scopes.",
    removal: "Revoke Rearvy from GitHub authorized OAuth apps or disconnect inside Rearvy where available.",
  },
];

const policyTimeline = [
  {
    date: LAST_UPDATED,
    title: "Current public policy",
    detail: "The active version covering account data, integrations, AI workflows, retention, deletion, and user rights.",
  },
  {
    date: "Material changes",
    title: "Posted on this page",
    detail: "Meaningful changes are reflected here with an updated policy date so users can identify the current version.",
  },
  {
    date: "Support channel",
    title: "Privacy questions stay open",
    detail: "Users can contact Rearvy for access, correction, export, deletion, or other privacy questions.",
  },
];

const dataFlow = [
  {
    label: "Account",
    icon: Fingerprint,
    detail: "Name, email, profile image, authentication details, and account settings.",
  },
  {
    label: "Integrations",
    icon: FileKey2,
    detail: "Authorized tokens, platform metadata, synced content, and permissions needed to operate connected workflows.",
  },
  {
    label: "Product Use",
    icon: DatabaseZap,
    detail: "Usage events, workflow history, technical logs, device/browser details, and performance signals.",
  },
  {
    label: "AI Workflows",
    icon: Sparkles,
    detail: "Prompts, context, generated outputs, and task results needed to run research, planning, and automation features.",
  },
];

const lifecycleSteps = [
  {
    title: "Authorize",
    body: "You sign in or connect a service through its permission flow.",
    tone: "border-sky-200/22 bg-sky-200/8 text-sky-100",
  },
  {
    title: "Process",
    body: "Rearvy uses the authorized context to run chat, automation, research, sync, and reporting workflows.",
    tone: "border-violet-200/22 bg-violet-200/8 text-violet-100",
  },
  {
    title: "Protect",
    body: "Operational safeguards, access controls, and technical logs help keep the product stable and secure.",
    tone: "border-emerald-200/22 bg-emerald-200/8 text-emerald-100",
  },
  {
    title: "Remove",
    body: "You can disconnect integrations or request account data deletion when you want data removed.",
    tone: "border-amber-200/22 bg-amber-200/8 text-amber-100",
  },
];

const controlItems = [
  "Disconnect integrations from settings or the provider's app permissions.",
  "Request account data deletion from the account email address.",
  "Ask for access, correction, deletion, or export where local law provides those rights.",
  "Review AI outputs before relying on critical business, finance, or campaign decisions.",
];

const rightsConsole = [
  {
    action: "Access",
    route: "Email privacy support",
    proof: "Account email",
    outcome: "Request a copy or explanation of eligible account data.",
  },
  {
    action: "Correct",
    route: "Email privacy support",
    proof: "Account email + details",
    outcome: "Ask Rearvy to update inaccurate personal data where applicable.",
  },
  {
    action: "Export",
    route: "Email privacy support",
    proof: "Account email",
    outcome: "Request available account information in a portable format where required.",
  },
  {
    action: "Delete",
    route: "Deletion request",
    proof: "Account email",
    outcome: "Request deletion or anonymization of eligible personal data.",
  },
  {
    action: "Disconnect",
    route: "Provider settings",
    proof: "Connected account",
    outcome: "Revoke integration access from Rearvy or the provider control panel.",
  },
];

const operationRows = [
  {
    label: "Account verification",
    owner: "User identity",
    signal: "Email confirmed",
    status: "Required",
  },
  {
    label: "Integration permission",
    owner: "Connected provider",
    signal: "OAuth scope",
    status: "User approved",
  },
  {
    label: "AI workflow context",
    owner: "Rearvy task runtime",
    signal: "Prompt + output",
    status: "Review first",
  },
  {
    label: "Deletion request",
    owner: "Privacy queue",
    signal: "Account email",
    status: "Supported",
  },
];

const operationNodes = [
  {
    icon: Fingerprint,
    title: "Identify",
    copy: "Confirm the account, workspace, and request owner before sensitive changes.",
  },
  {
    icon: PlugZap,
    title: "Authorize",
    copy: "Use provider permission flows instead of broad, invisible access.",
  },
  {
    icon: GitBranch,
    title: "Execute",
    copy: "Process only the context needed for selected workflows and product operations.",
  },
  {
    icon: Trash2,
    title: "Resolve",
    copy: "Disconnect, delete, anonymize, or retain only where law or security requires it.",
  },
];

const journeySteps = [
  {
    title: "You authorize",
    label: "Permission",
    detail: "Sign in, connect a provider, or ask Rearvy to run a workflow.",
    icon: Fingerprint,
  },
  {
    title: "Rearvy processes",
    label: "Execution",
    detail: "Use only the account, integration, and AI context needed for that task.",
    icon: GitBranch,
  },
  {
    title: "You review",
    label: "Decision",
    detail: "Check important AI outputs before business, finance, or campaign use.",
    icon: CheckCircle2,
  },
  {
    title: "You control",
    label: "Removal",
    detail: "Disconnect integrations or request deletion from your account email.",
    icon: Trash2,
  },
];

const jumpDeckGroups = [
  {
    label: "Understand",
    items: [
      {
        href: "#privacy-briefing",
        label: "Briefing",
        detail: "Switch between owner, operator, and developer views of the policy.",
      },
      {
        href: "#privacy-principles",
        label: "Principles",
        detail: "No sale, user-authorized access, sensitive token handling, deletion support.",
      },
      {
        href: "#privacy-data-map",
        label: "Data map",
        detail: "See the account, integration, technical, and AI context data categories.",
      },
      {
        href: "#privacy-explorer",
        label: "Explorer",
        detail: "Tap through account, integration, AI, reliability, and deletion data paths.",
      },
      {
        href: "#privacy-flow-graph",
        label: "Flow",
        detail: "See the privacy control circuit from consent to removal.",
      },
      {
        href: "#privacy-choice-lab",
        label: "Choices",
        detail: "Toggle optional data areas and see the privacy impact in plain English.",
      },
    ],
  },
  {
    label: "Operate",
    items: [
      {
        href: "#privacy-operations",
        label: "Operations",
        detail: "See how ownership, permission, review, and deletion requests move.",
      },
      {
        href: "#privacy-boundaries",
        label: "Boundaries",
        detail: "Compare what Rearvy does and does not do with data.",
      },
      {
        href: "#privacy-deletion-checklist",
        label: "Deletion",
        detail: "Follow the practical checklist for account data deletion requests.",
      },
      {
        href: "#privacy-retention-clock",
        label: "Retention",
        detail: "See what can be removed and what may need limited retention.",
      },
      {
        href: "#privacy-integrations",
        label: "Integrations",
        detail: "See how connected platform permissions and removal paths work.",
      },
      {
        href: "#privacy-timeline",
        label: "Timeline",
        detail: "Track the policy version history and material update posture.",
      },
      {
        href: "#privacy-journey",
        label: "Journey",
        detail: "Follow the user data path from permission to control.",
      },
      {
        href: "#privacy-lifecycle",
        label: "Lifecycle",
        detail: "See how data moves through authorization, processing, protection, and removal.",
      },
      {
        href: "#privacy-controls",
        label: "Controls",
        detail: "Review the practical choices users keep across connected workflows.",
      },
    ],
  },
  {
    label: "Prove",
    items: [
      {
        href: "#privacy-scorecard",
        label: "Scorecard",
        detail: "Scan the highest-signal guarantees and cautions.",
      },
      {
        href: "#privacy-audit-strip",
        label: "Audit",
        detail: "Check the key privacy signals in one compact strip.",
      },
      {
        href: "#privacy-myths",
        label: "Myths",
        detail: "Separate common privacy assumptions from the actual Rearvy stance.",
      },
      {
        href: "#privacy-receipt",
        label: "Receipt",
        detail: "Scan the short trust receipt before reading detailed legal language.",
      },
      {
        href: "#privacy-snapshot",
        label: "Snapshot",
        detail: "Copy a structured trust summary for vendor review or internal notes.",
      },
    ],
  },
  {
    label: "Act",
    items: [
      {
        href: "#privacy-rights-console",
        label: "Rights",
        detail: "Scan access, correction, export, deletion, and disconnect paths.",
      },
      {
        href: "#privacy-request-builder",
        label: "Request",
        detail: "Draft access, correction, or deletion requests with the right subject line.",
      },
      {
        href: "#privacy-glossary",
        label: "Glossary",
        detail: "Translate policy terms into plain operational language.",
      },
      {
        href: "#privacy-faq",
        label: "FAQ",
        detail: "Search short answers for common privacy questions.",
      },
      {
        href: "#privacy-policy-index",
        label: "Policy",
        detail: "Jump into the complete legal policy sections when you need exact wording.",
      },
    ],
  },
];

const sectionFinderLinks = jumpDeckGroups.flatMap((group) =>
  group.items.map((item) => ({
    ...item,
    group: group.label,
  })),
);

const privacyFaqs = [
  {
    question: "Does Rearvy sell personal data?",
    answer:
      "No. Rearvy does not sell personal information. Data sharing is limited to service providers, integrations, infrastructure, legal requirements, and operations needed to provide the product.",
  },
  {
    question: "What happens when I connect an integration?",
    answer:
      "Rearvy processes the tokens, permissions, metadata, and synced records needed to operate the workflows you authorize. You can disconnect integrations in Rearvy settings where available or from the provider's own app permissions.",
  },
  {
    question: "Can I request deletion of my data?",
    answer:
      `Yes. Email ${PRIVACY_CONTACT_EMAIL} with the subject "Data Deletion Request" from your Rearvy account email address. Rearvy deletes or anonymizes eligible personal data unless retention is required by law.`,
  },
  {
    question: "Are AI outputs automatically safe to rely on?",
    answer:
      "No. Rearvy is in beta, and AI outputs may contain inaccuracies. Review critical business, financial, campaign, or automated action outputs before relying on them.",
  },
];

const privacyReceipt = [
  {
    label: "Personal data sales",
    value: "No",
    note: "Rearvy does not sell personal information.",
  },
  {
    label: "Integration access",
    value: "Permissioned",
    note: "Connected services run through user-authorized permission flows.",
  },
  {
    label: "AI workflow reliance",
    value: "Review",
    note: "Critical outputs should be checked before business use.",
  },
  {
    label: "Deletion path",
    value: "Supported",
    note: "Account data deletion can be requested from the account email.",
  },
  {
    label: "Retention stance",
    value: "Limited",
    note: "Data is retained only as needed for service, security, legal, and operations.",
  },
  {
    label: "Policy version",
    value: LAST_UPDATED,
    note: "Material changes update this page with a revised date.",
  },
];

const privacyGlossary = [
  {
    term: "Personal information",
    meaning: "Data that can identify or reasonably relate to a person or account.",
  },
  {
    term: "Integration token",
    meaning: "A credential from a connected platform that lets Rearvy operate the access you approved.",
  },
  {
    term: "AI workflow context",
    meaning: "The prompt, task details, connected data, and outputs needed to complete an AI-assisted request.",
  },
  {
    term: "Retention",
    meaning: "How long data is kept for service delivery, security, legal compliance, or business operations.",
  },
  {
    term: "Anonymize",
    meaning: "Remove or transform identifying details so the data is no longer tied to a specific account.",
  },
  {
    term: "Provider permissions",
    meaning: "The access scopes controlled by services like Google, Shopify, Meta, GitHub, or payment providers.",
  },
];

const sections = [
  {
    title: "1. Information We Collect",
    iconKey: "fingerprint",
    body: [
      "We may collect account information such as your name, email address, profile image, and authentication details.",
      "When you connect integrations, we may process tokens, permissions, synced records, and metadata needed to access the selected platform data you authorize.",
      "We also collect technical data such as log events, device/browser details, usage analytics, and security signals to operate, secure, and improve Rearvy.",
    ],
  },
  {
    title: "2. How We Use Information",
    iconKey: "serverCog",
    body: [
      "We use information to provide product functionality, authenticate users, run connected integrations, generate AI-assisted workflows, improve service performance, detect abuse, provide support, and send important product or security updates.",
    ],
  },
  {
    title: "3. Data Sharing",
    iconKey: "userCheck",
    body: [
      "We do not sell personal information.",
      "We may share data with infrastructure, analytics, payment, integration, and service providers only as needed to operate Rearvy, or when required by law.",
      "When you connect a third-party service such as Google, Shopify, Meta, GitHub, or a payment provider, your use of that service remains subject to its own terms and privacy policy.",
    ],
  },
  {
    title: "4. Legal Bases and Permissions",
    iconKey: "badgeCheck",
    body: [
      "We process data to perform our contract with you, for legitimate interests such as service security and product improvement, and where required, based on your consent.",
      "If you connect third-party services, Rearvy only accesses data you authorize through the relevant permission flow.",
    ],
  },
  {
    title: "5. Security and Retention",
    iconKey: "lockKeyhole",
    body: [
      "We apply reasonable technical and organizational safeguards to protect data.",
      "No system is fully secure, and you acknowledge this risk by using the service.",
      "We retain data only as long as necessary for service delivery, legal compliance, dispute resolution, security, and legitimate business purposes.",
    ],
  },
  {
    title: "6. AI and Beta Product Notice",
    iconKey: "sparkles",
    body: [
      "Rearvy is currently in beta. Features, models, integrations, and outputs may change, contain inaccuracies, or be interrupted while we improve reliability.",
      "Please independently verify critical business decisions, reports, campaigns, financial analysis, and automated actions before relying on them.",
    ],
    highlight: true,
  },
  {
    title: "7. Your Choices and Rights",
    iconKey: "slidersHorizontal",
    body: [
      "You can manage account information, connected integrations, and communication preferences in app settings where available.",
      "Depending on your location, you may request access, correction, deletion, or export of your personal information by contacting us.",
    ],
  },
  {
    title: "8. Data Deletion Instructions",
    iconKey: "trash2",
    body: [
      `You can request deletion of your Rearvy account data by emailing ${PRIVACY_CONTACT_EMAIL} with the subject line "Data Deletion Request" from your account email address.`,
      "If you connected Facebook or Instagram, you can also remove Rearvy access in your Meta settings. After receiving your request, we delete or anonymize personal data unless retention is required by law.",
    ],
  },
  {
    title: "9. Children's Privacy",
    iconKey: "shieldCheck",
    body: [
      "Rearvy is not directed to children under 13, and we do not knowingly collect personal information from children.",
    ],
  },
  {
    title: "10. Policy Updates",
    iconKey: "rotateCcw",
    body: [
      'We may update this policy from time to time. Material changes will be posted on this page with a revised "Last updated" date.',
    ],
  },
  {
    title: "11. Contact",
    iconKey: "mail",
    body: [`For privacy questions, contact us at ${PRIVACY_CONTACT_EMAIL}.`],
  },
];

function PrivacyCommandPanel() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/14 bg-white/8 p-4 shadow-[0_36px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
      <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-cyan-200/16 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 left-10 h-48 w-48 rounded-full bg-violet-300/12 blur-3xl" />
      <div className="rounded-lg border border-white/10 bg-black/50 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-200 text-black">
              <KeyRound className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Privacy control plane</p>
              <p className="text-xs text-white/55">Rearvy data handling status</p>
            </div>
          </div>
          <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-100">
            Active
          </span>
        </div>

        <div className="mt-6 grid gap-3">
          {[
            ["Personal data sales", "Off"],
            ["Deletion requests", "Supported"],
            ["Connected access", "User authorized"],
            ["Critical outputs", "Verify first"],
          ].map(([label, value]) => (
            <div key={label} className="grid min-w-0 gap-2 rounded-lg border border-white/8 bg-white/6 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4">
              <span className="min-w-0 text-xs font-semibold uppercase tracking-[0.14em] text-white/50">{label}</span>
              <span className="min-w-0 text-sm font-bold text-white">{value}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-lg border border-cyan-200/18 bg-cyan-200/8 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-100">Last updated</p>
          <p className="mt-2 text-3xl font-semibold leading-none text-white">{LAST_UPDATED}</p>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-white/10 bg-black/40">
          <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-red-300/80" />
            <span className="h-2 w-2 rounded-full bg-amber-300/80" />
            <span className="h-2 w-2 rounded-full bg-emerald-300/80" />
            <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">policy log</span>
          </div>
          <div className="space-y-2 p-3 font-mono text-[11px] leading-5 text-white/58">
            <p><span className="text-emerald-200">ok</span> / no personal data sales</p>
            <p><span className="text-sky-200">sync</span> / access follows user authorization</p>
            <p><span className="text-amber-200">note</span> / beta outputs require review</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PrivacyPolicyPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: privacyFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <RearvyPublicShell
      className="privacy-policy-page"
      eyebrow={
        <>
          <ShieldCheck className="h-3.5 w-3.5 text-cyan-200" />
          Trust Center
        </>
      }
      title={
        <>
          Privacy,
          <span className="block">made legible.</span>
        </>
      }
      description="A clearer view of how Rearvy handles account data, AI workflows, connected integrations, retention, deletion requests, and privacy questions."
      primaryCta={{ href: "/data-delete", label: "Request deletion", icon: ArrowRight }}
      secondaryCta={{ href: "/security", label: "Security" }}
      stats={[
        { value: "No", label: "Personal data sales" },
        { value: "11", label: "Policy sections" },
        { value: LAST_UPDATED, label: "Last updated" },
      ]}
      sidePanel={<PrivacyCommandPanel />}
    >
      <section className="mx-auto w-full max-w-[1180px] px-6">
        <div className="grid gap-3 rounded-xl border border-cyan-200/18 bg-cyan-200/8 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:grid-cols-2 lg:grid-cols-4">
          {trustSignals.map((signal) => (
            <article key={signal.label} className="rounded-lg border border-white/10 bg-black/24 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">{signal.label}</p>
                <span className="rounded-full border border-cyan-200/24 bg-cyan-200/10 px-2.5 py-1 text-xs font-bold text-cyan-100">
                  {signal.value}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-white/66">{signal.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <PrivacyBriefing />

      <section className="mx-auto mt-6 w-full max-w-[1180px] px-6">
        <div className="rounded-xl border border-white/12 bg-black/42 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.34)] backdrop-blur-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/80">Privacy pulse</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Trust posture at a glance
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-white/62">
              A quick readout of how Rearvy frames consent, control, and AI reliance across this policy.
            </p>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {privacyPulse.map((item) => (
              <article key={item.label} className="rounded-xl border border-white/10 bg-white/6 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/42">{item.label}</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">{item.value}</h3>
                  </div>
                  <span className="font-mono text-sm font-bold text-cyan-100">{item.meter}</span>
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-200 to-emerald-200" style={{ width: item.meter }} />
                </div>
                <p className="mt-4 text-sm leading-6 text-white/62">{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1180px] px-6">
        <div className="grid gap-3 rounded-xl border border-white/12 bg-white/7 p-3 backdrop-blur-xl lg:grid-cols-4">
          {jumpDeckGroups.map((group, groupIndex) => (
            <div key={group.label} className="rounded-lg border border-white/8 bg-black/18 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-100/72">{group.label}</p>
                <span className="font-mono text-xs text-white/32">0{groupIndex + 1}</span>
              </div>
              <div className="mt-3 grid gap-2">
                {group.items.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="group rounded-lg border border-white/8 bg-white/5 p-3 transition hover:border-cyan-200/28 hover:bg-cyan-200/8"
                  >
                    <p className="text-sm font-semibold text-white">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-white/50">{item.detail}</p>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <PrivacySectionFinder links={sectionFinderLinks} />

      <PrivacyCommandBar />

      <section id="privacy-principles" className="mx-auto mt-6 w-full max-w-[1180px] scroll-mt-28 px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {privacyPrinciples.map((principle) => {
            const Icon = principle.icon;
            return (
              <article key={principle.title} className="rounded-xl border border-white/12 bg-white/7 p-5 backdrop-blur-xl">
                <Icon className="h-5 w-5 text-cyan-200" aria-hidden />
                <h2 className="mt-4 text-lg font-semibold tracking-tight text-white">{principle.title}</h2>
                <p className="mt-3 text-sm leading-6 text-white/64">{principle.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="privacy-data-map" className="mx-auto mt-6 w-full max-w-[1180px] scroll-mt-28 px-6">
        <div className="rounded-xl border border-white/12 bg-black/42 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/80">What moves through Rearvy</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Your data map</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-white/62">
              Rearvy processes different types of information depending on which features and integrations you choose to use.
            </p>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            {dataFlow.map((item, index) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className="relative rounded-xl border border-white/10 bg-white/6 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <Icon className="h-5 w-5 text-white" aria-hidden />
                    <span className="font-mono text-xs text-white/38">0{index + 1}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-white">{item.label}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/62">{item.detail}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <PrivacyCircuit />

      <PrivacyExplorer />

      <PrivacyChoiceLab />

      <section id="privacy-operations" className="mx-auto mt-6 w-full max-w-[1180px] scroll-mt-28 px-6">
        <div className="overflow-hidden rounded-xl border border-white/12 bg-black/46 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl">
          <div className="grid gap-0 lg:grid-cols-[0.96fr_1.04fr]">
            <div className="border-b border-white/10 p-5 sm:p-7 lg:border-b-0 lg:border-r">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-black">
                  <ServerCog className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/75">
                    Operations console
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    Privacy controls in motion
                  </h2>
                </div>
              </div>

              <div className="mt-7 grid gap-3">
                {operationRows.map((row) => (
                  <div
                    key={row.label}
                    className="grid gap-3 rounded-lg border border-white/10 bg-white/6 p-4 sm:grid-cols-[1fr_auto]"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{row.label}</p>
                      <p className="mt-1 text-xs leading-5 text-white/50">
                        {row.owner} / {row.signal}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <span className="rounded-full border border-cyan-200/20 bg-cyan-200/8 px-3 py-1 text-xs font-bold text-cyan-100">
                        {row.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative overflow-hidden p-5 sm:p-7">
              <div className="pointer-events-none absolute left-1/2 top-8 h-[calc(100%-64px)] w-px bg-gradient-to-b from-transparent via-cyan-200/30 to-transparent max-lg:hidden" />
              <div className="grid gap-4 sm:grid-cols-2">
                {operationNodes.map((node, index) => {
                  const Icon = node.icon;
                  return (
                    <article
                      key={node.title}
                      className="relative rounded-xl border border-white/10 bg-white/6 p-5"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/12 bg-black/24">
                          <Icon className="h-5 w-5 text-cyan-100" aria-hidden />
                        </div>
                        <span className="font-mono text-xs text-white/34">0{index + 1}</span>
                      </div>
                      <h3 className="mt-5 text-lg font-semibold text-white">{node.title}</h3>
                      <p className="mt-3 text-sm leading-6 text-white/62">{node.copy}</p>
                    </article>
                  );
                })}
              </div>

              <div className="mt-4 rounded-xl border border-emerald-200/18 bg-emerald-200/8 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-100/75">
                  Default stance
                </p>
                <p className="mt-2 text-sm leading-6 text-white/68">
                  Rearvy treats privacy as an operating system concern: authorize narrowly, process for the requested workflow, review sensitive outputs, and support removal when the account owner asks.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="privacy-boundaries" className="mx-auto mt-6 w-full max-w-[1180px] scroll-mt-28 px-6">
        <div className="rounded-xl border border-white/12 bg-white/7 p-5 backdrop-blur-xl sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/80">Data boundaries</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                What Rearvy does and does not do
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-white/62">
              A practical boundary map for the privacy decisions that matter most.
            </p>
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
            <div className="grid border-b border-white/10 bg-white/8 text-xs font-bold uppercase tracking-[0.16em] text-white/46 md:grid-cols-[0.55fr_1fr_1fr]">
              <div className="p-4">Area</div>
              <div className="border-white/10 p-4 md:border-l">Rearvy does</div>
              <div className="border-white/10 p-4 md:border-l">Rearvy does not</div>
            </div>
            {boundaryMatrix.map((row) => (
              <article key={row.topic} className="grid border-b border-white/10 last:border-b-0 md:grid-cols-[0.55fr_1fr_1fr]">
                <div className="bg-black/18 p-4 text-sm font-semibold text-white">{row.topic}</div>
                <div className="border-white/10 p-4 text-sm leading-6 text-white/66 md:border-l">{row.does}</div>
                <div className="border-white/10 p-4 text-sm leading-6 text-white/66 md:border-l">{row.doesNot}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="privacy-myths" className="mx-auto mt-6 w-full max-w-[1180px] scroll-mt-28 px-6">
        <div className="rounded-xl border border-white/12 bg-white/7 p-5 backdrop-blur-xl sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/80">Myth check</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Privacy assumptions, corrected
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-white/62">
              Fast answers for the privacy concerns people usually bring to AI workspaces and connected tools.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {mythRealityItems.map((item) => (
              <article key={item.myth} className="overflow-hidden rounded-xl border border-white/10 bg-black/22">
                <div className="border-b border-white/10 bg-white/6 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/38">Assumption</p>
                  <h3 className="mt-2 text-lg font-semibold leading-snug text-white">{item.myth}</h3>
                </div>
                <div className="p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-100/70">Reality</p>
                  <p className="mt-2 text-sm leading-6 text-white/66">{item.reality}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="privacy-scorecard" className="mx-auto mt-6 w-full max-w-[1180px] scroll-mt-28 px-6">
        <div className="rounded-xl border border-white/12 bg-black/42 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/80">Privacy scorecard</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                What to know at a glance
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-white/62">
              A compact readout of the most important privacy posture signals on this page.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {scorecardItems.map((item) => (
              <article key={item.label} className="rounded-xl border border-white/10 bg-white/6 p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold tracking-tight text-white">{item.label}</h3>
                  <span className="rounded-full border border-cyan-200/22 bg-cyan-200/10 px-3 py-1 text-xs font-bold text-cyan-100">
                    {item.score}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-6 text-white/64">{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="privacy-audit-strip" className="mx-auto mt-6 w-full max-w-[1180px] scroll-mt-28 px-6">
        <div className="rounded-xl border border-white/12 bg-white/7 p-4 backdrop-blur-xl">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {auditSignals.map((signal) => (
              <article key={signal.label} className="rounded-lg border border-white/10 bg-black/24 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{signal.label}</p>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${signal.tone}`}>
                    {signal.state}
                  </span>
                </div>
                <p className="mt-3 text-xs leading-5 text-white/52">{signal.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="privacy-deletion-checklist" className="mx-auto mt-6 w-full max-w-[1180px] scroll-mt-28 px-6">
        <div className="rounded-xl border border-white/12 bg-white/7 p-5 backdrop-blur-xl sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/80">
                Deletion checklist
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                How to request removal
              </h2>
            </div>
            <a
              href={buildMailto(PRIVACY_CONTACT_EMAIL, "Data Deletion Request")}
              className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-white/85"
            >
              Start deletion email
            </a>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {deletionChecklist.map((item, index) => (
              <article key={item.title} className="rounded-xl border border-white/10 bg-black/22 p-5">
                <span className="font-mono text-xs font-bold text-cyan-100/70">0{index + 1}</span>
                <h3 className="mt-4 text-lg font-semibold tracking-tight text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/64">{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="privacy-retention-clock" className="mx-auto mt-6 w-full max-w-[1180px] scroll-mt-28 px-6">
        <div className="rounded-xl border border-white/12 bg-black/42 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/80">Retention clock</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                What can stay, what can go
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-white/62">
              Rearvy does not promise a fake instant purge. It separates active use, user-controlled disconnects, deletion requests, and lawful retention limits.
            </p>
          </div>

          <div className="mt-7 grid gap-4 lg:grid-cols-4">
            {retentionClock.map((item, index) => (
              <article key={item.phase} className="relative rounded-xl border border-white/10 bg-white/6 p-5">
                {index < retentionClock.length - 1 ? (
                  <div className="pointer-events-none absolute left-[calc(100%-8px)] top-9 hidden h-px w-8 bg-gradient-to-r from-cyan-200/50 to-transparent lg:block" />
                ) : null}
                <span className="font-mono text-xs font-bold text-cyan-100/70">0{index + 1}</span>
                <h3 className="mt-4 text-lg font-semibold tracking-tight text-white">{item.phase}</h3>
                <div className="mt-3 inline-flex rounded-full border border-cyan-200/20 bg-cyan-200/8 px-3 py-1 text-xs font-bold text-cyan-100">
                  {item.status}
                </div>
                <p className="mt-4 text-sm leading-6 text-white/62">{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="privacy-integrations" className="mx-auto mt-6 w-full max-w-[1180px] scroll-mt-28 px-6">
        <div className="rounded-xl border border-white/12 bg-black/42 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/80">
                Integration permissions
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Connected access stays scoped
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-white/62">
              Rearvy integrations depend on user-authorized provider permissions. These cards summarize common access and removal paths.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {integrationPermissions.map((integration) => (
              <article key={integration.name} className="rounded-xl border border-white/10 bg-white/6 p-5">
                <h3 className="text-xl font-semibold tracking-tight text-white">{integration.name}</h3>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-lg border border-white/8 bg-black/20 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/42">May access</p>
                    <p className="mt-2 text-sm leading-6 text-white/64">{integration.access}</p>
                  </div>
                  <div className="rounded-lg border border-white/8 bg-black/20 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/42">Removal path</p>
                    <p className="mt-2 text-sm leading-6 text-white/64">{integration.removal}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="privacy-timeline" className="mx-auto mt-6 w-full max-w-[1180px] scroll-mt-28 px-6">
        <div className="overflow-hidden rounded-xl border border-white/12 bg-white/7 backdrop-blur-xl">
          <div className="grid lg:grid-cols-[0.62fr_1.38fr]">
            <div className="border-b border-white/10 p-5 sm:p-7 lg:border-b-0 lg:border-r">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/75">
                Policy timeline
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Version clarity
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/64">
                Rearvy keeps the current privacy position visible and makes material updates traceable from this page.
              </p>
            </div>

            <div className="grid">
              {policyTimeline.map((item, index) => (
                <article
                  key={item.title}
                  className="grid gap-4 border-b border-white/10 p-5 last:border-b-0 sm:grid-cols-[0.36fr_1fr] sm:p-6"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-200/22 bg-cyan-200/10 font-mono text-xs font-bold text-cyan-100">
                      0{index + 1}
                    </span>
                    <p className="text-sm font-semibold text-white">{item.date}</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight text-white">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/62">{item.detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="privacy-journey" className="mx-auto mt-6 w-full max-w-[1180px] scroll-mt-28 px-6">
        <div className="rounded-xl border border-white/12 bg-black/42 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/80">Data journey</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                From permission to control
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-white/62">
              A simple view of how Rearvy turns authorized context into useful work while keeping review and removal paths visible.
            </p>
          </div>

          <div className="mt-7 grid gap-4 lg:grid-cols-4">
            {journeySteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <article key={step.title} className="relative rounded-xl border border-white/10 bg-white/6 p-5">
                  {index < journeySteps.length - 1 ? (
                    <div className="pointer-events-none absolute left-[calc(100%-8px)] top-10 hidden h-px w-8 bg-gradient-to-r from-cyan-200/50 to-transparent lg:block" />
                  ) : null}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-cyan-200/18 bg-cyan-200/10">
                      <Icon className="h-5 w-5 text-cyan-100" aria-hidden />
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.12em] text-white/46">
                      {step.label}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-white">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/62">{step.detail}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="privacy-lifecycle" className="mx-auto mt-6 w-full max-w-[1180px] scroll-mt-28 px-6">
        <div className="overflow-hidden rounded-xl border border-white/12 bg-white/7 backdrop-blur-xl">
          <div className="grid gap-0 lg:grid-cols-[0.82fr_1.18fr]">
            <div className="border-b border-white/10 p-5 sm:p-7 lg:border-b-0 lg:border-r">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/12 bg-black/28">
                <TimerReset className="h-5 w-5 text-amber-100" aria-hidden />
              </div>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-amber-100/75">Lifecycle</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">From permission to removal</h2>
              <p className="mt-3 text-sm leading-6 text-white/64">
                The policy is organized around the real product path: what you authorize, what Rearvy processes, how it is protected, and how you can remove it.
              </p>
            </div>

            <div className="grid sm:grid-cols-2">
              {lifecycleSteps.map((step, index) => (
                <article
                  key={step.title}
                  className={[
                    "border-white/10 p-5",
                    index % 2 === 1 ? "sm:border-l" : "",
                    index > 1 ? "sm:border-t" : "",
                  ].join(" ")}
                >
                  <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${step.tone}`}>
                    0{index + 1} / {step.title}
                  </div>
                  <p className="mt-4 text-sm leading-6 text-white/66">{step.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="privacy-controls" className="mx-auto mt-6 w-full max-w-[1180px] scroll-mt-28 px-6">
        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-xl border border-white/12 bg-black/40 p-5 backdrop-blur-xl sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-100/75">User controls</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">What you can do</h2>
            <div className="mt-5 grid gap-3">
              {controlItems.map((item) => (
                <div key={item} className="flex gap-3 rounded-lg border border-white/10 bg-white/6 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" aria-hidden />
                  <p className="text-sm leading-6 text-white/68">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/12 bg-white/7 p-5 backdrop-blur-xl sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-100/75">Plain-English promise</p>
            <blockquote className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
              Your workspace should feel powerful without feeling opaque.
            </blockquote>
            <p className="mt-4 text-sm leading-6 text-white/64">
              Rearvy handles data so the assistant can execute useful work, but privacy-sensitive choices stay visible: connect, disconnect, verify, request deletion, or contact us.
            </p>
          </div>
        </div>
      </section>

      <PrivacyRightsConsole items={rightsConsole} />

      <PrivacyRequestBuilder />

      <PrivacyReceiptConsole items={privacyReceipt} />

      <PrivacySnapshot lastUpdated={LAST_UPDATED} items={privacyReceipt} />

      <PrivacyGlossaryDecoder items={privacyGlossary} />

      <PrivacyFaqConsole faqs={privacyFaqs} />

      <PrivacyPolicyReader sections={sections} />

      <PrivacyHelpTerminal />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </RearvyPublicShell>
  );
}
