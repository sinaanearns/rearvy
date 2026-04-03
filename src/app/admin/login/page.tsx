"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Lock, User, Loader2 } from "lucide-react";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Welcome back, Admin");
        router.replace("/admin");
        router.refresh();
      } else {
        toast.error(data.error || "Login failed");
      }
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background p-6">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(71,85,105,0.16),transparent_42%),radial-gradient(circle_at_bottom,rgba(15,23,42,0.18),transparent_38%)]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-500/5 blur-3xl" />

      <div className="w-full max-w-md space-y-8 rounded-[1.75rem] border border-border/60 bg-card/80 p-8 shadow-2xl shadow-black/20 backdrop-blur-xl transition-colors hover:border-slate-500/30 sm:p-10">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 shadow-lg shadow-slate-900/20">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-sm font-medium text-foreground shadow-sm">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[0.7rem] font-semibold text-white">
              R
            </span>
            <span>Rearvy Admin</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin Access</h1>
          <p className="mt-2 text-sm text-muted-foreground">Exclusively for authorized administrators</p>
        </div>

        <form onSubmit={handleLogin} className="mt-8 space-y-6">
          <div className="space-y-4">
            <div className="relative group">
              <label htmlFor="admin-email" className="sr-only">
                Admin email
              </label>
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground group-focus-within:text-foreground transition-colors">
                <User className="h-5 w-5" />
              </div>
              <input
                id="admin-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="block w-full rounded-xl border border-border/50 bg-background/50 py-3 pl-10 pr-3 text-foreground placeholder-muted-foreground focus:border-slate-500/50 focus:ring-2 focus:ring-slate-500/10 transition-all outline-none"
                placeholder="Admin email"
              />
            </div>

            <div className="relative group">
              <label htmlFor="admin-password" className="sr-only">
                Password
              </label>
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground group-focus-within:text-foreground transition-colors">
                <Lock className="h-5 w-5" />
              </div>
              <input
                id="admin-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="block w-full rounded-xl border border-border/50 bg-background/50 py-3 pl-10 pr-3 text-foreground placeholder-muted-foreground focus:border-slate-500/50 focus:ring-2 focus:ring-slate-500/10 transition-all outline-none"
                placeholder="Password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="group relative flex w-full justify-center items-center rounded-xl bg-gradient-to-r from-slate-700 to-slate-800 py-3 px-4 text-sm font-semibold text-white hover:from-slate-600 hover:to-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500/40 disabled:opacity-70 transition-all shadow-lg shadow-slate-900/20"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : null}
            Sign in to Dashboard
          </button>
        </form>

        <div className="text-center mt-6">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Return to rearvy.com
          </Link>
        </div>
      </div>
    </div>
  );
}
