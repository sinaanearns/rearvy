"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { getErrorMessage } from "@/lib/error-utils";

interface JoinPageProps {
  params: Promise<{ inviteCode: string }>;
}

export default function JoinPage({ params }: JoinPageProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [inviteCode, setInviteCode] = useState<string>("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ inviteCode }) => setInviteCode(inviteCode));
  }, [params]);

  const handleJoin = async () => {
    if (!user || !inviteCode) return;

    setIsJoining(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/chat/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ inviteCode }),
      });

      const data = (await response.json()) as { error?: string; chatId?: string };

      if (!response.ok) {
        throw new Error(data.error || "Failed to join chat");
      }

      if (!data.chatId) {
        throw new Error("Join response did not include a chat id");
      }

      router.push(`/chat/${data.chatId}`);
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err, "An unexpected error occurred"));
    } finally {
      setIsJoining(false);
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
    router.push("/login?redirect=/join/" + inviteCode);
    return null;
  }

  return (
    <div className="flex h-[80vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Join Group Chat</CardTitle>
          <CardDescription>
            You have been invited to join a group chat. You will be able to see previous messages upon joining.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center flex-col gap-2">
          <Button 
            size="lg" 
            onClick={handleJoin} 
            disabled={isJoining || !inviteCode}
            className="w-full"
          >
            {isJoining ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Joining...
              </>
            ) : (
              "Join Chat"
            )}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => router.push("/")}>
            Cancel
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
