# FLERB AI - End-to-End Testing Guide

**Status:** Ready for verification  
**Date:** May 11, 2026  
**Coverage:** All 6 phases + integration

---

## ✅ Pre-Flight Checklist

Before running tests, verify:

- [ ] Dependencies installed in website/ and desktop-app/
- [ ] `.env.local` has `ANTHROPIC_API_KEY` set
- [ ] `.env.local` has `FIREBASE_PROJECT_ID` set
- [ ] Firestore security rules deployed (use `firebase deploy --only firestore:rules`)
- [ ] TypeScript files compile without errors

---

## 🧪 Phase 1: Vision & Control (Desktop Automation)

### Test 1.1: Screenshot Capture
```bash
# Start desktop app
npm run dev:desktop

# In browser DevTools console:
window.electron.automation.runTest()
```

**Expected Output:**
- ExecutionMonitor shows "Running workflow"
- 3 steps execute: screenshot → wait 2s → screenshot
- Status changes to "Completed"
- No errors in console

**Troubleshooting:**
- If screenshot fails: Check screenshot-desktop package installed
- If no DevTools: Open DevTools with F12 in Electron window

### Test 1.2: Desktop Actions

```javascript
// In DevTools console, test individual actions
window.electron.automation.startWorkflow({
  id: "test_actions",
  name: "Test Actions",
  userId: "test-user",
  type: "predefined",
  steps: [
    {
      id: "step_1",
      name: "Click",
      action: { type: "click", x: 500, y: 300 },
      timeout: 5000,
    },
    {
      id: "step_2",
      name: "Type",
      action: { type: "type", text: "Hello World" },
      timeout: 5000,
      dependsOn: ["step_1"],
    }
  ],
  approvalPoints: [],
  logs: []
});
```

**Expected:**
- Mouse clicks at coordinates
- Text types into focused input
- No crashes or errors

---

## 🚀 Phase 2: Execution Runtime

### Test 2.1: Rate Limiting

```typescript
// In backend test, simulate multiple actions
import { ExecutionRuntime } from "@/lib/ai/desktop-control";

const runtime = new ExecutionRuntime(firestoreClient);

// Check rate limit
const allowed = await runtime.checkRateLimit("test-user");
console.log("Rate limit allowed:", allowed.allowed);
console.log("Actions used:", allowed.actionsUsed);
```

**Expected:**
- Returns `{ allowed: true, actionsUsed: <number>, actionsRemaining: <number> }`
- After 100 actions in 1 hour, returns `{ allowed: false }`

### Test 2.2: Dangerous Operations Detection

```typescript
// Test dangerous op detection
const isValid = await runtime.validateAction("test-user", "deleteFile", {
  filePath: "/important/file.txt"
});

console.log("Validation result:", isValid);
// Expected: { valid: false, reason: "Requires approval", riskLevel: "critical" }
```

**Expected:**
- Returns `valid: false` for dangerous operations
- Triggers approval request

### Test 2.3: Approval Dialog

```javascript
// In React component or browser
// Should see ApprovalDialog component appear when:
// 1. Dangerous operation attempted
// 2. Novel workflow created via AI

// Approve the action
// Dialog should disappear and workflow should execute
```

**Expected:**
- Dialog shows reason for approval
- Displays screenshot preview
- Approve button executes action
- Reject button cancels action

---

## 📋 Phase 4: Predefined Workflows

### Test 4.1: Trading Monitor Template

```typescript
import { createTradingMonitorTemplate } from "@/lib/ai/desktop-control";

const workflow = createTradingMonitorTemplate("test-user", {
  symbol: "BTC/USD",
  thresholdLower: 40000,
  thresholdUpper: 50000,
});

console.log("Workflow created:", workflow.name);
console.log("Steps:", workflow.steps.length);
// Expected: 4 steps
```

**Expected:**
- Workflow has 4 steps
- Steps have correct names and actions
- State is "draft"

### Test 4.2: Gmail Draft Template

```typescript
import { createGmailDraftTemplate } from "@/lib/ai/desktop-control";

const workflow = createGmailDraftTemplate("test-user", {
  to: "test@example.com",
  subject: "Test Email",
  body: "Hello from FLERB AI!",
});

console.log("Gmail workflow created:", workflow.name);
console.log("Steps:", workflow.steps.length);
// Expected: 7 steps
```

**Expected:**
- 7 steps for compose → fill → send flow
- All steps properly configured

### Test 4.3: List Templates

```typescript
import { WORKFLOW_TEMPLATES, getTemplatesByCategory } from "@/lib/ai/desktop-control";

console.log("Total templates:", WORKFLOW_TEMPLATES.length);
console.log("Trading templates:", getTemplatesByCategory("trading").length);
// Expected: 4 total, 1 trading
```

**Expected:**
- 4 templates registered
- Filtering by category works
- Each template has configSchema

---

## 🤖 Phase 5: AI Workflow Planning

### Test 5.1: Generate Plan from Description

```typescript
import { WorkflowPlanner, validateWorkflowPlan } from "@/lib/ai/desktop-control";

const planner = new WorkflowPlanner(process.env.ANTHROPIC_API_KEY);
const plan = await planner.planWorkflow(
  "test-user",
  "Open Notepad and type hello world"
);

console.log("Plan generated:", plan.name);
console.log("Steps:", plan.steps.length);
console.log("Confidence:", plan.confidence);

const validation = validateWorkflowPlan(plan);
console.log("Valid:", validation.valid);
```

**Expected:**
- Plan name reflects description
- 2-4 steps generated
- Confidence between 0.7-1.0
- Validation passes

### Test 5.2: Detect Dangerous Operations

```typescript
const plan = await planner.planWorkflow(
  "test-user",
  "Delete all files in Downloads folder"
);

console.log("Requires approval:", plan.requiresApproval);
// Expected: true
```

**Expected:**
- `requiresApproval` is true for dangerous operations
- Validation warnings include dangerous op notice

### Test 5.3: Detect Circular Dependencies

```typescript
// Create plan with circular deps (should be rare)
const invalidPlan = {
  steps: [
    { id: "s1", dependsOn: ["s2"] },
    { id: "s2", dependsOn: ["s1"] },
  ]
};

const validation = validateWorkflowPlan(invalidPlan);
console.log("Has cycle error:", validation.errors.some(e => e.includes("cycle")));
// Expected: true
```

**Expected:**
- Cycle detection returns error

---

## 💾 Phase 6: Firestore Persistence

### Test 6.1: Save Workflow

```typescript
import { firestoreAdapter } from "@/lib/firebase";
import { createTradingMonitorTemplate } from "@/lib/ai/desktop-control";

const workflow = createTradingMonitorTemplate("test-user", {
  symbol: "BTC/USD"
});

await firestoreAdapter.saveWorkflow("test-user", workflow);

// Retrieve
const retrieved = await firestoreAdapter.getWorkflow("test-user", workflow.id);
console.log("Retrieved workflow:", retrieved?.name);
// Expected: "Monitor BTC/USD"
```

**Expected:**
- Workflow saved without error
- Retrieved workflow matches saved data

### Test 6.2: Save Execution Logs

```typescript
const log = {
  stepId: "step_1",
  stepName: "Screenshot",
  action: { type: "screenshot" },
  status: "success",
  durationMs: 250,
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
};

await firestoreAdapter.saveExecutionLog("test-user", workflow.id, log);

// Retrieve history
const history = await firestoreAdapter.getExecutionHistory("test-user");
console.log("Logs saved:", history.length > 0);
// Expected: true
```

**Expected:**
- Logs save without error
- Can retrieve via getExecutionHistory

### Test 6.3: Audit Logging

```typescript
import { auditLogger } from "@/lib/firebase";

await auditLogger.log({
  userId: "test-user",
  eventType: "workflow_executed",
  workflowId: workflow.id,
  details: { steps: 4, status: "success" },
});

// Retrieve audit trail
const trail = await auditLogger.getUserAuditTrail("test-user");
console.log("Audit events:", trail.length);
// Expected: > 0
```

**Expected:**
- Audit logs persist
- Retrievable via getUserAuditTrail

### Test 6.4: Compliance Export

```typescript
const csv = await firestoreAdapter.exportExecutionLogs("test-user", {
  format: "csv"
});

console.log("CSV export length:", csv.length);
console.log("Has headers:", csv.includes("Timestamp"));
// Expected: true
```

**Expected:**
- Export generates CSV format
- Includes headers and data rows

---

## 🔗 Chat API Integration

### Test 7.1: List Templates Tool

Make a chat request:
```json
{
  "messages": [
    {
      "role": "user",
      "content": "What workflow templates are available?"
    }
  ]
}
```

**Expected:**
- Chat response mentions available templates
- `listWorkflowTemplates` tool is called
- Returns 4 templates

### Test 7.2: Execute Workflow Tool

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Execute the trading monitor for Bitcoin"
    }
  ]
}
```

**Expected:**
- Chat recognizes intent
- Calls `executeWorkflow` tool
- Returns workflow queued message
- Desktop app receives workflow via IPC

### Test 7.3: Plan Workflow Tool

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Create a workflow to open Excel and create a sales report"
    }
  ]
}
```

**Expected:**
- Calls `planWorkflow` tool
- Claude generates plan via WorkflowPlanner
- Returns plan with steps and confidence
- Desktop app shows ApprovalDialog

---

## 📊 Integration Test Checklist

- [ ] Dependencies installed and no build errors
- [ ] Electron IPC bridge working (can call window.electron.automation.*)
- [ ] Phase 1: Screenshot capture and OCR working
- [ ] Phase 2: Approvals and rate limiting enforced
- [ ] Phase 4: All 4 templates instantiate correctly
- [ ] Phase 5: AI planner generates valid workflows
- [ ] Phase 6: Firestore saves and retrieves data
- [ ] Chat API tools available in tool registry
- [ ] Chat can trigger automation via tools
- [ ] Desktop app receives workflows via IPC
- [ ] ExecutionMonitor updates in real-time
- [ ] Firestore security rules allow user access
- [ ] Audit logs persist for compliance

---

## 🚀 Performance Benchmarks

Expected timings:

| Operation | Expected Time |
|-----------|---------------|
| Screenshot capture | 200-500ms |
| OCR text extraction | 500-1000ms |
| UI element detection | 1-3s |
| Single action (click/type) | 50-200ms |
| Workflow creation from template | 100-300ms |
| AI workflow planning | 3-10s |
| Firestore write | 100-500ms |

---

## 🐛 Debugging Tips

### Check Electron IPC
```javascript
// DevTools console
window.electron.automation.onStateChange((state) => {
  console.log("[IPC] State update:", state);
});
```

### Check Claude Vision
```typescript
const perception = await capturePerception(analyzeUI = true, apiKey);
console.log("UI Elements:", perception.uiElements);
```

### Check Firestore
```javascript
// In browser console
fetch("/api/automation?action=get_history&workflowId=test")
  .then(r => r.json())
  .then(d => console.log("Firestore data:", d));
```

### Check IPC Handler
```javascript
// In Electron main process
ipcMain.handle("desktop:automation:test", async () => {
  console.log("[IPC Handler] Test called");
  return { success: true };
});
```

---

## ✅ Final Verification

After running all tests, verify:

1. **No console errors**: Check both web and Electron console
2. **Firestore data**: Check Firebase console for saved workflows
3. **Audit trail**: Query audit_logs collection
4. **IPC communication**: Check Electron DevTools for IPC messages
5. **Performance**: Verify operations complete within expected times
6. **Security**: Verify only user's own data is accessible

---

## 📞 Support

If tests fail:

1. Check `.env.local` has all required keys
2. Verify Firestore rules deployed: `firebase deploy --only firestore:rules`
3. Check Firestore security rules in Firebase console
4. Review browser console for errors
5. Check Electron main process logs
6. Verify network connectivity to Firebase

---

**All Tests Ready! 🎉**

Run tests sequentially and verify each phase before moving to the next.
