"use client";

import { Insight } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Info, BarChart3, Clock, Database } from "lucide-react";

interface InsightDetailsProps {
  insight: Insight | null;
  isOpen: boolean;
  onClose: () => void;
}

export function InsightDetails({ insight, isOpen, onClose }: InsightDetailsProps) {
  if (!insight) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="overflow-hidden rounded-[8px] border-border/70 p-0 shadow-sm sm:max-w-2xl">
        <div className="h-1 bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-300" />
        <div className="p-6">
        <DialogHeader>
          <div className="mb-3 flex items-center gap-2">
            <Badge variant="outline" className="rounded-[8px] capitalize">
              {insight.insight_type}
            </Badge>
            <Badge variant={insight.severity === 'critical' ? 'destructive' : 'default'} className="rounded-[8px] capitalize">
              {insight.severity}
            </Badge>
          </div>
          <DialogTitle className="text-2xl font-semibold tracking-tight">{insight.title}</DialogTitle>
          <DialogDescription className="mt-2 text-base leading-7">
            {insight.summary}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-5 space-y-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-[8px] border border-border/70 bg-muted/25 px-3 py-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              <span>Generated on {format(new Date(insight.generated_at), "PPPP 'at' p")}</span>
            </div>
            {insight.related_entity && (
              <div className="flex items-center gap-3 rounded-[8px] border border-border/70 bg-muted/25 px-3 py-2 text-sm text-muted-foreground">
                <Database className="h-4 w-4 shrink-0" />
                <span>Related to {insight.related_entity.type}: {insight.related_entity.id}</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <BarChart3 className="h-4 w-4 text-primary" />
              Data Snapshot
            </h4>
            <Card className="overflow-hidden rounded-[8px] border border-border/70 bg-muted/30 shadow-sm">
              <ScrollArea className="h-[200px] w-full p-4">
                <pre className="text-xs font-mono">
                  {JSON.stringify(insight.data_snapshot, null, 2)}
                </pre>
              </ScrollArea>
            </Card>
          </div>

          <div className="rounded-[8px] border border-primary/10 bg-primary/5 p-4 shadow-sm">
            <div className="flex gap-3">
              <Info className="h-5 w-5 shrink-0 text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-primary">Next Steps</p>
                <p className="text-sm text-muted-foreground">
                  Use the insights above to optimize your business operations. You can find more details in the related integration reports.
                </p>
              </div>
            </div>
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Minimal Card shim if not imported globally or if we want to avoid complex imports in this file
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
