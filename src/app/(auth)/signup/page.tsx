"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { DEFAULT_PLAN, REARVY_PLANS, type SubscriptionPlan } from "@/lib/plans";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check, Loader2 } from "lucide-react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { signInWithGoogle } from "@/lib/firebase/auth";
import { insertDoc } from "@/lib/firebase/firestore";

function isSubscriptionPlan(value: string | null): value is SubscriptionPlan {
  return value === "free" || value === "pro";
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
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
  const [plan, setPlan] = useState<SubscriptionPlan>(() => {
    const requestedPlan = searchParams.get("plan");
    return isSubscriptionPlan(requestedPlan) ? requestedPlan : DEFAULT_PLAN;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Create user with Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update display name
      await updateProfile(user, { displayName: fullName });

      // Create user profile in Firestore
      await insertDoc("profiles", {
        full_name: fullName,
        email: user.email,
        avatar_url: user.photoURL,
        business_name: null,
        business_type: null,
        plan,
        onboarding_completed: false,
        timezone: "UTC",
        currency: "USD",
      }, user.uid);

      // Redirect to chat
      router.push("/chat");
      router.refresh();
    } catch (error: unknown) {
      console.error("Signup error:", error);
      setError(getErrorMessage(error, "Unable to create account."));
      setLoading(false);
    }
  }

  async function handleGoogleSignup() {
    setError(null);
    setLoading(true);

    try {
      const { user, error } = await signInWithGoogle();
      if (error) {
        setError(error);
        setLoading(false);
        return;
      }

      // Create profile if this is first sign-in
      if (user) {
        await insertDoc("profiles", {
          full_name: user.displayName || "",
          email: user.email,
          avatar_url: user.photoURL,
          business_name: null,
          business_type: null,
          plan,
          onboarding_completed: false,
          timezone: "UTC",
          currency: "USD",
        }, user.uid);
      }

      router.push("/chat");
      router.refresh();
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Unable to start Google sign-in."));
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
        <CardDescription>
          Get started with your AI business assistant
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Jane Smith"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
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
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Choose your plan</Label>
              <p className="text-sm text-muted-foreground">
                Start on Free or jump into Pro. You can change this later in settings.
              </p>
            </div>
            <div className="grid gap-3">
              {REARVY_PLANS.map((planOption) => {
                const selected = plan === planOption.id;

                return (
                  <button
                    key={planOption.id}
                    type="button"
                    onClick={() => setPlan(planOption.id)}
                    aria-pressed={selected}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition-all",
                      selected
                        ? "border-slate-700 bg-slate-50 shadow-sm"
                        : "border-border bg-background hover:border-slate-400/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-semibold">
                            {planOption.name}
                          </span>
                          {planOption.badge && (
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-700">
                              {planOption.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {planOption.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold">{planOption.price}</div>
                        <div className="text-xs text-muted-foreground">
                          {planOption.period}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2">
                      {planOption.features.slice(0, 2).map((feature) => (
                        <div
                          key={feature}
                          className="flex items-center gap-2 text-sm text-muted-foreground"
                        >
                          <Check className="h-4 w-4 text-slate-700" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create account
          </Button>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={handleGoogleSignup}
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Google
        </Button>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
