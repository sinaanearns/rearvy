"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, ArrowLeft, ArrowRight, Clock, FolderKanban, Loader2, MessageSquare, Plus, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { DashboardPageHero } from "@/components/dashboard/dashboard-page-hero";
import { createClientLogger } from "@/lib/client-diagnostics";
import { getErrorMessage } from "@/lib/error-utils";

interface ProjectDetailPageProps {
  params: Promise<{ projectId: string }>;
}

interface Project {
  id: string;
  name: string;
  description?: string;
}

interface Chat {
  id: string;
  title: string | null;
  updated_at: string;
}

type ProjectResponse = {
  project: Project | null;
  chats: Chat[];
};

const log = createClientLogger("ProjectDetailPage");

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatChatDate(value: string) {
  const timestamp = getTimestamp(value);
  if (!timestamp) {
    return "Recent";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

function getDateString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (isRecord(value)) {
    const seconds = typeof value.seconds === "number"
      ? value.seconds
      : typeof value._seconds === "number"
        ? value._seconds
        : null;

    if (seconds !== null && Number.isFinite(seconds)) {
      return new Date(seconds * 1000).toISOString();
    }
  }

  return "";
}

function getProject(value: unknown): Project | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") {
    return null;
  }

  return {
    id: value.id,
    name: value.name,
    ...(typeof value.description === "string" ? { description: value.description } : {}),
  };
}

function getChat(value: unknown): Chat | null {
  if (!isRecord(value) || typeof value.id !== "string") {
    return null;
  }

  return {
    id: value.id,
    title: typeof value.title === "string" ? value.title : null,
    updated_at: getDateString(value.updated_at),
  };
}

async function readProjectResponse(response: Response): Promise<ProjectResponse> {
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!isRecord(payload)) {
    return { project: null, chats: [] };
  }

  return {
    project: getProject(payload.project),
    chats: Array.isArray(payload.chats)
      ? payload.chats.map(getChat).filter((chat): chat is Chat => Boolean(chat))
      : [],
  };
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as unknown;
  if (isRecord(payload) && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  return fallback;
}

export default function ProjectDetailPage({
  params,
}: ProjectDetailPageProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [projectId, setProjectId] = useState<string>("");
  const [project, setProject] = useState<Project | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ projectId }) => setProjectId(projectId));
  }, [params]);

  useEffect(() => {
    async function loadProjectData() {
      if (!user || !projectId) return;

      try {
        setErrorMessage(null);
        const token = await user.getIdToken();
        const response = await fetch(`/api/dashboard/projects/${encodeURIComponent(projectId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          if (response.status === 404 || response.status === 403) {
            router.push("/projects");
            return;
          }
          throw new Error(await readErrorMessage(response, "Failed to fetch project"));
        }

        const data = await readProjectResponse(response);
        if (!data.project) {
          throw new Error("Project response did not include a valid project");
        }

        setProject(data.project);
        setChats(data.chats);
      } catch (error) {
        log.error("Error loading project:", error);
        setErrorMessage(getErrorMessage(error, "Unable to load this workspace."));
      } finally {
        setLoading(false);
      }
    }

    if (user && projectId) {
      loadProjectData();
    }
  }, [user, projectId, router]);

  if (authLoading || loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-10">
        <Link href="/projects" className="inline-flex items-center text-sm font-medium text-muted-foreground transition hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to client workspaces
        </Link>
        <Card className="rounded-[8px] border-destructive/30 bg-destructive/5">
          <CardContent className="flex gap-3 p-5 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Workspace could not be loaded</p>
              <p className="mt-1 text-destructive/80">
                {errorMessage || "The workspace response was empty or invalid."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  const sortedChats = [...chats].sort(
    (left, right) => getTimestamp(right.updated_at) - getTimestamp(left.updated_at)
  );
  const lastChatLabel = sortedChats[0] ? formatChatDate(sortedChats[0].updated_at) : "No chats yet";
  const projectBasePath = `/projects/${encodeURIComponent(projectId)}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <Link href="/projects" className="inline-flex items-center text-sm font-medium text-muted-foreground transition hover:text-foreground">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to client workspaces
      </Link>

      <DashboardPageHero
        eyebrow="Client workspace"
        title={project.name}
        description={project.description || "Keep this client workspace focused around the chats, research, and decisions tied to one initiative."}
        icon={FolderKanban}
        accent="amber"
        metrics={[
          { label: "Chats", value: sortedChats.length, detail: "workspace threads", icon: MessageSquare },
          { label: "Last update", value: lastChatLabel, detail: "latest chat", icon: Clock },
          { label: "Scope", value: "Client", detail: "campaign context", icon: Sparkles },
        ]}
        actions={
          <Button asChild className="rounded-[8px]">
            <Link href={`${projectBasePath}/chat/new`}>
              New chat
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        }
      />

      {sortedChats.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {sortedChats.map((chat) => (
            <Link
              key={chat.id}
              href={`${projectBasePath}/chat/${encodeURIComponent(chat.id)}`}
              className="group"
            >
              <Card className="min-h-[124px] cursor-pointer overflow-hidden rounded-[8px] border-border/70 bg-card/[0.88] shadow-sm transition hover:border-cyan-200/45 hover:shadow-md">
                <CardContent className="flex h-full items-start justify-between gap-4 p-5">
                  <div className="flex min-w-0 gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-cyan-200/35 bg-cyan-200/10 text-cyan-600 dark:text-cyan-100">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="line-clamp-2 text-sm">
                        {chat.title || "New Chat"}
                      </CardTitle>
                      <CardDescription className="mt-2 flex items-center gap-1.5 text-xs">
                        <Clock className="h-3.5 w-3.5" />
                        {formatChatDate(chat.updated_at)}
                      </CardDescription>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-[8px] border border-dashed border-border/80 bg-card/[0.72] px-5 py-16 text-center shadow-sm">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(105,215,255,0.12),transparent_42%)]"
          />
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-[8px] border border-cyan-200/35 bg-cyan-200/10">
            <MessageSquare className="h-8 w-8 text-cyan-600 dark:text-cyan-100" />
          </div>
          <h3 className="relative mt-5 text-lg font-semibold">No chats yet</h3>
          <p className="relative mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            Start a conversation inside this workspace to keep the client brief and decisions together.
          </p>
          <Button asChild variant="outline" className="relative mt-5 rounded-[8px]">
            <Link href={`${projectBasePath}/chat/new`}>
              Start workspace chat
              <Plus className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
