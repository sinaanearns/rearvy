import type { WorkAgent } from "@/lib/firebase/schema";

export type AutomatonAgentScore = {
  agentId: string;
  name: string;
  score: number;
  qualityStatus: "healthy" | "watch" | "low_score" | "archived";
  lowScoreStreak: number;
  archived: boolean;
  reason: string;
};

export type AgentActivity = {
  successfulRunsLast14: number;
  failedRunsLast14: number;
  activeAutomationRefs: number;
  activeTeamRefs: number;
};

type AgentScoreInput = Pick<
  WorkAgent,
  | "id"
  | "name"
  | "source"
  | "built_in_key"
  | "is_active"
  | "performance_score"
  | "low_score_streak"
> & {
  updated_at?: unknown;
};

function timestampToMillis(value: unknown) {
  if (!value) return 0;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object") {
    const maybe = value as { toDate?: () => Date; toMillis?: () => number };
    if (typeof maybe.toMillis === "function") {
      const millis = maybe.toMillis();
      return Number.isFinite(millis) ? millis : 0;
    }
    if (typeof maybe.toDate === "function") {
      const millis = maybe.toDate().getTime();
      return Number.isFinite(millis) ? millis : 0;
    }
  }
  return 0;
}

function clampScore(value: number) {
  return Math.min(Math.max(Math.round(value), 1), 5);
}

export function scoreWorkAgents(params: {
  agents: AgentScoreInput[];
  activityByAgentId: Map<string, AgentActivity>;
}): AutomatonAgentScore[] {
  return params.agents
    .filter((agent) => agent.is_active)
    .filter((agent) => agent.source === "custom")
    .map((agent) => {
      const activity = params.activityByAgentId.get(agent.id) ?? {
        successfulRunsLast14: 0,
        failedRunsLast14: 0,
        activeAutomationRefs: 0,
        activeTeamRefs: 0,
      };
      const isReferenced = activity.activeAutomationRefs > 0 || activity.activeTeamRefs > 0;
      const ageDays = Math.floor((Date.now() - timestampToMillis(agent.updated_at)) / 86_400_000);
      let score = 3;

      if (activity.successfulRunsLast14 > 0) score += 2;
      if (activity.failedRunsLast14 > 0) score -= 1;
      if (activity.successfulRunsLast14 === 0) score -= 1;
      if (isReferenced) score += 1;
      if (Number.isFinite(ageDays) && ageDays <= 30) score += 1;

      const finalScore = clampScore(score);
      const lowScoreStreak =
        finalScore <= 2 ? Math.max(0, Number(agent.low_score_streak || 0)) + 1 : 0;
      const archived =
        finalScore <= 2 &&
        lowScoreStreak >= 3 &&
        activity.successfulRunsLast14 === 0 &&
        !isReferenced;
      const qualityStatus = archived
        ? "archived"
        : finalScore >= 4
          ? "healthy"
          : finalScore === 3
            ? "watch"
            : "low_score";
      const reason = archived
        ? "Archived after repeated low usefulness and no recent successful runs."
        : finalScore <= 2
          ? "Low usefulness: no recent successful runs and weak activity."
          : finalScore === 3
            ? "Watch: needs stronger run evidence."
            : "Healthy: useful recent activity or active references.";

      return {
        agentId: agent.id,
        name: agent.name,
        score: finalScore,
        qualityStatus,
        lowScoreStreak,
        archived,
        reason,
      };
    });
}
