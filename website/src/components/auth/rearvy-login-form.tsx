"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
import { ArrowRight, Chrome, Loader2, LockKeyhole, Mail } from "lucide-react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import {
  onAuthChange,
  sendPasswordReset,
  signInWithGoogle,
} from "@/lib/firebase/auth";
import { createClientLogger } from "@/lib/client-diagnostics";
import {
  AUTH_CARD_ACCENT_CLASS,
  AUTH_CARD_CLASS,
  AUTH_CARD_HEADER_CLASS,
  AUTH_ERROR_CLASS,
  AUTH_FOOTER_CLASS,
  AUTH_FORM_BODY_CLASS,
  AUTH_INPUT_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_LOGO_FRAME_CLASS,
  AUTH_PRIMARY_BUTTON_CLASS,
  AUTH_SECONDARY_BUTTON_CLASS,
  AUTH_SUCCESS_CLASS,
} from "@/components/auth/auth-card-styles";

const log = createClientLogger("RearvyLoginForm");

const loginSignals = [
  {
    label: "Browser",
    value: "Live tasks",
    icon: Chrome,
    tone: "text-cyan-600",
  },
  {
    label: "Email",
    value: "Review first",
    icon: Mail,
    tone: "text-emerald-600",
  },
  {
    label: "Access",
    value: "Secure",
    icon: LockKeyhole,
    tone: "text-amber-600",
  },
];

type RearvyLoginFormProps = {
  defaultRedirect: string;
  title: string;
  description: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readApiError(payload: unknown, fallback: string) {
  if (isRecord(payload) && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  return fallback;
}

async function readErrorResponse(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as unknown;
  return readApiError(payload, fallback);
}

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

          log.warn("Profile initialization failed after sign-in:", {
            status: setupResponse.status,
            message: setupError,
          });
        }
      } catch (err) {
        log.warn(
          "Profile initialization request failed (continuing anyway):",
          err
        );
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
          log.error("Failed to claim shop:", err);
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
        log.error("Login error:", err);
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
    <Card className={AUTH_CARD_CLASS}>
      <div className={AUTH_CARD_ACCENT_CLASS} />
      <CardHeader className={AUTH_CARD_HEADER_CLASS}>
        <div className={AUTH_LOGO_FRAME_CLASS}>
          <Image
            src="/rearvy-logo.png"
            alt="Rearvy"
            width={36}
            height={36}
            className="h-full w-full object-contain"
            priority
          />
        </div>
        <div className="space-y-1.5">
          <CardTitle className="text-2xl font-semibold text-slate-950">
            {title}
          </CardTitle>
          <CardDescription className="text-sm text-slate-500">
            {description}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className={AUTH_FORM_BODY_CLASS}>
        <form onSubmit={handleLogin} className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className={AUTH_SECONDARY_BUTTON_CLASS}
            onClick={() => void handleGoogleLogin()}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {!loading && <Chrome className="mr-2 h-4 w-4" />}
            {isDesktopRuntime ? "Continue in browser" : "Continue with Google"}
          </Button>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[#fbfdff] px-3 text-xs font-medium text-slate-400">
                or
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className={AUTH_LABEL_CLASS}>
              <Mail className="h-3.5 w-3.5 text-slate-400" />
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={AUTH_INPUT_CLASS}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className={AUTH_LABEL_CLASS}>
              <LockKeyhole className="h-3.5 w-3.5 text-slate-400" />
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={AUTH_INPUT_CLASS}
              required
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs font-medium text-slate-500 underline-offset-4 hover:text-slate-950 hover:underline"
              >
                Forgot password?
              </button>
            </div>
          </div>

          {error && (
            <p className={AUTH_ERROR_CLASS}>
              {error}
            </p>
          )}

          {resetMessage && (
            <p className={AUTH_SUCCESS_CLASS}>
              {resetMessage}
            </p>
          )}

          <Button
            type="submit"
            className={AUTH_PRIMARY_BUTTON_CLASS}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {!loading && <ArrowRight className="mr-2 h-4 w-4" />}
            Sign in
          </Button>
        </form>
      </CardContent>
      <CardFooter className={AUTH_FOOTER_CLASS}>
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href={signupHref} className="font-semibold text-slate-950 underline-offset-4 hover:underline">
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
