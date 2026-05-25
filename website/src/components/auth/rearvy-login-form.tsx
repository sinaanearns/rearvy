"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { User } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import {
  onAuthChange,
  sendPasswordReset,
  signInWithGoogle,
} from "@/lib/firebase/auth";

type RearvyLoginFormProps = {
  defaultRedirect: string;
  title: string;
  description: string;
};

export function RearvyLoginForm({
  defaultRedirect,
  title,
  description,
}: RearvyLoginFormProps) {
  const activeAuthActionRef = useRef<"idle" | "email" | "google">("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDesktopRuntime, setIsDesktopRuntime] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const redirectHandledRef = useRef(false);
  const pendingFinalizeRef = useRef<Promise<void> | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || defaultRedirect;
  const signupHref = `/signup?redirect=${encodeURIComponent(redirect)}`;

  useEffect(() => {
    const updateDesktopRuntime = () => {
      setIsDesktopRuntime(Boolean(window.electron?.system?.openExternal));
    };

    updateDesktopRuntime();
    window.addEventListener("rearvy-electron-ready", updateDesktopRuntime);
    return () => {
      window.removeEventListener("rearvy-electron-ready", updateDesktopRuntime);
    };
  }, []);

  async function readErrorResponse(response: Response, fallback: string) {
    try {
      const payload = (await response.json()) as { error?: string };
      return payload.error || fallback;
    } catch {
      return fallback;
    }
  }

  const finalizeAuthenticatedUser = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    if (pendingFinalizeRef.current) {
      await pendingFinalizeRef.current;
      return;
    }

    redirectHandledRef.current = true;

    const finalizePromise = (async () => {
      const idToken = await currentUser.getIdToken(true);
      // Profile initialization is best-effort and should not block sign-in
      try {
        const setupResponse = await fetch("/api/auth/initialize-profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            fullName: currentUser.displayName || "",
            avatarUrl: currentUser.photoURL || "",
          }),
        });

        if (!setupResponse.ok) {
          const setupError = await readErrorResponse(
            setupResponse,
            "Unable to finish setting up your account."
          );

          console.warn("Profile initialization failed after sign-in:", {
            status: setupResponse.status,
            message: setupError,
          });
        }
      } catch (err) {
        console.warn("Profile initialization request failed (continuing anyway):", err);
      }

      const claimShop = searchParams.get("claim_shop");
      if (claimShop) {
        try {
          await fetch("/api/integrations/shopify/claim", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ shopDomain: claimShop }),
          });
        } catch (err) {
          console.error("Failed to claim shop:", err);
        }
      }

      // Delay briefly to preserve session consistency across account switches.
      await new Promise((resolve) => setTimeout(resolve, 100));

      router.replace(redirect);
      router.refresh();
    })();

    pendingFinalizeRef.current = finalizePromise;

    try {
      await finalizePromise;
    } catch (err) {
      redirectHandledRef.current = false;
      throw err;
    } finally {
      activeAuthActionRef.current = "idle";
      pendingFinalizeRef.current = null;
    }
  }, [redirect, router, searchParams]);

  useEffect(() => {
    const unsubscribe = onAuthChange((currentUser) => {
      if (currentUser && !redirectHandledRef.current) {
        if (activeAuthActionRef.current !== "idle") {
          return;
        }

        setLoading(true);
        void finalizeAuthenticatedUser(currentUser).catch((err: unknown) => {
          setError(
            err instanceof Error ? err.message : "Unable to complete sign-in."
          );
          setLoading(false);
        });
        return;
      }

      if (!currentUser) {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [finalizeAuthenticatedUser]);

  function getLoginErrorMessage(error: unknown): string {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";

    if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
      return "Incorrect email or password.";
    }

    if (code === "auth/user-disabled") {
      return "This account has been disabled. Contact support.";
    }

    if (code === "auth/invalid-email") {
      return "Enter a valid email address.";
    }

    if (code === "auth/user-not-found") {
      return "No account found for this email. Create an account first.";
    }

    if (code === "auth/too-many-requests") {
      return "Too many sign-in attempts. Please wait a moment and try again.";
    }

    if (code === "auth/network-request-failed") {
      return "Network error. Check your internet connection and try again.";
    }

    if (code === "auth/invalid-api-key") {
      return "Firebase is not configured correctly. Check NEXT_PUBLIC_FIREBASE_API_KEY.";
    }

    if (code === "auth/api-key-expired") {
      return "Firebase API key rejected. Update NEXT_PUBLIC_FIREBASE_API_KEY in your active environment (local and deployment), then restart the app.";
    }

    if (code === "auth/app-not-authorized") {
      return "This domain is not authorized in Firebase Authentication settings.";
    }

    return error instanceof Error ? error.message : "Unable to sign in.";
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    activeAuthActionRef.current = "email";
    setLoading(true);
    setError(null);
    setResetMessage(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      activeAuthActionRef.current = "idle";
      setError("Enter a valid email address.");
      setLoading(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, normalizedEmail, password);
      await finalizeAuthenticatedUser(auth.currentUser);
    } catch (err: unknown) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code?: unknown }).code)
          : "";
      if (code && code !== "auth/invalid-credential" && code !== "auth/wrong-password") {
        console.error("Login error:", err);
      }
      activeAuthActionRef.current = "idle";
      setError(getLoginErrorMessage(err));
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    activeAuthActionRef.current = "google";
    setLoading(true);
    setError(null);
    setResetMessage(null);
    redirectHandledRef.current = false;

    try {
      if (isDesktopRuntime && window.electron?.system?.openExternal) {
        const desktopAuthUrl = new URL("/desktop-auth", window.location.origin);
        desktopAuthUrl.searchParams.set("redirect", redirect);

        await window.electron.system.openExternal(desktopAuthUrl.toString());
        activeAuthActionRef.current = "idle";
        setLoading(false);
        return;
      }

      const {
        user: googleUser,
        error: googleError,
        redirecting,
      } = await signInWithGoogle();
      if (googleError) {
        throw new Error(googleError);
      }

      if (redirecting) {
        activeAuthActionRef.current = "idle";
        setLoading(false);
        return;
      }

      await finalizeAuthenticatedUser(googleUser ?? auth.currentUser);
    } catch (err: unknown) {
      activeAuthActionRef.current = "idle";
      setError(err instanceof Error ? err.message : "Unable to sign in with Google.");
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setError(null);
    setResetMessage(null);

    if (!email.trim()) {
      setError("Enter your email first, then click Forgot password.");
      return;
    }

    const { error: resetError } = await sendPasswordReset(email.trim().toLowerCase());
    if (resetError) {
      setError(resetError);
      return;
    }

    setResetMessage("Password reset email sent. Check your inbox and spam folder.");
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => void handleGoogleLogin()}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isDesktopRuntime ? "Continue in browser" : "Continue with Google"}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Forgot password?
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {resetMessage && <p className="text-sm text-emerald-600">{resetMessage}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign in
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href={signupHref} className="font-medium text-primary underline-offset-4 hover:underline">
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
