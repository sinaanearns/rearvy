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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="capitalize">
              {insight.insight_type}
            </Badge>
            <Badge variant={insight.severity === 'critical' ? 'destructive' : 'default'} className="capitalize">
              {insight.severity}
            </Badge>
          </div>
          <DialogTitle className="text-2xl font-bold">{insight.title}</DialogTitle>
          <DialogDescription className="text-base mt-2">
            {insight.summary}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Generated on {format(new Date(insight.generated_at), "PPPP 'at' p")}</span>
            </div>
            {insight.related_entity && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Database className="h-4 w-4" />
                <span>Related to {insight.related_entity.type}: {insight.related_entity.id}</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Data Snapshot
            </h4>
            <Card className="bg-muted/30 border-none">
              <ScrollArea className="h-[200px] w-full rounded-md p-4">
                <pre className="text-xs font-mono">
                  {JSON.stringify(insight.data_snapshot, null, 2)}
                </pre>
              </ScrollArea>
            </Card>
          </div>

          <div className="rounded-lg bg-primary/5 p-4 border border-primary/10">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-primary shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-primary">Next Steps</p>
                <p className="text-sm text-muted-foreground">
                  Use the insights above to optimize your business operations. You can find more details in the related integration reports.
                </p>
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
