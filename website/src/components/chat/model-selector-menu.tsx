"use client";

import { useMemo } from "react";
import {
  Check,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Zap,
  Sliders,
  Brain,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CHAT_MODEL_OPTIONS,
  DEFAULT_CHAT_MODEL_TIER,
  getAvailableChatModels,
  resolveChatModelOption,
  type ChatModelTier,
} from "@/lib/ai/models";
import { cn } from "@/lib/utils";

export type ReasoningEffort =
  | "light"
  | "medium"
  | "high"
  | "extra-high"
  | "max"
  | "ultra";

export type ModelSpeed = "standard" | "fast";

const EFFORT_OPTIONS: Array<{
  id: ReasoningEffort;
  label: string;
  description?: string;
}> = [
  { id: "light", label: "Light" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "extra-high", label: "Extra High" },
  { id: "max", label: "Max" },
  { id: "ultra", label: "Ultra", description: "Consumes usage limits faster" },
];

const SPEED_OPTIONS: Array<{
  id: ModelSpeed;
  label: string;
  description: string;
}> = [
  { id: "standard", label: "Standard", description: "Default speed" },
  { id: "fast", label: "Fast", description: "1.5x speed, more usage" },
];

function formatEffortShort(effort: ReasoningEffort): string {
  switch (effort) {
    case "light":
      return "Light";
    case "medium":
      return "Med";
    case "high":
      return "High";
    case "extra-high":
      return "X-High";
    case "max":
      return "Max";
    case "ultra":
      return "Ultra";
    default:
      return "Max";
  }
}

function formatModelShort(modelId: ChatModelTier): string {
  if (modelId === "rearvy-expert-2.7") {
    return "2.7 Expert";
  }
  if (modelId === "rearvy-general-5.5") {
    return "5.5 General";
  }
  if (modelId.startsWith("custom:")) {
    const opt = resolveChatModelOption(modelId);
    return opt.label || "Custom";
  }
  return "5.5 General";
}

interface ModelSelectorMenuProps {
  model: ChatModelTier;
  onModelChange: (model: ChatModelTier) => void;
  effort?: ReasoningEffort;
  onEffortChange?: (effort: ReasoningEffort) => void;
  speed?: ModelSpeed;
  onSpeedChange?: (speed: ModelSpeed) => void;
  className?: string;
  disabled?: boolean;
}

export function ModelSelectorMenu({
  model,
  onModelChange,
  effort = "max",
  onEffortChange,
  speed = "standard",
  onSpeedChange,
  className,
  disabled = false,
}: ModelSelectorMenuProps) {
  const availableModels = useMemo(() => getAvailableChatModels("pro"), []);

  const currentModelOption = useMemo(
    () => resolveChatModelOption(model),
    [model]
  );

  const triggerLabel = useMemo(() => {
    const modelShort = formatModelShort(model);
    const effortShort = formatEffortShort(effort);
    return `${modelShort} ${effortShort}`;
  }, [model, effort]);

  const handleResetDefaults = () => {
    onModelChange(DEFAULT_CHAT_MODEL_TIER);
    onEffortChange?.("max");
    onSpeedChange?.("standard");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          aria-label="Model and Reasoning Settings"
          className={cn(
            "group inline-flex items-center gap-1.5 rounded-[8px] border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground/90 transition-all hover:border-border hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:scale-[0.98]",
            className
          )}
        >
          <span className="truncate max-w-[140px]">{triggerLabel}</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        side="top"
        sideOffset={8}
        className="w-56 rounded-xl border border-border/80 bg-popover/95 p-1.5 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/95"
      >
        <DropdownMenuGroup>
          {/* Model Submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium text-foreground hover:bg-accent focus:bg-accent">
              <span className="text-muted-foreground">Model</span>
              <span className="font-semibold text-foreground">
                {currentModelOption.label}
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent
                sideOffset={6}
                className="w-64 rounded-xl border border-border/80 bg-popover/95 p-1.5 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/95"
              >
                <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Available Models
                </DropdownMenuLabel>
                {availableModels.map((opt) => {
                  const isSelected = opt.id === model;
                  const isPrimary =
                    opt.id === "rearvy-general-5.5" ||
                    opt.id === "rearvy-expert-2.7";

                  return (
                    <DropdownMenuItem
                      key={opt.id}
                      onClick={() => onModelChange(opt.id)}
                      className={cn(
                        "flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors hover:bg-accent focus:bg-accent",
                        isSelected && "bg-accent/80 font-semibold"
                      )}
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{opt.label}</span>
                          {isPrimary && (
                            <span className="shrink-0 rounded bg-primary/10 px-1 py-0.2 text-[10px] font-bold text-primary dark:bg-primary/20">
                              Official
                            </span>
                          )}
                        </div>
                        {opt.description && (
                          <span className="text-[10px] text-muted-foreground truncate max-w-[190px]">
                            {opt.description}
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          {/* Effort Submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium text-foreground hover:bg-accent focus:bg-accent">
              <span className="text-muted-foreground">Effort</span>
              <span className="font-semibold text-foreground">
                {EFFORT_OPTIONS.find((e) => e.id === effort)?.label || "Max"}
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent
                sideOffset={6}
                className="w-56 rounded-xl border border-border/80 bg-popover/95 p-1.5 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/95"
              >
                <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Reasoning Effort
                </DropdownMenuLabel>
                {EFFORT_OPTIONS.map((opt) => {
                  const isSelected = opt.id === effort;

                  return (
                    <DropdownMenuItem
                      key={opt.id}
                      onClick={() => onEffortChange?.(opt.id)}
                      className={cn(
                        "flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors hover:bg-accent focus:bg-accent",
                        isSelected && "bg-accent/80 font-semibold"
                      )}
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span>{opt.label}</span>
                        {opt.description && (
                          <span className="text-[10px] text-muted-foreground">
                            {opt.description}
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          {/* Speed Submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium text-foreground hover:bg-accent focus:bg-accent">
              <span className="text-muted-foreground">Speed</span>
              <span className="font-semibold text-foreground">
                {SPEED_OPTIONS.find((s) => s.id === speed)?.label || "Standard"}
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent
                sideOffset={6}
                className="w-56 rounded-xl border border-border/80 bg-popover/95 p-1.5 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/95"
              >
                <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Response Speed
                </DropdownMenuLabel>
                {SPEED_OPTIONS.map((opt) => {
                  const isSelected = opt.id === speed;

                  return (
                    <DropdownMenuItem
                      key={opt.id}
                      onClick={() => onSpeedChange?.(opt.id)}
                      className={cn(
                        "flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors hover:bg-accent focus:bg-accent",
                        isSelected && "bg-accent/80 font-semibold"
                      )}
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span>{opt.label}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {opt.description}
                        </span>
                      </div>
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-1 bg-border/60" />

        {/* Reset to default */}
        <DropdownMenuItem
          onClick={handleResetDefaults}
          className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground focus:bg-accent focus:text-foreground"
        >
          <span>Reset to default</span>
          <RotateCcw className="h-3 w-3 shrink-0" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
