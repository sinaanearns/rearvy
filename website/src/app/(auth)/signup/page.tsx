"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Loader2, LockKeyhole, Mail, UserRound } from "lucide-react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClientLogger } from "@/lib/client-diagnostics";
import { getErrorMessage } from "@/lib/error-utils";
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
} from "@/components/auth/auth-card-styles";

const log = createClientLogger("SignupPage");

const signupSignals = [
  {
    label: "Profile",
    value: "Workspace ready",
    icon: UserRound,
    tone: "text-cyan-600",
  },
  {
    label: "Email",
    value: "Account login",
    icon: Mail,
    tone: "text-emerald-600",
  },
  {
    label: "Security",
    value: "Private data",
    icon: LockKeyhole,
    tone: "text-amber-600",
  },
];

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

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/chat";
  const signInHref = `/login?redirect=${encodeURIComponent(redirect)}`;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function performLoginCleanup() {
    const claimShop = searchParams.get("claim_shop");
    if (claimShop) {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (idToken) {
          await fetch("/api/integrations/shopify/claim", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${idToken}`
            },
            body: JSON.stringify({ shopDomain: claimShop }),
          });
        } else {
          log.warn("Skipping Shopify claim because no auth token was available.");
        }
      } catch (err) {
        log.error("Failed to claim shop:", err);
      }
    }

    // Delay briefly to preserve session consistency across account switches.
    await new Promise((resolve) => setTimeout(resolve, 100));

    router.push(redirect);
    router.refresh();
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          email,
          password,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await readErrorResponse(response, "Unable to create account.")
        );
      }

      await signInWithEmailAndPassword(auth, email, password);
      await performLoginCleanup();
    } catch (error: unknown) {
      log.error("Signup error:", error);
      setError(getErrorMessage(error, "Unable to create account."));
      setLoading(false);
    }
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
            Create an account
          </CardTitle>
          <CardDescription className="text-sm text-slate-500">
            Set up your Rearvy workspace
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className={AUTH_FORM_BODY_CLASS}>
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className={AUTH_LABEL_CLASS}>
              <UserRound className="h-3.5 w-3.5 text-slate-400" />
              Full name
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="Jane Smith"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={AUTH_INPUT_CLASS}
              required
            />
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
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={AUTH_INPUT_CLASS}
              minLength={6}
              required
            />
          </div>

          {error && (
            <p className={AUTH_ERROR_CLASS}>
              {error}
            </p>
          )}

          <Button
            type="submit"
            className={AUTH_PRIMARY_BUTTON_CLASS}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {!loading && <ArrowRight className="mr-2 h-4 w-4" />}
            Create account
          </Button>
        </form>
      </CardContent>
      <CardFooter className={AUTH_FOOTER_CLASS}>
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href={signInHref} className="font-semibold text-slate-950 underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
