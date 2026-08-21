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
  | ClickElementAction
  | TypeIntoElementAction
  | SetElementValueAction
  | SelectOptionAction
  | SetToggleStateAction
  | WaitForElementAction
  | TypeAction
  | KeyPressAction
  | MoveMouseAction
  | DragMouseAction
  | MouseDownAction
  | MouseUpAction
  | ScreenshotAction
  | LaunchAppAction
  | OpenPathAction
  | RevealPathAction
  | ReadFileAction
  | ReadVisibleTextAction
  | GetElementStateAction
  | GetElementValueAction
  | InvokeElementAction
  | ListWindowsAction
  | ListUiElementsAction
  | FocusWindowAction
  | SetWindowStateAction
  | CloseWindowAction
  | ListDirectoryAction
  | CreateDirectoryAction
  | CopyPathAction
  | MovePathAction
  | TrashPathAction
  | WriteFileAction
  | AppendToFileAction
  | ReplaceInFileAction
  | ShellCommandAction
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

export interface ClickElementAction {
  type: "clickElement";
  text: string;
  controlType?: string;
  matchMode?: "contains" | "exact";
  button?: "left" | "right" | "middle";
  double?: boolean;
  timeoutMs?: number;
}

export interface TypeIntoElementAction {
  type: "typeIntoElement";
  text?: string;
  label?: string;
  target?: string;
  value?: string;
  textToType?: string;
  input?: string;
  content?: string;
  controlType?: string;
  clear?: boolean;
}

export interface SetElementValueAction {
  type: "setElementValue";
  text?: string;
  label?: string;
  target?: string;
  value?: string;
  textToSet?: string;
  input?: string;
  content?: string;
  controlType?: string;
  matchMode?: "contains" | "exact";
  timeoutMs?: number;
}

export interface SelectOptionAction {
  type: "selectOption";
  option?: string;
  value?: string;
  optionText?: string;
  selection?: string;
  text?: string;
  label?: string;
  target?: string;
  controlType?: string;
  optionControlType?: string;
  matchMode?: "contains" | "exact";
}

export interface SetToggleStateAction {
  type: "setToggleState";
  text?: string;
  label?: string;
  target?: string;
  state?: "checked" | "unchecked" | "toggle";
  checked?: boolean;
  value?: string | boolean;
  controlType?: string;
  matchMode?: "contains" | "exact";
}

export interface WaitForElementAction {
  type: "waitForElement";
  text?: string;
  label?: string;
  target?: string;
  controlType?: string;
  matchMode?: "contains" | "exact";
  timeoutMs?: number;
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

export interface OpenPathAction {
  type: "openPath";
  target?: string;
  path?: string;
  url?: string;
  appPath?: string;
  wait?: boolean;
}

export interface RevealPathAction {
  type: "revealPath";
  target?: string;
  path?: string;
  filePath?: string;
}

export interface ReadFileAction {
  type: "readFile";
  filePath?: string;
  path?: string;
  target?: string;
}

export interface ReadVisibleTextAction {
  type: "readVisibleText";
  maxTextItems?: number;
  maxElements?: number;
  maxItems?: number;
}

export interface GetElementStateAction {
  type: "getElementState";
  text?: string;
  label?: string;
  target?: string;
  controlType?: string;
  matchMode?: "contains" | "exact";
  timeoutMs?: number;
}

export interface GetElementValueAction {
  type: "getElementValue";
  text?: string;
  label?: string;
  target?: string;
  controlType?: string;
  matchMode?: "contains" | "exact";
  timeoutMs?: number;
}

export interface InvokeElementAction {
  type: "invokeElement";
  text?: string;
  label?: string;
  target?: string;
  controlType?: string;
  matchMode?: "contains" | "exact";
  timeoutMs?: number;
}

export interface CloseWindowAction {
  type: "closeWindow";
  windowTitle?: string; // If empty, close active
  force?: boolean; // Use alt+F4
}

export interface FocusWindowAction {
  type: "focusWindow";
  windowTitle?: string;
  title?: string;
  name?: string;
  target?: string;
  timeoutMs?: number;
}

export interface ListWindowsAction {
  type: "listWindows";
}

export interface ListUiElementsAction {
  type: "listUiElements";
  controlType?: string;
  maxElements?: number;
  maxItems?: number;
  maxEntries?: number;
}

export interface SetWindowStateAction {
  type: "setWindowState";
  state?: "minimize" | "maximize" | "restore";
  windowState?: "minimize" | "maximize" | "restore";
  windowTitle?: string;
  title?: string;
  name?: string;
  target?: string;
  timeoutMs?: number;
}

export interface ListDirectoryAction {
  type: "listDirectory";
  path?: string;
  directoryPath?: string;
  target?: string;
  maxEntries?: number;
}

export interface CreateDirectoryAction {
  type: "createDirectory";
  path?: string;
  directoryPath?: string;
  target?: string;
  reveal?: boolean;
  revealAfterCreate?: boolean;
  open?: boolean;
  openAfterCreate?: boolean;
}

export interface CopyPathAction {
  type: "copyPath";
  sourcePath?: string;
  destinationPath?: string;
  fromPath?: string;
  toPath?: string;
  path?: string;
  target?: string;
  overwrite?: boolean;
  force?: boolean;
  reveal?: boolean;
  revealAfterCopy?: boolean;
  open?: boolean;
  openAfterCopy?: boolean;
}

export interface MovePathAction {
  type: "movePath";
  sourcePath?: string;
  destinationPath?: string;
  fromPath?: string;
  toPath?: string;
  path?: string;
  target?: string;
  reveal?: boolean;
  revealAfterMove?: boolean;
  open?: boolean;
  openAfterMove?: boolean;
}

export interface TrashPathAction {
  type: "trashPath";
  path?: string;
  filePath?: string;
  directoryPath?: string;
  target?: string;
  sourcePath?: string;
  fromPath?: string;
}

export interface WriteFileAction {
  type: "writeFile";
  filePath?: string;
  path?: string;
  target?: string;
  content?: string;
  backup?: boolean;
  reveal?: boolean;
  revealAfterWrite?: boolean;
  open?: boolean;
  openAfterWrite?: boolean;
}

export interface AppendToFileAction {
  type: "appendToFile";
  filePath?: string;
  path?: string;
  target?: string;
  content?: string;
  text?: string;
  append?: string;
  value?: string;
  newline?: boolean;
  appendNewline?: boolean;
  backup?: boolean;
  reveal?: boolean;
  revealAfterAppend?: boolean;
  revealAfterWrite?: boolean;
  open?: boolean;
  openAfterAppend?: boolean;
  openAfterWrite?: boolean;
}

export interface ReplaceInFileAction {
  type: "replaceInFile";
  filePath?: string;
  path?: string;
  target?: string;
  search?: string;
  find?: string;
  oldText?: string;
  fromText?: string;
  replacement?: string;
  replaceWith?: string;
  newText?: string;
  toText?: string;
  all?: boolean;
  replaceAll?: boolean;
  backup?: boolean;
  reveal?: boolean;
  revealAfterReplace?: boolean;
  revealAfterWrite?: boolean;
  open?: boolean;
  openAfterReplace?: boolean;
  openAfterWrite?: boolean;
}

export interface ShellCommandAction {
  type: "shellCommand";
  command: string;
  cwd?: string;
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
  action: DesktopAction | ToolCall;
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
