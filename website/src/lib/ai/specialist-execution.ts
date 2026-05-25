import { SPECIALIST_AGENTS, type SpecialistAgentId } from "./specialist-agents";
import {
  aiCompletionService,
  buildNoModelConfiguredMessage,
  sanitizeModelRouteForClient,
} from "@/lib/ai/model-router";

export async function runSpecialistAgent(params: {
  agentId: SpecialistAgentId;
  task: string;
  context?: string;
}) {
  const agent = SPECIALIST_AGENTS[params.agentId];
  if (!agent) {
    throw new Error(`Specialist agent ${params.agentId} not found.`);
  }

  const result = await aiCompletionService.generateText({
    task: "deep_business_reasoning",
    requestedProviderModel: process.env.SPECIALIST_AGENT_MODEL || "google/gemma-4-31b-it",
    system: agent.systemPrompt,
    prompt: `TASK: ${params.task}\n\nCONTEXT:\n${params.context || "No additional context provided."}`,
    timeoutMs: 30_000,
  });

  if (result.aiUnavailable) {
    return {
      agentId: agent.id,
      agentName: agent.name,
      output: buildNoModelConfiguredMessage(),
      modelRoute: sanitizeModelRouteForClient(result.modelRoute),
      aiUnavailable: true,
    };
  }

  return {
    agentId: agent.id,
    agentName: agent.name,
    output: result.text,
    modelRoute: sanitizeModelRouteForClient(result.modelRoute),
  };
}
