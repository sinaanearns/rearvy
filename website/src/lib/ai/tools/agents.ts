import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "@/lib/ai/types";
import { runSpecialistAgent } from "../specialist-execution";
import { SPECIALIST_AGENTS, type SpecialistAgentId } from "../specialist-agents";

export function delegateToSpecialistAgent(ctx: ToolContext) {
  void ctx;
  return tool({
    description: "Delegate a complex task to a specialized AI agent (e.g., backend-architect, frontend-developer, security-auditor). Use this when the user request requires deep domain expertise or multi-step reasoning in a specific field.",
    inputSchema: z.object({
      agentId: z.enum(Object.keys(SPECIALIST_AGENTS) as [SpecialistAgentId, ...SpecialistAgentId[]])
        .describe("The ID of the specialized agent to call."),
      task: z.string().describe("The specific task or question for the specialist agent."),
      context: z.string().optional().describe("Additional context from the current conversation or codebase that the specialist needs."),
    }),
    execute: async ({ agentId, task, context }) => {
      try {
        const result = await runSpecialistAgent({ agentId, task, context });
        return {
          ok: true,
          agentName: result.agentName,
          output: result.output,
        };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : "Delegation failed.",
        };
      }
    },
  });
}

export function spawnAgentTeam(ctx: ToolContext) {
  void ctx;
  return tool({
    description: "Spawn a multi-agent team to solve a large, multi-dimensional problem (e.g., building a full feature, performing a security audit, or debugging complex issues).",
    inputSchema: z.object({
      teamName: z.string().describe("A descriptive name for the team."),
      preset: z.enum(["fullstack", "review", "security", "debug", "research"])
        .describe("The team configuration preset to use."),
      objective: z.string().describe("The main objective for the team."),
    }),
    execute: async ({ teamName, preset, objective }) => {
      // In this implementation, we'll simulate a team by calling multiple specialists in parallel
      // and summarizing their findings.
      
      const presets: Record<string, SpecialistAgentId[]> = {
        fullstack: ["backend-architect", "frontend-developer", "test-automator"],
        review: ["code-reviewer", "security-auditor", "performance-engineer"],
        security: ["security-auditor", "backend-architect"],
        debug: ["code-reviewer", "typescript-pro"],
        research: ["docs-architect", "ai-engineer"],
      };

      const members = presets[preset] || [];
      if (members.length === 0) {
        return { ok: false, message: `Invalid preset: ${preset}` };
      }

      try {
        const results = await Promise.all(
          members.map(agentId => 
            runSpecialistAgent({ 
              agentId, 
              task: `As part of the ${teamName} team, your objective is: ${objective}. Provide your expert analysis and recommendations based on this goal.`,
            })
          )
        );

        return {
          ok: true,
          teamName,
          preset,
          contributions: results.map(r => ({
            agentName: r.agentName,
            output: r.output,
          })),
        };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : "Team execution failed.",
        };
      }
    },
  });
}
