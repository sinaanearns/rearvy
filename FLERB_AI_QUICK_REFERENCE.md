# FLERB AI - Developer Quick Reference

Quick lookup guide for using FLERB AI components in your code.

---

## 📚 Component Reference

### Vision Layer

```typescript
import {
  capturePerception,
  detectUIElements,
  performOCR,
  findElementByText,
  findNearestClickable,
} from "@/lib/ai/desktop-control";

// Capture everything: screenshot + OCR + UI detection
const perception = await capturePerception(
  analyzeUI = true,  // Run Claude Vision?
  claudeApiKey      // Claude API key
);
// Returns: { screenshot, textContent, uiElements, activeWindow, cursorPos }

// Extract text from image
const ocr = await performOCR(imageBuffer);
// Returns: { text, confidence, boundingBoxes }

// Detect clickable UI elements
const elements = await detectUIElements(imageBuffer, claudeApiKey);
// Returns: UIElement[] with { type, text, position, clickable }

// Find element by text
const button = findElementByText(elements, "Click me");
// Returns: UIElement | undefined

// Find nearest element to coordinates
const element = findNearestClickable(elements, 500, 300, maxDistance = 50);
// Returns: UIElement | undefined
```

### Control Layer

```typescript
import {
  executeAction,
  executeActionSequence,
  performClick,
  performType,
  performKeyPress,
  launchApp,
  setClipboard,
  getClipboard,
} from "@/lib/ai/desktop-control";

// Execute single action and capture perception after
const result = await executeAction(
  {
    type: "click",
    x: 100,
    y: 200,
    button: "left",
  },
  claudeApiKey
);
// Returns: { success, action, durationMs, error?, perception?, output? }

// Execute sequence of actions (100ms delays between)
await executeActionSequence([
  { type: "click", x: 100, y: 200 },
  { type: "type", text: "hello" },
  { type: "keyPress", key: "Enter" },
]);

// Individual action functions
await performClick(x, y, button = "left", double = false);
await performType(text, delay = 50); // delay between chars
await performKeyPress("Control+c"); // Key combos
await launchApp("notepad.exe", args = [], wait = true);
await setClipboard("Copy me!");
const text = await getClipboard();
```

### Workflow Engine

```typescript
import {
  WorkflowExecutor,
  createSimpleWorkflow,
  createTradingMonitorWorkflow,
} from "@/lib/ai/desktop-control";

// Create workflow
const workflow = {
  id: "wf_123",
  name: "My Workflow",
  userId: "user_123",
  type: "predefined",
  steps: [
    {
      id: "step_1",
      name: "Screenshot",
      action: { type: "screenshot" },
      timeout: 5000,
      dependsOn: [],
    },
    {
      id: "step_2",
      name: "Type",
      action: { type: "type", text: "hello" },
      timeout: 5000,
      dependsOn: ["step_1"],
    },
  ],
  approvalPoints: [],
  logs: [],
};

// Execute workflow with DAG engine
const executor = new WorkflowExecutor(workflow, claudeApiKey);
executor.setStateChangeCallback((state) => {
  console.log("State updated:", state);
});
await executor.start();

// Control execution
await executor.pause();
await executor.resume();
await executor.stop();

// Get state
const state = executor.getState();
// Returns: { workflowId, currentStep, completedSteps, state, logs }
```

### Execution Runtime

```typescript
import {
  ExecutionRuntime,
  ApprovalDialog,
  ExecutionMonitor,
} from "@/lib/ai/desktop-control";

// Create runtime (manages state, approvals, guardrails)
const runtime = new ExecutionRuntime(firestoreClient);

// Check if action allowed
const validation = await runtime.validateAction(userId, "deleteFile", {
  filePath: "/path/to/file",
});
// Returns: { valid, reason?, riskLevel }

// Request approval
await runtime.requestApproval(
  workflowId,
  stepId,
  "Delete important file?",
  screenshotBuffer
);

// Get pending approvals
const pending = runtime.getPendingApprovals(workflowId);

// Handle approval
await runtime.approveStep(workflowId, stepId);
await runtime.rejectStep(workflowId, stepId, "Dangerous!");

// Check rate limit
const allowed = await runtime.checkRateLimit(userId);
// Returns: { allowed, actionsUsed, actionsRemaining, resetTime }
```

### Predefined Templates

```typescript
import {
  createTradingMonitorTemplate,
  createGmailDraftTemplate,
  createFileOrganizerTemplate,
  createDailyReportTemplate,
  WORKFLOW_TEMPLATES,
  createWorkflowFromTemplate,
  getTemplatesByCategory,
} from "@/lib/ai/desktop-control";

// Create from template
const workflow = createTradingMonitorTemplate(userId, {
  symbol: "BTC/USD",
  thresholdLower: 40000,
  thresholdUpper: 50000,
});

// Factory function
const workflow = createWorkflowFromTemplate(
  "trading-monitor",
  userId,
  { symbol: "ETH/USD" }
);

// List templates
WORKFLOW_TEMPLATES.forEach((t) => {
  console.log(t.name, t.category);
});

// Filter by category
const tradingTemplates = getTemplatesByCategory("trading");

// Get specific template
const template = getTemplate("gmail-draft");
```

### Workflow Planner (AI)

```typescript
import {
  WorkflowPlanner,
  validateWorkflowPlan,
} from "@/lib/ai/desktop-control";

// Create planner
const planner = new WorkflowPlanner(anthropicApiKey);

// Generate plan from description
const plan = await planner.planWorkflow(
  userId,
  "Open Excel and create a sales report"
);
// Returns: { workflowId, name, steps, reasoning, confidence, requiresApproval }

// Validate plan
const validation = validateWorkflowPlan(plan);
// Returns: { valid, errors[], warnings[] }

if (validation.valid) {
  // Use plan
  const workflow = { ...plan, type: "novel" };
}
```

### Firestore Persistence

```typescript
import {
  FirestoreAdapter,
  AuditLogger,
} from "@/lib/ai/desktop-control";

// Adapter for workflows
const adapter = new FirestoreAdapter(db);

// Save workflow
await adapter.saveWorkflow(userId, workflow);

// Get workflow
const workflow = await adapter.getWorkflow(userId, workflowId);

// List workflows
const workflows = await adapter.listWorkflows(userId, {
  type: "predefined",
  limit: 10,
});

// Save execution state
await adapter.saveExecutionState(userId, state);

// Get execution history
const logs = await adapter.getExecutionHistory(userId, workflowId);

// Mark as trusted
await adapter.trustWorkflow(userId, workflowId);

// Export for compliance
const csv = await adapter.exportExecutionLogs(userId, { format: "csv" });

// Cleanup old logs
const deleted = await adapter.cleanupOldLogs(userId, retentionDays = 30);

// Audit logger
const auditLogger = new AuditLogger(db);

// Log event
await auditLogger.log({
  userId,
  eventType: "workflow_executed",
  workflowId,
  details: { status: "success" },
});

// Get audit trail
const trail = await auditLogger.getUserAuditTrail(userId);
```

### React Hook

```typescript
import { useDesktopExecutor } from "@/lib/ai/desktop-control";

// In component
const {
  currentState,      // WorkflowState | null
  isRunning,         // boolean
  history,           // WorkflowState[]
  error,             // string | null
  isElectron,        // boolean
  startWorkflow,     // (workflow) => Promise<void>
  getState,          // () => WorkflowState | null
  pause,             // () => Promise<void>
  resume,            // () => Promise<void>
  stop,              // () => Promise<void>
  getHistory,        // (workflowId?) => WorkflowState[]
  runTest,           // () => Promise<void>
} = useDesktopExecutor();

// Use in JSX
useEffect(() => {
  if (currentState?.state === "completed") {
    console.log("Workflow done!");
  }
}, [currentState]);
```

---

## 📋 Common Tasks

### Task: Execute a predefined workflow

```typescript
// Import template
import { createTradingMonitorTemplate } from "@/lib/ai/desktop-control";

// Create workflow
const workflow = createTradingMonitorTemplate(userId, {
  symbol: "BTC/USD",
  thresholdLower: 40000,
  thresholdUpper: 50000,
});

// Check if trusted
const isTrusted = await firestoreAdapter.isWorkflowTrusted(userId, workflow.id);

// Execute
if (isTrusted) {
  // Auto-execute in background
  await executor.startWorkflow(workflow);
} else {
  // Show approval dialog first
  const approved = await showApprovalDialog(workflow);
  if (approved) {
    await executor.startWorkflow(workflow);
    await firestoreAdapter.trustWorkflow(userId, workflow.id);
  }
}
```

### Task: Create custom workflow from AI

```typescript
// Import planner
import { WorkflowPlanner, validateWorkflowPlan } from "@/lib/ai/desktop-control";

// Create planner and plan
const planner = new WorkflowPlanner(process.env.ANTHROPIC_API_KEY);
const plan = await planner.planWorkflow(userId, userDescription);

// Validate
const validation = validateWorkflowPlan(plan);
if (!validation.valid) {
  console.error("Invalid plan:", validation.errors);
  return;
}

// Show approval with screenshot preview
const approved = await showApprovalDialog({
  name: plan.name,
  steps: plan.steps,
  screenshot: perception.screenshot,
});

if (approved) {
  // Create as novel workflow
  const workflow = {
    ...plan,
    type: "novel",
    state: "executing",
  };

  // Execute
  await executor.startWorkflow(workflow);
}
```

### Task: Handle execution monitoring

```typescript
// In React component
const {
  currentState,
  isRunning,
  error,
  pause,
  resume,
  stop,
} = useDesktopExecutor();

// Listen for state changes
useEffect(() => {
  const unsubscribe = window.electron?.automation?.onStateChange?.((state) => {
    console.log("State:", state);
  });

  return () => unsubscribe?.();
}, []);

// Show progress
if (isRunning) {
  const progress = (
    (currentState?.completedSteps || 0) /
    (currentState?.state?.totalSteps || 1)
  ) * 100;

  return (
    <div>
      <ProgressBar value={progress} />
      <button onClick={() => pause()}>Pause</button>
      <button onClick={() => resume()}>Resume</button>
      <button onClick={() => stop()}>Stop</button>
    </div>
  );
}

if (error) {
  return <ErrorBanner message={error} />;
}
```

### Task: Save and audit workflow execution

```typescript
// Import adapters
import { firestoreAdapter, auditLogger } from "@/lib/firebase";

// Save workflow
await firestoreAdapter.saveWorkflow(userId, workflow);

// On execution complete, save state
const state = executor.getState();
await firestoreAdapter.saveExecutionState(userId, state);

// Save individual logs
state.logs.forEach(async (log) => {
  await firestoreAdapter.saveExecutionLog(userId, workflow.id, log);
});

// Log audit event
await auditLogger.log({
  userId,
  eventType: "workflow_executed",
  workflowId: workflow.id,
  details: {
    name: workflow.name,
    type: workflow.type,
    steps: workflow.steps.length,
    status: state.state,
    duration: Date.now() - workflow.startedAt,
  },
});

// Export for compliance
const csv = await firestoreAdapter.exportExecutionLogs(userId, {
  startDate: new Date("2026-05-01"),
  endDate: new Date("2026-05-31"),
  format: "csv",
});

// Download
downloadFile(csv, "audit_report.csv");
```

---

## 🔍 Type Reference

### Core Types

```typescript
interface ScreenPerception {
  screenshot: Buffer;
  textContent: string;
  uiElements: UIElement[];
  activeWindow: string;
  cursorPos: { x: number; y: number };
}

type DesktopAction =
  | { type: "click"; x: number; y: number; button?: "left" | "right" | "middle"; double?: boolean }
  | { type: "type"; text: string; delay?: number }
  | { type: "keyPress"; key: string; modifiers?: string[] }
  | { type: "moveMouse"; x: number; y: number; duration?: number }
  | { type: "screenshot"; analyze?: boolean }
  | { type: "launchApp"; appPath: string; args?: string[]; wait?: boolean }
  | { type: "closeWindow"; windowTitle: string; force?: boolean }
  | { type: "setClipboard"; text: string }
  | { type: "wait"; ms: number }
  | { type: "scroll"; direction: "up" | "down" | "left" | "right"; amount: number };

interface Workflow {
  id: string;
  name: string;
  userId: string;
  type: "predefined" | "novel";
  state: "draft" | "executing" | "completed" | "paused" | "failed";
  steps: WorkflowStep[];
  approvalPoints: ApprovalCheckpoint[];
  logs: ExecutionLog[];
  metadata?: Record<string, unknown>;
}

interface WorkflowStep {
  id: string;
  name: string;
  description?: string;
  action: DesktopAction;
  dependsOn?: string[];
  timeout: number;
  retry?: { max: number; backoffMs: number };
  optional?: boolean;
  expectedResult?: string;
}

interface WorkflowState {
  workflowId: string;
  currentStep: string;
  completedSteps: string[];
  state: "draft" | "running" | "paused" | "completed" | "failed";
  lastAction?: DesktopAction;
  logs: ExecutionLog[];
  errorCount: number;
  startedAt: string;
  updatedAt: string;
}

interface ExecutionLog {
  stepId: string;
  stepName: string;
  action: DesktopAction;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  durationMs: number;
  startedAt: string;
  completedAt: string;
  errorMessage?: string;
  screenshotUrl?: string;
}
```

---

## 🐛 Debugging

### Check Electron IPC

```javascript
// DevTools console in desktop app
window.electron.automation.onStateChange((state) => {
  console.log("[IPC]", state);
});

// Trigger action
window.electron.automation.runTest();
```

### Check OCR

```javascript
// Get OCR text from screenshot
const perception = await capturePerception(analyzeUI = false);
console.log(perception.textContent);
```

### Check Claude Vision

```javascript
// See UI detection
const perception = await capturePerception(analyzeUI = true, apiKey);
console.log(perception.uiElements);
```

### Check Firestore

```javascript
// Browser console
const logs = await fetch(`/api/automation?action=get_history&workflowId=wf_123`);
console.log(await logs.json());
```

---

## 🚨 Error Handling

```typescript
try {
  const plan = await planner.planWorkflow(userId, description);
  const validation = validateWorkflowPlan(plan);

  if (!validation.valid) {
    console.error("Plan validation failed:", validation.errors);
    return null;
  }

  await executor.startWorkflow(plan);
} catch (error) {
  if (error instanceof RangeError) {
    console.error("Invalid coordinates:", error.message);
  } else if (error instanceof TypeError) {
    console.error("Type mismatch:", error.message);
  } else {
    console.error("Unknown error:", error);
  }

  // Log to audit trail
  await auditLogger.log({
    userId,
    eventType: "error",
    workflowId: workflow?.id || "unknown",
    details: { error: error.message },
  });
}
```

---

## 📞 API Reference

Full API documentation available in:
- [types.ts](./types.ts) - Type definitions
- [vision.ts](./vision.ts) - Perception APIs
- [control.ts](./control.ts) - Action APIs
- [workflow.ts](./workflow.ts) - Execution APIs
- [execution-runtime.ts](./execution-runtime.ts) - Runtime APIs
- [workflow-planner.ts](./workflow-planner.ts) - Planning APIs
- [firestore-persistence.ts](./firestore-persistence.ts) - Storage APIs
