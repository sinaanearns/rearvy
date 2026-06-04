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
  const redirect = searchParams.get("redirect") || "/chat";
  const signInHref = `/login?redirect=${encodeURIComponent(redirect)}`;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function readErrorResponse(response: Response, fallback: string) {
    try {
      const data = (await response.json()) as { error?: string };
      return data.error || fallback;
    } catch {
      return fallback;
    }
  }

  async function performLoginCleanup() {
    const claimShop = searchParams.get("claim_shop");
    if (claimShop) {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        await fetch("/api/integrations/shopify/claim", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`
          },
          body: JSON.stringify({ shopDomain: claimShop }),
        });
      } catch (err) {
        console.error("Failed to claim shop:", err);
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
      console.error("Signup error:", error);
      setError(getErrorMessage(error, "Unable to create account."));
      setLoading(false);
    }
  }

  return (
    <Card className="w-full min-w-0 overflow-hidden rounded-[8px] border-slate-200/80 bg-white shadow-sm shadow-slate-950/10">
      <CardHeader className="space-y-4 px-6 pb-5 pt-7 text-center sm:px-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[8px] border border-slate-200 bg-white p-1.5 shadow-sm shadow-slate-950/10">
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
          <CardTitle className="text-2xl font-semibold tracking-tight text-slate-950">
            Create an account
          </CardTitle>
          <CardDescription className="text-sm text-slate-500">
            Set up your Rearvy workspace
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6 sm:px-8">
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-2 text-slate-700">
              <UserRound className="h-3.5 w-3.5 text-slate-400" />
              Full name
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="Jane Smith"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-11 rounded-[8px] border-slate-200 bg-slate-50/80 text-slate-950 shadow-inner shadow-slate-950/[0.02] placeholder:text-slate-400 focus-visible:bg-white"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2 text-slate-700">
              <Mail className="h-3.5 w-3.5 text-slate-400" />
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-[8px] border-slate-200 bg-slate-50/80 text-slate-950 shadow-inner shadow-slate-950/[0.02] placeholder:text-slate-400 focus-visible:bg-white"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="flex items-center gap-2 text-slate-700">
              <LockKeyhole className="h-3.5 w-3.5 text-slate-400" />
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-[8px] border-slate-200 bg-slate-50/80 text-slate-950 shadow-inner shadow-slate-950/[0.02] placeholder:text-slate-400 focus-visible:bg-white"
              minLength={6}
              required
            />
          </div>

          {error && (
            <p className="rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="h-11 w-full rounded-[8px] bg-slate-950 font-semibold text-white shadow-sm shadow-slate-950/15 hover:bg-slate-800"
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {!loading && <ArrowRight className="mr-2 h-4 w-4" />}
            Create account
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center border-t border-slate-100 bg-slate-50/80 px-6 py-4">
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
