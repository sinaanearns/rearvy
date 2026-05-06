import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import type { OperationsCapability } from "../operations-intent";

type OperationsCapabilityConfig = {
  title: string;
  summary: string;
  useWhen: string;
  requiredInputs: string[];
  nextSteps: string[];
  guardrails: string[];
  suggestedTools: string[];
};

const OperationsCapabilityInputSchema = z.object({
  feature: z
    .enum(["automation", "assets", "meetings", "investor", "morning_brief"])
    .describe("The internal operations capability to use for this chat request."),
  request: z.string().describe("The user's latest request or job description."),
  userProvidedContext: z
    .string()
    .optional()
    .describe("Any relevant source text, transcript, constraints, links, or files already provided by the user."),
});

const OPERATIONS_CAPABILITIES: Record<
  OperationsCapability,
  OperationsCapabilityConfig
> = {
  automation: {
    title: "Browser and Python work",
    summary:
      "Run structured execution from chat with approvals, evidence, and replayable steps.",
    useWhen:
      "Use for browser tasks, scripted workflows, and work that should produce an auditable run log.",
    requiredInputs: [
      "Goal",
      "Target site, file, or workflow",
      "Login or approval constraints",
      "What success should look like",
    ],
    nextSteps: [
      "Restate the job and guardrails.",
      "Ask for any missing access or constraints.",
      "Use the browser or scripting tool only after the job is clear.",
      "Return the result and evidence in this chat.",
    ],
    guardrails: [
      "Do not run irreversible actions without explicit approval.",
      "Keep credentials and private keys out of chat.",
      "Prefer a dry run or plan first when the blast radius is unclear.",
    ],
    suggestedTools: ["runBrowserTask", "controlBrowserSession"],
  },
  assets: {
    title: "Campaign and board-ready output",
    summary:
      "Create assets, variants, previews, or deck-ready content from the chat context.",
    useWhen:
      "Use when the user needs creative variants, campaign output, deck pages, or publishable previews tied to source inputs.",
    requiredInputs: [
      "Audience",
      "Offer or message",
      "Format and dimensions",
      "Brand constraints",
      "Source material or examples",
    ],
    nextSteps: [
      "Confirm the output format and audience.",
      "Draft the first version in chat.",
      "Keep lineage to source inputs visible.",
      "Ask for approval before finalizing publishable output.",
    ],
    guardrails: [
      "Do not invent performance claims.",
      "Keep brand-sensitive language consistent with supplied examples.",
      "Flag missing legal, pricing, or product claims before final output.",
    ],
    suggestedTools: ["searchWeb", "fetchWebPage"],
  },
  meetings: {
    title: "Transcript to commitment flow",
    summary:
      "Turn meeting notes into commitments, owners, follow-ups, risks, and confidence scores.",
    useWhen:
      "Use when conversation notes should become structured action tracking instead of another long summary.",
    requiredInputs: [
      "Transcript or notes",
      "Participants if known",
      "Desired output format",
      "Deadline or owner rules",
    ],
    nextSteps: [
      "Extract decisions, commitments, owners, and due dates.",
      "Separate explicit commitments from inferred follow-ups.",
      "Call out unresolved risks and ambiguous ownership.",
      "Return the action list inside this chat.",
    ],
    guardrails: [
      "Do not assign owners that are not supported by the notes.",
      "Mark uncertain items clearly.",
      "Keep sensitive meeting content in the current chat context.",
    ],
    suggestedTools: ["saveMemory"],
  },
  investor: {
    title: "Update and board packet drafting",
    summary:
      "Prepare investor updates, board packets, and founder-facing operating notes from chat context.",
    useWhen:
      "Use for investor updates, board packets, fundraising context, and executive operating summaries.",
    requiredInputs: [
      "Reporting period",
      "Metrics or source data",
      "Audience",
      "Asks, risks, and decisions needed",
    ],
    nextSteps: [
      "Create the narrative spine.",
      "Separate facts, asks, risks, and decisions.",
      "Use connected data tools when metrics are requested.",
      "Return a draft that can be reviewed in chat.",
    ],
    guardrails: [
      "Do not fabricate metrics.",
      "Label assumptions and missing data.",
      "Keep confidential board context inside the conversation.",
    ],
    suggestedTools: [
      "getRevenue",
      "getOrders",
      "comparePerformance",
      "getGoogleAnalyticsOverview",
    ],
  },
  morning_brief: {
    title: "Overnight review at a glance",
    summary:
      "Produce a concise morning digest with changes, actions, risks, and KPI deltas.",
    useWhen:
      "Use for a concise daily or overnight review before the user starts work.",
    requiredInputs: [
      "Time window",
      "Business area or project",
      "Connected data sources to include",
      "Priority risks or KPIs",
    ],
    nextSteps: [
      "Check the relevant connected data before reporting metrics.",
      "Group output into changes, risks, and recommended actions.",
      "Keep the brief short and decision-oriented.",
      "Ask for missing data sources only when needed.",
    ],
    guardrails: [
      "Do not guess overnight metrics.",
      "Distinguish confirmed data from missing integrations.",
      "Keep the digest in chat instead of sending users to a page.",
    ],
    suggestedTools: [
      "getRecentInsights",
      "getRevenue",
      "getOrders",
      "getGoogleAnalyticsOverview",
    ],
  },
};

export function selectOperationsCapability(ctx: ToolContext) {
  void ctx;

  return tool({
    description:
      "Select and prepare a chat-only Rearvy operations capability. Use only when the user asks for automation, assets/deck output, meeting transcript follow-up, investor/board work, or a morning brief. This is internal to chat and must not route the user to a separate operations page.",
    inputSchema: OperationsCapabilityInputSchema,
    execute: async ({ feature, request, userProvidedContext }) => {
      const capability = OPERATIONS_CAPABILITIES[feature];

      return {
        ok: true,
        feature,
        title: capability.title,
        access: "chat_only",
        userFacingPage: false,
        request,
        summary: capability.summary,
        useWhen: capability.useWhen,
        requiredInputs: capability.requiredInputs,
        nextSteps: capability.nextSteps,
        guardrails: capability.guardrails,
        suggestedTools: capability.suggestedTools,
        hasUserContext: Boolean(userProvidedContext?.trim()),
        instruction:
          "Continue in the current chat. Ask for missing inputs or call the relevant data/action tool only when needed.",
      };
    },
  });
}
