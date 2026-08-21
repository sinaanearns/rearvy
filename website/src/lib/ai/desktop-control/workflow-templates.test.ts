import assert from "node:assert/strict";
import { test } from "node:test";

import { createTradingMonitorWorkflow } from "./workflow";
import {
  createWorkflowFromTemplate,
  createDailyReportTemplate,
  createFileOrganizerTemplate,
  createGmailDraftTemplate,
  createTradingMonitorTemplate,
} from "./workflow-templates";
import type { Workflow } from "./types";

function getLaunchUrl(workflow: Workflow) {
  const launchStep = workflow.steps.find((step) =>
    Array.isArray((step.action as { args?: unknown }).args)
  );
  const args = (launchStep?.action as { args?: unknown } | undefined)?.args;
  assert.equal(Array.isArray(args), true);
  const [url] = args as string[];
  return url;
}

test("trading monitor workflows open the live trading route", () => {
  assert.equal(
    getLaunchUrl(createTradingMonitorWorkflow("user-1", "BTC-USD")),
    "https://www.rearvy.com/trading/ai-trader"
  );

  assert.equal(
    getLaunchUrl(createTradingMonitorTemplate("user-1", { symbol: "BTC-USD" })),
    "https://www.rearvy.com/trading/ai-trader"
  );
});

test("daily report workflow opens the live insights route", () => {
  assert.equal(
    getLaunchUrl(createDailyReportTemplate("user-1", { reportType: "analytics" })),
    "https://www.rearvy.com/insights"
  );
});

test("communication and file templates produce executable desktop actions", () => {
  const gmail = createGmailDraftTemplate("user-1", {
    to: "team@example.com",
    subject: "Daily update",
    body: "Done for today.",
  });
  const organizer = createFileOrganizerTemplate("user-1", {
    sourcePath: "C:\\Users\\Public\\Downloads",
    targetPath: "C:\\Users\\Public\\Documents",
    pattern: "*.pdf",
    action: "move",
  });

  assert.deepEqual(
    gmail.steps.map((step) => step.action.type),
    ["launchApp", "wait", "screenshot", "type", "keyPress", "type", "screenshot"]
  );
  assert.deepEqual(
    organizer.steps.map((step) => step.action.type),
    ["launchApp", "wait", "keyPress", "screenshot"]
  );
});

test("template registry validates generic config before workflow creation", (t) => {
  t.mock.method(console, "error", () => {});

  const workflow = createWorkflowFromTemplate("gmail-draft", "user-1", {
    to: "team@example.com",
    subject: "Daily update",
    body: "Done for today.",
  });
  assert.notEqual(workflow, null);
  assert.equal(workflow?.name, "Draft Email to team@example.com");

  assert.equal(createWorkflowFromTemplate("gmail-draft", "user-1", { to: "team@example.com" }), null);
});
