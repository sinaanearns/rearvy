"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Download, FolderPlus, XCircle } from "lucide-react";
import Link from "next/link";

interface ActionCardProps {
  data: Record<string, unknown>;
  toolName: string;
}

export function ActionCard({ data, toolName }: ActionCardProps) {
  if (!data || typeof data !== "object") return null;

  const isSuccess = data.ok === true;

  if (toolName === "createProject" && isSuccess && data.project) {
    const project = data.project as {
      name: string;
      description?: string;
      url: string;
    };
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <FolderPlus className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">
              Project Created
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm font-medium">{project.name}</p>
          {project.description && (
            <p className="text-xs text-muted-foreground">
              {project.description}
            </p>
          )}
          <Link href={project.url}>
            <Button size="sm" variant="outline" className="mt-2">
              Open project
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (toolName === "exportData" && isSuccess && data.downloadUrl) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">Export Ready</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {String(data.rowCount || 0)}{" "}
            {String(data.dataType || "").replace(/_/g, " ")} records
          </p>
          <a href={String(data.downloadUrl)} download>
            <Button size="sm" className="mt-2">
              <Download className="mr-2 h-3 w-3" />
              Download CSV
            </Button>
          </a>
          <p className="text-[10px] text-muted-foreground">
            Link expires in {String(data.expiresIn || "15 minutes")}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Fallback for errors
  const Icon = isSuccess ? CheckCircle2 : XCircle;
  const iconColor = isSuccess ? "text-green-500" : "text-red-500";

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <CardTitle className="text-sm font-medium">
            {isSuccess ? "Action Complete" : "Action Failed"}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          {String(data.message || "")}
        </p>
      </CardContent>
    </Card>
  );
}
