"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface GenericMetricCardProps {
  data: Record<string, unknown>;
  toolName: string;
}

export function GenericMetricCard({ data, toolName }: GenericMetricCardProps) {
  if (!data || typeof data !== "object") return null;

  const title = toolName
    .replace(/^get/, "")
    .replace(/([A-Z])/g, " $1")
    .trim();

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-1 text-sm">
          {Object.entries(data).map(([key, value]) => {
            if (key === "message" && typeof value === "string") {
              return (
                <p key={key} className="text-muted-foreground italic">
                  {value}
                </p>
              );
            }
            if (Array.isArray(value) || typeof value === "object") return null;
            return (
              <div key={key} className="flex justify-between">
                <dt className="text-muted-foreground">
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </dt>
                <dd className="font-medium">{String(value)}</dd>
              </div>
            );
          })}
        </dl>
      </CardContent>
    </Card>
  );
}
