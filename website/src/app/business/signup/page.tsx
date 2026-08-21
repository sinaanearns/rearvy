"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { RearvyPublicShell } from "@/components/public/rearvy-public-shell";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { createClientLogger } from "@/lib/client-diagnostics";
import { getErrorMessage } from "@/lib/error-utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowRight,
  Building2,
  Loader2,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
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

const log = createClientLogger("BusinessSignupPage");

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

export default function BusinessSignupPage() {
  return (
    <RearvyPublicShell
      authLinks={{
        login: "/business/login",
        signup: "/business/signup",
      }}
    >
      <section className="mx-auto w-full max-w-[560px] px-6 pt-28">
        <Suspense>
          <BusinessSignupForm />
        </Suspense>
      </section>
    </RearvyPublicShell>
  );
}

function BusinessSignupForm() {
  const [businessName, setBusinessName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/business/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessName,
          fullName,
          email,
          password,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await readErrorResponse(response, "Unable to create business account.")
        );
      }

      await signInWithEmailAndPassword(auth, email, password);

      // Persist a short-lived hint to tolerate Firestore write latency on first load
      try {
        window.localStorage.setItem("rearvy_recent_biz_signup", String(Date.now()));
      } catch {
        // no-op
      }

      // Small delay to preserve session stability before redirect
      await new Promise((resolve) => setTimeout(resolve, 120));

      router.push("/business/dashboard?from_signup=1");
      router.refresh();
    } catch (error: unknown) {
      log.error("Business signup error:", error);
      setError(getErrorMessage(error, "Unable to create business account."));
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
            Business sign up
          </CardTitle>
          <CardDescription className="text-sm text-slate-500">
            Create your Rearvy business account (separate from normal users)
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className={AUTH_FORM_BODY_CLASS}>
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="businessName" className={AUTH_LABEL_CLASS}>
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              Business name
            </Label>
            <Input
              id="businessName"
              type="text"
              placeholder="Acme Inc."
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className={AUTH_INPUT_CLASS}
              required
              minLength={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className={AUTH_LABEL_CLASS}>
              <UserRound className="h-3.5 w-3.5 text-slate-400" />
              Your full name
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
              placeholder="you@business.com"
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

          {error && <p className={AUTH_ERROR_CLASS}>{error}</p>}

          <Button
            type="submit"
            className={AUTH_PRIMARY_BUTTON_CLASS}
            disabled={loading}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
            Create business account
          </Button>
        </form>
      </CardContent>
      <CardFooter className={AUTH_FOOTER_CLASS}>
        <p className="text-sm text-muted-foreground">
          Already have a business account?{" "}
          <Link
            href="/business/login"
            className="font-semibold text-slate-950 underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}