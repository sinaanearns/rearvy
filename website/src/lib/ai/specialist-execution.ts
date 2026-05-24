import { generateText } from "ai";
import { SPECIALIST_AGENTS, type SpecialistAgentId } from "./specialist-agents";
import {
  buildNoModelConfiguredMessage,
  resolveModelForChat,
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

  const routedModel = await resolveModelForChat({
    requestedProviderModel: process.env.SPECIALIST_AGENT_MODEL || "google/gemma-4-31b-it",
  });

  if (!routedModel.model) {
    return {
      agentId: agent.id,
      agentName: agent.name,
      output: buildNoModelConfiguredMessage(),
      modelRoute: routedModel.decision,
      aiUnavailable: true,
    };
  }

  const { text } = await generateText({
    model: routedModel.model,
    system: agent.systemPrompt,
    prompt: `TASK: ${params.task}\n\nCONTEXT:\n${params.context || "No additional context provided."}`,
  });

  return {
    agentId: agent.id,
    agentName: agent.name,
    output: text,
    modelRoute: routedModel.decision,
  };
}
