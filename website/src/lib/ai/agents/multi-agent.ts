import type { BusinessCapability } from "@/lib/ai/mcp/capability-graph";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("MultiAgentArchitecture");

export type AgentRole =
  | "ceo"
  | "marketing"
  | "sales"
  | "finance"
  | "operations"
  | "hr"
  | "support";

export interface AgentPersona {
  role: AgentRole;
  name: string;
  title: string;
  description: string;
  preferredCapabilities: BusinessCapability[];
  systemInstructions: string;
}

export const REARVY_AGENT_PERSONAS: Record<AgentRole, AgentPersona> = {
  ceo: {
    role: "ceo",
    name: "Executive Chief",
    title: "Chief Executive Officer Agent",
    description: "Orchestrates multi-department initiatives, business strategy, high-level planning, and cross-functional execution.",
    preferredCapabilities: ["analytics", "documents", "email", "finance", "search"],
    systemInstructions: "You are Rearvy's CEO Agent. You analyze strategic goals, break them down across departments, and ensure execution meets business KPIs.",
  },
  marketing: {
    role: "marketing",
    name: "Marketing Lead",
    title: "Chief Marketing Officer Agent",
    description: "Drives campaign generation, copywriting, image & video asset creation, social posting, and email outreach.",
    preferredCapabilities: ["image_generation", "video_editing", "social_media", "design", "email", "analytics"],
    systemInstructions: "You are Rearvy's Marketing Agent. Focus on high-converting brand campaigns, audience engagement, creative media, and email marketing.",
  },
  sales: {
    role: "sales",
    name: "Sales Director",
    title: "Head of Sales Agent",
    description: "Manages customer pipeline, lead scoring, CRM sync, deal closing, and customer communication.",
    preferredCapabilities: ["crm", "email", "calendar", "analytics", "documents"],
    systemInstructions: "You are Rearvy's Sales Agent. Target deal conversions, client follow-ups, pipeline integrity, and CRM records.",
  },
  finance: {
    role: "finance",
    name: "Finance Controller",
    title: "Chief Financial Officer Agent",
    description: "Oversees invoicing, revenue reconciliation, payment processing, budget tracking, and financial statements.",
    preferredCapabilities: ["finance", "payments", "analytics", "documents", "database"],
    systemInstructions: "You are Rearvy's Finance Agent. Ensure absolute precision with invoices, pricing models, revenue tracking, and payment processing.",
  },
  operations: {
    role: "operations",
    name: "Operations Manager",
    title: "Chief Operating Officer Agent",
    description: "Manages store inventory, logistics, web browser tasks, process automation, and system integration.",
    preferredCapabilities: ["inventory", "browser_automation", "storage", "development", "database"],
    systemInstructions: "You are Rearvy's Operations Agent. Maintain smooth logistics, inventory levels, automation scripts, and workflow stability.",
  },
  hr: {
    role: "hr",
    name: "People & Talent Lead",
    title: "Head of Human Resources Agent",
    description: "Manages employee documentation, team roles, onboarding guides, and internal policy documents.",
    preferredCapabilities: ["documents", "calendar", "email", "storage"],
    systemInstructions: "You are Rearvy's HR Agent. Maintain team clarity, role permissions, internal documentation, and onboarding workflows.",
  },
  support: {
    role: "support",
    name: "Customer Support Lead",
    title: "Head of Customer Support Agent",
    description: "Handles customer inquiries, email replies, ticket resolution, customer satisfaction, and feedback loops.",
    preferredCapabilities: ["email", "crm", "documents", "browser_automation"],
    systemInstructions: "You are Rearvy's Support Agent. Deliver prompt, helpful customer communication and issue resolution.",
  },
};

export function selectAgentForPrompt(prompt: string): AgentPersona {
  const p = prompt.toLowerCase();

  if (/campaign|marketing|brand|ad|visual|poster|banner|video|social|post|instagram/i.test(p)) {
    return REARVY_AGENT_PERSONAS.marketing;
  }
  if (/lead|deal|crm|client|sales|prospect|pipeline/i.test(p)) {
    return REARVY_AGENT_PERSONAS.sales;
  }
  if (/invoice|financial|revenue|budget|payment|tax|accounting|charge/i.test(p)) {
    return REARVY_AGENT_PERSONAS.finance;
  }
  if (/inventory|stock|warehouse|shipping|sku|automation|browser|scrape/i.test(p)) {
    return REARVY_AGENT_PERSONAS.operations;
  }
  if (/onboard|employee|team|hr|policy|hiring/i.test(p)) {
    return REARVY_AGENT_PERSONAS.hr;
  }
  if (/support|ticket|help|inquiry|customer email|complaint/i.test(p)) {
    return REARVY_AGENT_PERSONAS.support;
  }

  // Default to CEO for multi-domain orchestration
  return REARVY_AGENT_PERSONAS.ceo;
}
