# FLERB AI - Integration Guide

This guide shows how to integrate the complete FLERB AI system into existing Rearvy components.

---

## 🔗 Chat API Integration

### File: `website/src/app/api/chat/route.ts`

Add FLERB AI tools to your chat tool registry:

```typescript
import {
  WorkflowPlanner,
  createWorkflowFromTemplate,
  WORKFLOW_TEMPLATES,
  validateWorkflowPlan,
} from "@/lib/ai/desktop-control";

// Inside your tool definitions (add to existing tools array):
const automationTools = [
  {
    name: "execute_predefined_workflow",
    description:
      "Execute a predefined automation workflow (e.g., trading monitor, email, file organization). User must approve.",
    input_schema: {
      type: "object" as const,
      properties: {
        templateId: {
          type: "string",
          enum: WORKFLOW_TEMPLATES.map((t) => t.id),
          description: "ID of the predefined template",
        },
        config: {
          type: "object",
          description: "Configuration parameters for the template",
        },
      },
      required: ["templateId", "config"],
    },
  },
  {
    name: "plan_custom_workflow",
    description:
      "Generate a custom automation workflow from a natural language description. Requires user approval.",
    input_schema: {
      type: "object" as const,
      properties: {
        description: {
          type: "string",
          description:
            "What you want to automate (e.g., 'Open Excel and create a sales report')",
        },
      },
      required: ["description"],
    },
  },
  {
    name: "list_workflow_templates",
    description: "List available predefined workflow templates",
    input_schema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          enum: ["trading", "communication", "files", "reporting", "automation"],
          description: "Filter by category (optional)",
        },
      },
    },
  },
  {
    name: "get_workflow_status",
    description: "Check the status of a currently running workflow",
    input_schema: {
      type: "object" as const,
      properties: {
        workflowId: {
          type: "string",
          description: "ID of the workflow to check",
        },
      },
      required: ["workflowId"],
    },
  },
];

// In your tool processor (where you handle tool calls):
if (toolName === "execute_predefined_workflow") {
  const { templateId, config } = toolInput;

  // Create workflow from template
  const workflow = createWorkflowFromTemplate(
    templateId,
    userId,
    config
  );

  if (!workflow) {
    return {
      type: "tool_result",
      tool_use_id: toolUseId,
      content: `Error: Template '${templateId}' not found`,
      is_error: true,
    };
  }

  // Only isDesktopApp can execute desktop workflows
  if (!isDesktopApp) {
    return {
      type: "tool_result",
      tool_use_id: toolUseId,
      content:
        "Desktop workflows require the Electron app. Please use the desktop app to execute this workflow.",
      is_error: true,
    };
  }

  // Send to desktop via IPC or API
  const response = await sendToDesktopApp("execute_workflow", {
    workflow,
    userId,
  });

  return {
    type: "tool_result",
    tool_use_id: toolUseId,
    content: JSON.stringify({
      workflowId: workflow.id,
      name: workflow.name,
      status: "executing",
      message: `Starting workflow: ${workflow.name}. Check the desktop app for approval prompts.`,
      steps: workflow.steps.length,
    }),
  };
}

if (toolName === "plan_custom_workflow") {
  const { description } = toolInput;

  try {
    const planner = new WorkflowPlanner(process.env.ANTHROPIC_API_KEY!);
    const plan = await planner.planWorkflow(userId, description);

    // Validate the plan
    const validation = validateWorkflowPlan(plan);

    if (!validation.valid) {
      return {
        type: "tool_result",
        tool_use_id: toolUseId,
        content: `Could not create workflow. Errors: ${validation.errors.join(", ")}`,
        is_error: true,
      };
    }

    // Send plan to desktop for approval
    if (!isDesktopApp) {
      return {
        type: "tool_result",
        tool_use_id: toolUseId,
        content:
          "Workflow planning requires the Electron app. Please use the desktop app.",
        is_error: true,
      };
    }

    const response = await sendToDesktopApp("request_workflow_approval", {
      plan,
      userId,
    });

    return {
      type: "tool_result",
      tool_use_id: toolUseId,
      content: JSON.stringify({
        workflowId: plan.workflowId,
        name: plan.name,
        steps: plan.steps.length,
        confidence: plan.confidence,
        status: "pending_approval",
        message: "Workflow plan generated! Check the desktop app for approval prompt.",
        warnings: validation.warnings,
      }),
    };
  } catch (error) {
    return {
      type: "tool_result",
      tool_use_id: toolUseId,
      content: `Workflow planning failed: ${error instanceof Error ? error.message : String(error)}`,
      is_error: true,
    };
  }
}

if (toolName === "list_workflow_templates") {
  const { category } = toolInput;

  const templates = category
    ? WORKFLOW_TEMPLATES.filter((t) => t.category === category)
    : WORKFLOW_TEMPLATES;

  return {
    type: "tool_result",
    tool_use_id: toolUseId,
    content: JSON.stringify(
      templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        configSchema: t.configSchema,
      }))
    ),
  };
}

if (toolName === "get_workflow_status") {
  const { workflowId } = toolInput;

  const response = await sendToDesktopApp("get_workflow_status", {
    workflowId,
    userId,
  });

  return {
    type: "tool_result",
    tool_use_id: toolUseId,
    content: JSON.stringify(response),
  };
}
```

---

## 🖥️ Electron Integration

### File: `desktop-app/main.cjs`

Already updated with automation initialization. Verify these are present:

```javascript
const { setupAutomationIPC, initializeAutomation, cleanupAutomation } = require("./automation-integration.cjs");

// In mainWindow.webContents.once("did-finish-load"):
setupAutomationIPC(ipcMain);
initializeAutomation(mainWindow, userId, process.env.ANTHROPIC_API_KEY || "");

// In app.on("before-quit"):
cleanupAutomation();
```

### File: `desktop-app/preload.cjs`

Already updated with automation bridge. Verify this is present:

```javascript
window.electron = {
  // ... existing code ...
  automation: {
    startWorkflow: (workflow) => ipcRenderer.invoke("desktop:automation:start-workflow", workflow),
    getState: () => ipcRenderer.invoke("desktop:automation:get-state"),
    pause: () => ipcRenderer.invoke("desktop:automation:pause"),
    resume: () => ipcRenderer.invoke("desktop:automation:resume"),
    stop: () => ipcRenderer.invoke("desktop:automation:stop"),
    getHistory: (workflowId) => ipcRenderer.invoke("desktop:automation:get-history", workflowId),
    runTest: () => ipcRenderer.invoke("desktop:automation:test"),
    onStateChange: (callback) => ipcRenderer.on("desktop:automation:state-change", (_, data) => callback(data)),
    onPaused: (callback) => ipcRenderer.on("desktop:automation:paused", callback),
    onResumed: (callback) => ipcRenderer.on("desktop:automation:resumed", callback),
    onStopped: (callback) => ipcRenderer.on("desktop:automation:stopped", callback),
  },
};
```

---

## 🗄️ Firestore Integration

### File: `website/src/lib/firebase.ts`

Add FLERB AI persistence:

```typescript
import {
  FirestoreAdapter,
  AuditLogger,
} from "@/lib/ai/desktop-control";
import { db } from "@/lib/firebase"; // Your existing Firestore instance

// Create singleton instances
export const firestoreAdapter = new FirestoreAdapter(db);
export const auditLogger = new AuditLogger(db);

// Export for use throughout app
export async function saveWorkflowExecution(
  userId: string,
  workflow: any,
  state: any
) {
  try {
    await firestoreAdapter.saveWorkflow(userId, workflow);
    await firestoreAdapter.saveExecutionState(userId, state);
    await auditLogger.log({
      userId,
      eventType: "workflow_executed",
      workflowId: workflow.id,
      details: {
        name: workflow.name,
        steps: workflow.steps.length,
        type: workflow.type,
      },
    });
  } catch (error) {
    console.error("Failed to save workflow:", error);
  }
}

export async function getWorkflowHistory(
  userId: string,
  workflowId?: string
) {
  return firestoreAdapter.getExecutionHistory(userId, workflowId);
}

export async function exportAuditLogs(
  userId: string,
  format: "json" | "csv" = "json"
) {
  return firestoreAdapter.exportExecutionLogs(userId, { format });
}
```

---

## ⚛️ React Component Integration

### File: `website/src/components/chat/AutomationPanel.tsx`

New component to display FLERB AI controls:

```typescript
"use client";

import React from "react";
import {
  WorkflowStatusPanel,
  ExecutionHistory,
  WorkflowPlannerUI,
} from "@/lib/ai/desktop-control";
import { useDesktopExecutor } from "@/lib/ai/desktop-control/useDesktopExecutor";

export function AutomationPanel() {
  const {
    currentState,
    isRunning,
    history,
    error,
    isElectron,
    startWorkflow,
    pause,
    resume,
    stop,
  } = useDesktopExecutor();

  if (!isElectron) {
    return (
      <div className="p-4 bg-slate-900 rounded border border-slate-700 text-slate-400 text-sm">
        Desktop automation is only available in the Electron app.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Workflow Status Panel */}
      <WorkflowStatusPanel />

      {/* Workflow Planning */}
      <WorkflowPlannerUI
        onPlanCreated={(plan) => {
          console.log("New plan:", plan);
          // Plan would be sent to desktop for approval
        }}
      />

      {/* Execution History */}
      <div className="bg-slate-900 rounded border border-slate-700 p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Recent Executions</h3>
        <ExecutionHistory logs={history.slice(0, 10)} />
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-900 text-red-300 rounded text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
```

### File: `website/src/app/dashboard/page.tsx`

Add automation panel to dashboard:

```typescript
import { AutomationPanel } from "@/components/chat/AutomationPanel";

export default function DashboardPage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Existing dashboard content */}
      <div className="lg:col-span-2">
        {/* Your existing dashboard */}
      </div>

      {/* FLERB AI Automation */}
      <div className="lg:col-span-1">
        <AutomationPanel />
      </div>
    </div>
  );
}
```

---

## 📱 Chat UI Integration

### File: `website/src/components/chat/ChatInterface.tsx`

Add automation status to chat:

```typescript
import { useDesktopExecutor } from "@/lib/ai/desktop-control/useDesktopExecutor";

export function ChatInterface() {
  const { currentState, isRunning, error, isElectron } = useDesktopExecutor();

  return (
    <div className="flex flex-col h-full">
      {/* Existing chat content */}

      {/* Automation Status Bar (if running) */}
      {isElectron && isRunning && (
        <div className="bg-blue-900 border-t border-blue-700 p-3 text-sm text-blue-200 flex items-center gap-2">
          <div className="animate-pulse">●</div>
          <span>
            Running workflow: {currentState?.workflowId}
            {currentState && ` (${currentState.completedSteps}/${currentState.state.totalSteps})`}
          </span>
        </div>
      )}

      {/* Error Status */}
      {error && (
        <div className="bg-red-900 border-t border-red-700 p-3 text-sm text-red-200">
          Automation error: {error}
        </div>
      )}
    </div>
  );
}
```

---

## 🔄 API Route for Desktop Communication

### File: `website/src/app/api/automation/route.ts`

New API for desktop app communication:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { firestoreAdapter, auditLogger } from "@/lib/firebase";
import {
  createWorkflowFromTemplate,
  validateWorkflowPlan,
} from "@/lib/ai/desktop-control";

export async function POST(request: NextRequest) {
  try {
    const auth = getAuth();
    if (!auth.currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = auth.currentUser.uid;
    const { action, payload } = await request.json();

    switch (action) {
      case "save_execution": {
        // Save workflow execution to Firestore
        const { workflow, state } = payload;
        await firestoreAdapter.saveWorkflow(userId, workflow);
        await firestoreAdapter.saveExecutionState(userId, state);
        return NextResponse.json({ success: true });
      }

      case "save_log": {
        // Save execution log
        const { workflowId, log } = payload;
        await firestoreAdapter.saveExecutionLog(userId, workflowId, log);
        return NextResponse.json({ success: true });
      }

      case "trust_workflow": {
        // Mark workflow as trusted
        const { workflowId } = payload;
        await firestoreAdapter.trustWorkflow(userId, workflowId);
        return NextResponse.json({ success: true });
      }

      case "get_history": {
        // Get execution history
        const { workflowId, limit } = payload;
        const logs = await firestoreAdapter.getExecutionHistory(
          userId,
          workflowId,
          limit
        );
        return NextResponse.json(logs);
      }

      case "log_audit": {
        // Log audit event
        const { eventType, details } = payload;
        await auditLogger.log({
          userId,
          eventType,
          workflowId: details.workflowId,
          details,
        });
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: "Unknown action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Automation API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
```

---

## 🔐 Firestore Security Rules

### File: `firestore.rules`

Add these rules for FLERB AI collections:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Existing rules...

    // User workflows
    match /users/{userId}/workflows/{document=**} {
      allow read, write: if request.auth.uid == userId;
    }

    // Execution state
    match /users/{userId}/execution_state/{document=**} {
      allow read, write: if request.auth.uid == userId;
    }

    // Execution logs
    match /users/{userId}/execution_logs/{document=**} {
      allow read, write: if request.auth.uid == userId;
    }

    // Trusted workflows
    match /users/{userId}/trusted_workflows/{document=**} {
      allow read, write: if request.auth.uid == userId;
    }

    // Approval records
    match /users/{userId}/execution_approvals/{document=**} {
      allow read, write: if request.auth.uid == userId;
    }

    match /users/{userId}/execution_rejections/{document=**} {
      allow read, write: if request.auth.uid == userId;
    }

    // Audit logs (admin read-only for compliance)
    match /audit_logs/{document=**} {
      allow write: if request.auth != null;
      allow read: if request.auth != null && request.auth.token.admin == true;
    }
  }
}
```

---

## 🚀 Deployment Checklist

- [ ] Install all npm dependencies (website + desktop-app)
- [ ] Set `ANTHROPIC_API_KEY` in `.env.local` and deployment secrets
- [ ] Update Firestore rules with above security rules
- [ ] Test desktop automation with `npm run dev:desktop`
- [ ] Test chat API automation tools
- [ ] Verify IPC communication in Electron DevTools
- [ ] Test workflow templates (trading, email, file, report)
- [ ] Test custom workflow planning
- [ ] Verify Firestore persistence
- [ ] Test compliance export
- [ ] Deploy website and desktop app
- [ ] Monitor audit logs for issues

---

## 🧪 Quick Test Scripts

### Test Desktop Automation

```javascript
// In desktop app DevTools console
window.electron.automation.runTest();
// Should show: Workflow executing...
// Steps: screenshot → wait 2s → screenshot
// Check React component for real-time updates
```

### Test Template Workflow

```javascript
// In web app console
fetch("/api/chat", {
  method: "POST",
  body: JSON.stringify({
    messages: [
      {
        role: "user",
        content: "Execute the trading monitor template for BTC/USD",
      },
    ],
  }),
});
```

### Test Custom Workflow Planning

```javascript
// In web app console
fetch("/api/chat", {
  method: "POST",
  body: JSON.stringify({
    messages: [
      {
        role: "user",
        content: "Create a workflow to open Notepad and type 'Hello World'",
      },
    ],
  }),
});
```

---

## 📞 Support

For issues with:
- **Desktop automation**: Check `desktop-app/automation-integration.cjs`
- **Workflow planning**: Verify `ANTHROPIC_API_KEY` is set
- **Firestore**: Check security rules and user UID
- **IPC communication**: Use Electron DevTools -> Process menu
- **React components**: Check browser console for errors

See `FLERB_AI_COMPLETE.md` for detailed architecture and troubleshooting.
