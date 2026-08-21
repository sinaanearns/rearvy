"use client";

import { Insight, InsightSeverity, InsightType } from "@/types/database";
import { 
  TrendingUp, 
  Zap, 
  Target, 
  ShieldAlert, 
  Info,
  Calendar,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface InsightCardProps {
  insight: Insight;
  onClick?: () => void;
}

const severityConfig: Record<InsightSeverity, { color: string; bg: string }> = {
  info: { color: "text-blue-500", bg: "bg-blue-500/10" },
  notable: { color: "text-amber-500", bg: "bg-amber-500/10" },
  important: { color: "text-orange-500", bg: "bg-orange-500/10" },
  critical: { color: "text-red-500", bg: "bg-red-500/10" },
};

const typeConfig: Record<InsightType, { icon: LucideIcon; label: string }> = {
  trend: { icon: TrendingUp, label: "Trend" },
  anomaly: { icon: Zap, label: "Anomaly" },
  milestone: { icon: Calendar, label: "Milestone" },
  opportunity: { icon: Target, label: "Opportunity" },
  risk: { icon: ShieldAlert, label: "Risk" },
  sync_event: { icon: Info, label: "Sync Event" },
};

export function InsightCard({ insight, onClick }: InsightCardProps) {
  const severity = severityConfig[insight.severity] || severityConfig.info;
  const type = typeConfig[insight.insight_type] || typeConfig.trend;
  const Icon = type.icon;

  return (
    <Card 
      className={cn(
        "group relative overflow-hidden transition-all hover:bg-muted/50 cursor-pointer border-l-4",
        insight.severity === "critical" ? "border-l-red-500" : 
        insight.severity === "important" ? "border-l-orange-500" :
        insight.severity === "notable" ? "border-l-amber-500" : "border-l-primary/30"
      )}
      onClick={onClick}
    >
      <div className="absolute top-0 right-0 p-4 opacity-0 transition-opacity group-hover:opacity-100">
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </div>

      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("rounded-[8px] p-2", severity.bg)}>
              <Icon className={cn("h-4 w-4", severity.color)} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-muted-foreground">
                {type.label}
              </span>
              <CardTitle className="text-lg font-semibold leading-tight">
                {insight.title}
              </CardTitle>
            </div>
          </div>
          <Badge variant={insight.is_read ? "secondary" : "default"} className="ml-2">
            {insight.severity}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
          {insight.summary}
        </p>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>
              {formatDistanceToNow(new Date(insight.generated_at), { addSuffix: true })}
            </span>
          </div>
          {!insight.is_read && (
            <div className="flex items-center gap-1 text-primary font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              New Insight
            </div>
          )}
        </div>
      </CardContent>
      
      <div
        aria-hidden
        className={cn(
          "absolute inset-y-0 right-0 w-1 opacity-0 transition-opacity group-hover:opacity-100",
          severity.bg
        )}
      />
    </Card>
  );
}
