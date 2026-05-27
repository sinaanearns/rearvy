/**
 * FLERB AI Desktop Control - Type Definitions
 * Shared types for vision, control, and workflows
 */

// ============================================================================
// Vision & Perception Types
// ============================================================================

export interface ScreenPerception {
  screenshot: Buffer;
  timestamp: string; // ISO 8601
  textContent: string; // Raw OCR text
  uiElements: UIElement[];
  activeWindow: string;
  cursorPos: { x: number; y: number };
}

export interface UIElement {
  id: string;
  type: "button" | "text" | "input" | "dialog" | "menu" | "icon" | "window" | "other";
  text: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  clickable: boolean;
  visible: boolean;
  confidence?: number; // 0-1, how confident AI is about detection
}

export interface OCRResult {
  text: string;
  confidence: number;
  boundingBoxes: Array<{
    text: string;
    box: { x: number; y: number; width: number; height: number };
  }>;
}

// ============================================================================
// Desktop Action Types
// ============================================================================

export type DesktopAction =
  | ClickAction
  | TypeAction
  | KeyPressAction
  | MoveMouseAction
  | DragMouseAction
  | MouseDownAction
  | MouseUpAction
  | ScreenshotAction
  | LaunchAppAction
  | CloseWindowAction
  | SetClipboardAction
  | GetClipboardAction
  | WaitAction
  | ScrollAction;

export interface ClickAction {
  type: "click";
  x: number;
  y: number;
  button?: "left" | "right" | "middle";
  double?: boolean;
}

export interface TypeAction {
  type: "type";
  text: string;
  delay?: number; // ms between characters
}

export interface KeyPressAction {
  type: "keyPress";
  key: string; // "Enter", "Tab", "Escape", or combination like "Control+c"
  modifiers?: ("Control" | "Shift" | "Alt")[];
}

export interface MoveMouseAction {
  type: "moveMouse";
  x: number;
  y: number;
  duration?: number; // ms to take (smooth movement)
}

export interface DragMouseAction {
  type: "dragMouse";
  x?: number;
  y?: number;
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  button?: "left" | "right" | "middle";
  durationMs?: number;
  steps?: number;
}

export interface MouseDownAction {
  type: "mouseDown";
  button?: "left" | "right" | "middle";
}

export interface MouseUpAction {
  type: "mouseUp";
  button?: "left" | "right" | "middle";
}

export interface ScreenshotAction {
  type: "screenshot";
  analyze?: boolean; // Run OCR + UI detection
}

export interface LaunchAppAction {
  type: "launchApp";
  appPath: string; // Full path or app name
  args?: string[];
  wait?: boolean; // Wait for app to launch
}

export interface CloseWindowAction {
  type: "closeWindow";
  windowTitle?: string; // If empty, close active
  force?: boolean; // Use alt+F4
}

export interface SetClipboardAction {
  type: "setClipboard";
  text: string;
}

export interface GetClipboardAction {
  type: "getClipboard";
}

export interface WaitAction {
  type: "wait";
  ms: number;
}

export interface ScrollAction {
  type: "scroll";
  direction: "up" | "down" | "left" | "right";
  amount: number; // pixels or wheel ticks
}

export interface ActionResult {
  success: boolean;
  action: DesktopAction;
  durationMs: number;
  error?: string;
  perception?: ScreenPerception; // Captured after action
  output?: unknown; // For getClipboard, tool results, etc.
}

// ============================================================================
// Workflow Types
// ============================================================================

export interface Workflow {
  id: string;
  name: string;
  userId: string;
  type: "predefined" | "novel";
  steps: WorkflowStep[];
  state: "draft" | "pending-approval" | "running" | "paused" | "completed" | "failed" | "stopped" | "rejected";
  approvalPoints: ApprovalCheckpoint[];
  createdAt: string; // ISO 8601
  executedAt?: string;
  completedAt?: string;
  logs: ExecutionLog[];
  metadata?: Record<string, unknown>;
}

export interface WorkflowStep {
  id: string;
  name: string;
  description?: string;
  action: DesktopAction | ToolCall;
  dependsOn?: string[]; // Step IDs
  timeout?: number; // ms, default 30000
  retry?: {
    max: number;
    backoffMs: number;
  };
  expectedResult?: string; // What to look for after execution
  optional?: boolean; // Continue if fails
}

export interface ToolCall {
  type: "tool";
  toolName: string;
  params: Record<string, unknown>;
}

export interface ApprovalCheckpoint {
  stepId: string;
  reason: string;
  preview: {
    screenshot: string; // Base64
    description: string;
  };
  requiresApproval: boolean;
}

export interface ExecutionLog {
  stepId: string;
  stepName: string;
  action: string; // Serialized action
  status: "success" | "failed" | "skipped" | "pending";
  durationMs: number;
  startedAt: string; // ISO 8601
  completedAt: string;
  errorMessage?: string;
  screenshotUrl?: string; // S3/Azure path
  result?: unknown;
}

export interface WorkflowState {
  workflowId: string;
  currentStep?: string;
  completedSteps: string[];
  state: "draft" | "pending-approval" | "running" | "paused" | "completed" | "failed" | "stopped" | "rejected";
  lastAction?: {
    timestamp: string;
    result: ActionResult;
  };
  logs: ExecutionLog[];
  errorCount: number;
  startedAt?: string;
  updatedAt: string;
}

// ============================================================================
// Execution Config
// ============================================================================

export interface ExecutionConfig {
  enableApprovalMode: boolean;
  trustedWorkflows: string[]; // Workflow IDs that auto-run
  maxActionsPerHour: number;
  maxConcurrentWorkflows: number;
  screenshotRetention: number; // days
  dangerousOpsRequireApproval: boolean;
  rateLimitDelay: number; // ms between actions
}

// ============================================================================
// Desktop Session (Long-running executor)
// ============================================================================

export interface DesktopSession {
  id: string;
  userId: string;
  createdAt: string;
  lastActivity: string;
  activeWorkflow?: string;
  actionCount: number;
  isRunning: boolean;
}
