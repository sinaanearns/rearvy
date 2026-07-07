import assert from "node:assert/strict";
import test from "node:test";
import { executeStep } from "./step-executor";
import type { OrchestratorStep } from "./types";
import type { ToolContext } from "@/lib/ai/types";
import type { Firestore } from "firebase-admin/firestore";

// Simple stub for tests
const mockDb = {} as Firestore;

test("executeStep rejects unsupported step type", async () => {
  const invalidStep: OrchestratorStep = {
    id: "step_1",
    name: "Bad Step",
    description: "Unsupported type",
    type: "non_existent_capability_type" as any,
    input: {},
    dependencies: [],
    status: "pending",
    requiresApproval: false,
  };

  const context: ToolContext = {
    userId: "test-user-id",
    adminDb: mockDb,
  };

  const result = await executeStep(invalidStep, context);
  assert.equal(result.ok, false);
  assert.match(result.error || "", /Unsupported step type/);
});
