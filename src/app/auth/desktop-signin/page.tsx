"use client";

import { useEffect, useState } from "react";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, LogIn } from "lucide-react";

export default function DesktopSigninPage() {
  const [status, setStatus] = useState<"idle" | "signing-in" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSignin = async () => {
    setStatus("signing-in");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const idToken = await user.getIdToken();
      
      // Redirect to the desktop app using the custom protocol
      window.location.href = `rearvy://auth-callback?token=${idToken}`;
      setStatus("success");
    } catch (error: any) {
      console.error("Auth error:", error);
      setStatus("error");
      setErrorMessage(error.message || "Failed to sign in. Please try again.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Desktop Sign In</CardTitle>
          <CardDescription>
            Complete your sign-in to continue in the Rearvy desktop app.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-8">
          {status === "idle" && (
            <Button size="lg" className="w-full gap-2" onClick={handleSignin}>
              <LogIn className="h-5 w-5" />
              Sign in with Google
            </Button>
          )}

          {status === "signing-in" && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Waiting for Google...</p>
            </div>
          )}

          {status === "success" && (
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="rounded-full bg-emerald-100 p-3 text-emerald-600 dark:bg-emerald-900/30">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </div>
              <CardTitle className="text-xl">Successfully signed in!</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                You can now close this tab and return to the Rearvy app.
              </p>
              <Button variant="outline" className="mt-6" onClick={() => window.close()}>
                Close Window
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="text-center">
              <p className="text-sm text-destructive">{errorMessage}</p>
              <Button variant="outline" className="mt-4" onClick={() => setStatus("idle")}>
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
