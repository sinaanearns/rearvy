"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Loader2, FolderOpen } from "lucide-react";
import { getErrorMessage } from "@/lib/error-utils";

interface JoinProjectPageProps {
  params: Promise<{ inviteCode: string }>;
}

export default function JoinProjectPage({ params }: JoinProjectPageProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ inviteCode }) => setInviteCode(inviteCode));
  }, [params]);

  const handleJoin = async () => {
    if (!user || !inviteCode) return;
    setJoining(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/projects/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ inviteCode }),
      });

      const data = (await response.json()) as { error?: string; projectId?: string };

      if (!response.ok) {
        throw new Error(data.error || "Failed to join project");
      }

      if (!data.projectId) {
        throw new Error("Join response did not include a project id");
      }

      router.push(`/projects/${data.projectId}`);
    } catch (err) {
      setError(getErrorMessage(err, "Something went wrong"));
    } finally {
      setJoining(false);
    }
  };

  if (authLoading) {
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

  return (
    <div className="flex h-[calc(100vh-7rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <FolderOpen className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl">Join a Project</CardTitle>
          <CardDescription>
            You have been invited to collaborate on a project. Click below to
            join and access all its chats and resources.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}
          <Button
            onClick={handleJoin}
            disabled={joining || !inviteCode}
            className="w-full"
            size="lg"
          >
            {joining ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Joining...
              </>
            ) : (
              "Join Project"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
