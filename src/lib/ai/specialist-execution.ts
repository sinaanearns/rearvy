import { generateText } from "ai";
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

  // Force use of NVIDIA Integrate API via the provided key
  const { createOpenAI } = await import("@ai-sdk/openai");
  const nvidiaProvider = createOpenAI({
    apiKey: process.env.NVIDIA_API_KEY,
    baseURL: "https://integrate.api.nvidia.com/v1",
  });

  const { text } = await generateText({
    model: nvidiaProvider("google/gemma-4-31b-it"), // Default model for specialists
    system: agent.systemPrompt,
    prompt: `TASK: ${params.task}\n\nCONTEXT:\n${params.context || "No additional context provided."}`,
  });

  return {
    agentId: agent.id,
    agentName: agent.name,
    output: text,
  };
}
