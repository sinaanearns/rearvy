/**
 * FLERB AI - Phase 4: Predefined Workflow Templates
 * Ready-to-use automation templates for common tasks
 */

import { Workflow } from "./types";

// ============================================================================
// Trading Monitor Workflow
// ============================================================================

export function createTradingMonitorTemplate(userId: string, config: {
  symbol: string;
  thresholdUpper?: number;
  thresholdLower?: number;
  refreshIntervalMs?: number;
}): Workflow {
  const { symbol, thresholdUpper = 50000, thresholdLower = 40000, refreshIntervalMs = 60000 } = config;

  return {
    id: `trading_monitor_${symbol}_${Date.now()}`,
    name: `Monitor ${symbol}`,
    userId,
    type: "predefined",
    state: "draft",
    steps: [
      {
        id: "step_open_dashboard",
        name: "Open Trading Dashboard",
        description: "Launch the trading dashboard in browser",
        action: {
          type: "launchApp",
          appPath: "chrome",
          args: ["https://rearvy.com/trading/monitor"],
        } as any,
        timeout: 10000,
      },
      {
        id: "step_wait_load",
        name: "Wait for Dashboard Load",
        description: "Give the dashboard 3 seconds to load",
        action: { type: "wait", ms: 3000 } as any,
        timeout: 5000,
        dependsOn: ["step_open_dashboard"],
      },
      {
        id: "step_capture_current",
        name: "Capture Current Price",
        description: "Take screenshot of current market price",
        action: { type: "screenshot", analyze: true } as any,
        timeout: 5000,
        dependsOn: ["step_wait_load"],
      },
      {
        id: "step_analyze",
        name: "Analyze Price Movement",
        description: `Check if ${symbol} is within bounds [${thresholdLower}, ${thresholdUpper}]`,
        action: { type: "screenshot" } as any,
        timeout: 5000,
        dependsOn: ["step_capture_current"],
      },
    ],
    approvalPoints: [],
    createdAt: new Date().toISOString(),
    logs: [],
    metadata: {
      symbol,
      thresholdUpper,
      thresholdLower,
      refreshInterval: refreshIntervalMs,
      type: "trading-monitor",
    },
  };
}

// ============================================================================
// Gmail Draft Workflow
// ============================================================================

export function createGmailDraftTemplate(userId: string, config: {
  to: string;
  subject: string;
  body: string;
  cc?: string[];
  attachments?: string[];
}): Workflow {
  const { to, subject, body, cc = [], attachments = [] } = config;

  return {
    id: `gmail_draft_${Date.now()}`,
    name: `Draft Email to ${to}`,
    userId,
    type: "predefined",
    state: "draft",
    steps: [
      {
        id: "step_open_gmail",
        name: "Open Gmail",
        description: "Open Gmail in a new window",
        action: {
          type: "launchApp",
          appPath: "chrome",
          args: ["https://mail.google.com"],
        } as any,
        timeout: 10000,
      },
      {
        id: "step_wait_load",
        name: "Wait for Gmail Load",
        action: { type: "wait", ms: 3000 } as any,
        timeout: 5000,
        dependsOn: ["step_open_gmail"],
      },
      {
        id: "step_click_compose",
        name: "Click Compose Button",
        description: "Click on the Compose button to start a new email",
        action: { type: "screenshot", analyze: true } as any,
        timeout: 5000,
        dependsOn: ["step_wait_load"],
      },
      {
        id: "step_fill_to",
        name: "Fill To Field",
        description: `Type recipient email: ${to}`,
        action: { type: "type", text: to } as any,
        timeout: 5000,
        dependsOn: ["step_click_compose"],
      },
      {
        id: "step_fill_subject",
        name: "Fill Subject Field",
        description: `Type subject: ${subject}`,
        action: { type: "keyPress", key: "Tab" } as any,
        timeout: 5000,
        dependsOn: ["step_fill_to"],
      },
      {
        id: "step_fill_body",
        name: "Fill Email Body",
        description: "Type email content",
        action: { type: "type", text: body, delay: 10 } as any,
        timeout: 10000,
        dependsOn: ["step_fill_subject"],
      },
      {
        id: "step_final_screenshot",
        name: "Capture Completed Draft",
        description: "Take screenshot of completed draft",
        action: { type: "screenshot", analyze: true } as any,
        timeout: 5000,
        dependsOn: ["step_fill_body"],
      },
    ],
    approvalPoints: [],
    createdAt: new Date().toISOString(),
    logs: [],
    metadata: {
      to,
      subject,
      cc,
      attachments,
      type: "gmail-draft",
    },
  };
}

// ============================================================================
// File Organization Workflow
// ============================================================================

export function createFileOrganizerTemplate(userId: string, config: {
  sourcePath: string;
  targetPath: string;
  pattern: string; // glob pattern like "*.pdf"
  action: "move" | "copy";
}): Workflow {
  const { sourcePath, targetPath, pattern, action } = config;

  return {
    id: `file_org_${Date.now()}`,
    name: `Organize ${pattern} files`,
    userId,
    type: "predefined",
    state: "draft",
    steps: [
      {
        id: "step_open_explorer",
        name: "Open File Explorer",
        description: `Open file explorer at ${sourcePath}`,
        action: {
          type: "launchApp",
          appPath: "explorer.exe",
          args: [sourcePath],
        } as any,
        timeout: 5000,
      },
      {
        id: "step_wait_load",
        name: "Wait for Explorer",
        action: { type: "wait", ms: 2000 } as any,
        timeout: 5000,
        dependsOn: ["step_open_explorer"],
      },
      {
        id: "step_select_files",
        name: `Select ${pattern} files`,
        description: `Find and select all files matching pattern: ${pattern}`,
        action: { type: "keyPress", key: "Control+h" } as any, // Show hidden files
        timeout: 5000,
        dependsOn: ["step_wait_load"],
      },
      {
        id: "step_screenshot_before",
        name: "Screenshot Before Action",
        description: "Capture state before performing file action",
        action: { type: "screenshot", analyze: true } as any,
        timeout: 5000,
        dependsOn: ["step_select_files"],
      },
    ],
    approvalPoints: [],
    createdAt: new Date().toISOString(),
    logs: [],
    metadata: {
      sourcePath,
      targetPath,
      pattern,
      action,
      type: "file-organizer",
    },
  };
}

// ============================================================================
// Daily Report Workflow
// ============================================================================

export function createDailyReportTemplate(userId: string, config: {
  reportType: "sales" | "analytics" | "trading";
  email?: string;
  format?: "pdf" | "spreadsheet" | "email";
}): Workflow {
  const { reportType, email, format = "email" } = config;

  return {
    id: `daily_report_${reportType}_${Date.now()}`,
    name: `Generate ${reportType} Report`,
    userId,
    type: "predefined",
    state: "draft",
    steps: [
      {
        id: "step_open_dashboard",
        name: "Open Analytics Dashboard",
        description: "Open the Rearvy dashboard",
        action: {
          type: "launchApp",
          appPath: "chrome",
          args: ["https://rearvy.com/analytics"],
        } as any,
        timeout: 10000,
      },
      {
        id: "step_wait_load",
        name: "Wait for Dashboard",
        action: { type: "wait", ms: 3000 } as any,
        timeout: 5000,
        dependsOn: ["step_open_dashboard"],
      },
      {
        id: "step_select_report",
        name: `Select ${reportType} Report`,
        description: `Navigate to ${reportType} report section`,
        action: { type: "screenshot", analyze: true } as any,
        timeout: 5000,
        dependsOn: ["step_wait_load"],
      },
      {
        id: "step_capture_data",
        name: "Capture Report Data",
        description: "Screenshot the report data",
        action: { type: "screenshot", analyze: true } as any,
        timeout: 5000,
        dependsOn: ["step_select_report"],
      },
      ...(email ? [{
        id: "step_export",
        name: "Export Report",
        description: `Export report in ${format} format`,
        action: { type: "keyPress", key: "Control+e" } as any,
        timeout: 5000,
        dependsOn: ["step_capture_data"],
      }] : []),
    ],
    approvalPoints: [],
    createdAt: new Date().toISOString(),
    logs: [],
    metadata: {
      reportType,
      email,
      format,
      type: "daily-report",
    },
  };
}

// ============================================================================
// Workflow Template Registry
// ============================================================================

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: "trading" | "communication" | "files" | "reporting" | "automation";
  creator: (userId: string, config: any) => Workflow;
  configSchema: {
    properties: Record<string, any>;
    required: string[];
  };
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "trading-monitor",
    name: "Trading Monitor",
    description: "Monitor crypto prices and alert on threshold breaches",
    category: "trading",
    creator: createTradingMonitorTemplate,
    configSchema: {
      properties: {
        symbol: { type: "string", description: "Trading pair (e.g., BTC/USD)" },
        thresholdUpper: { type: "number", description: "Upper price threshold" },
        thresholdLower: { type: "number", description: "Lower price threshold" },
        refreshIntervalMs: { type: "number", description: "Refresh interval in milliseconds" },
      },
      required: ["symbol"],
    },
  },
  {
    id: "gmail-draft",
    name: "Draft Gmail",
    description: "Compose a new Gmail email with specified content",
    category: "communication",
    creator: createGmailDraftTemplate,
    configSchema: {
      properties: {
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject" },
        body: { type: "string", description: "Email body content" },
        cc: { type: "array", description: "CC recipients" },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    id: "file-organizer",
    name: "Organize Files",
    description: "Automatically organize files by pattern",
    category: "files",
    creator: createFileOrganizerTemplate,
    configSchema: {
      properties: {
        sourcePath: { type: "string", description: "Source directory path" },
        targetPath: { type: "string", description: "Target directory path" },
        pattern: { type: "string", description: "File glob pattern" },
        action: { type: "string", enum: ["move", "copy"], description: "Action to perform" },
      },
      required: ["sourcePath", "targetPath", "pattern"],
    },
  },
  {
    id: "daily-report",
    name: "Generate Report",
    description: "Generate daily sales/analytics/trading report",
    category: "reporting",
    creator: createDailyReportTemplate,
    configSchema: {
      properties: {
        reportType: { type: "string", enum: ["sales", "analytics", "trading"] },
        email: { type: "string", description: "Email to send report to" },
        format: { type: "string", enum: ["pdf", "spreadsheet", "email"] },
      },
      required: ["reportType"],
    },
  },
];

/**
 * Get workflow template by ID
 */
export function getTemplate(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.id === id);
}

/**
 * Create workflow from template
 */
export function createWorkflowFromTemplate(
  templateId: string,
  userId: string,
  config: Record<string, any>
): Workflow | null {
  const template = getTemplate(templateId);
  if (!template) {
    return null;
  }

  try {
    return template.creator(userId, config);
  } catch (err) {
    console.error(`Failed to create workflow from template ${templateId}:`, err);
    return null;
  }
}

/**
 * Get all templates for a category
 */
export function getTemplatesByCategory(category: string): WorkflowTemplate[] {
  return WORKFLOW_TEMPLATES.filter((t) => t.category === category);
}
