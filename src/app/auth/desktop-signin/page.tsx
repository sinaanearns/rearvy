"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getRedirectResult,
  GoogleAuthProvider,
  signInWithRedirect,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check, Loader2, LogIn } from "lucide-react";

type DesktopSigninStatus =
  | "checking"
  | "redirecting"
  | "idle"
  | "success"
  | "error";

const DESKTOP_REDIRECT_STARTED_KEY = "rearvy.desktopGoogleRedirectStarted";

function getCredentialCallbackUrl(
  result: NonNullable<Awaited<ReturnType<typeof getRedirectResult>>>
) {
  const credential = GoogleAuthProvider.credentialFromResult(result) as
    | { idToken?: string | null; accessToken?: string | null }
    | null;

  if (!credential?.idToken && !credential?.accessToken) {
    throw new Error("Google did not return a desktop sign-in credential.");
  }

  const callbackUrl = new URL("rearvy://auth-callback");
  if (credential.idToken) {
    callbackUrl.searchParams.set("id_token", credential.idToken);
  }
  if (credential.accessToken) {
    callbackUrl.searchParams.set("access_token", credential.accessToken);
  }

  return callbackUrl.toString();
}

export default function DesktopSigninPage() {
  const [status, setStatus] = useState<DesktopSigninStatus>("checking");
  const [errorMessage, setErrorMessage] = useState("");

  const startGoogleRedirect = useCallback(async () => {
    setStatus("redirecting");
    sessionStorage.setItem(DESKTOP_REDIRECT_STARTED_KEY, "1");
    await signInWithRedirect(auth, googleProvider);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function completeRedirect() {
      try {
        const result = await getRedirectResult(auth);
        if (cancelled) {
          return;
        }

        if (result?.user) {
          sessionStorage.removeItem(DESKTOP_REDIRECT_STARTED_KEY);
          window.location.href = getCredentialCallbackUrl(result);
          setStatus("success");
          return;
        }

        const redirectAlreadyStarted =
          sessionStorage.getItem(DESKTOP_REDIRECT_STARTED_KEY) === "1";
        if (redirectAlreadyStarted) {
          sessionStorage.removeItem(DESKTOP_REDIRECT_STARTED_KEY);
          setStatus("idle");
          return;
        }

        await startGoogleRedirect();
      } catch (error: unknown) {
        console.error("Desktop Google sign-in error:", error);
        sessionStorage.removeItem(DESKTOP_REDIRECT_STARTED_KEY);
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to sign in. Please try again."
        );
      }
    }

    void completeRedirect();

    return () => {
      cancelled = true;
    };
  }, [startGoogleRedirect]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Desktop Sign In</CardTitle>
          <CardDescription>
            Choose your Google account to continue in the Rearvy desktop app.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-8">
          {(status === "checking" || status === "redirecting") && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Opening Google account chooser...
              </p>
            </div>
          )}

          {status === "idle" && (
            <Button
              size="lg"
              className="w-full gap-2"
              onClick={() => void startGoogleRedirect()}
            >
              <LogIn className="h-5 w-5" />
              Continue with Google
            </Button>
          )}

          {status === "success" && (
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="rounded-full bg-emerald-100 p-3 text-emerald-600 dark:bg-emerald-900/30">
                  <Check className="h-8 w-8" />
                </div>
              </div>
              <CardTitle className="text-xl">Successfully signed in</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                You can now close this tab and return to the Rearvy app.
              </p>
              <Button
                variant="outline"
                className="mt-6"
                onClick={() => window.close()}
              >
                Close Window
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="text-center">
              <p className="text-sm text-destructive">{errorMessage}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => void startGoogleRedirect()}
              >
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
