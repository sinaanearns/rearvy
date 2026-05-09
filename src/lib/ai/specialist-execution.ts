import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { SPECIALIST_AGENTS, type SpecialistAgentId } from "./specialist-agents";

export async function runSpecialistAgent(params: {
  agentId: SpecialistAgentId;
  task: string;
  context?: string;
}) {
  const agent = SPECIALIST_AGENTS[params.agentId];
  if (!agent) {
    throw new Error(`Specialist agent ${params.agentId} not found.`);
  }

  // Require NVIDIA Integrate API for specialist agents
  const nvidiaKey = process.env.NVIDIA_API_KEY?.trim();
  if (!nvidiaKey) {
    throw new Error("No AI provider API key configured for specialist agents: set NVIDIA_API_KEY.");
  }

  const provider = createOpenAI({ apiKey: nvidiaKey, baseURL: "https://integrate.api.nvidia.com/v1" });
  const modelHandle = provider("google/gemma-4-31b-it");

  const { text } = await generateText({
    model: modelHandle,
    system: agent.systemPrompt,
    prompt: `TASK: ${params.task}\n\nCONTEXT:\n${params.context || "No additional context provided."}`,
  });

  return {
    agentId: agent.id,
    agentName: agent.name,
    output: text,
  };
}
