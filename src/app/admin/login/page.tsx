"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock, User, Loader2 } from "lucide-react";
import Image from "next/image";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
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
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Welcome back, Admin");
        router.push("/admin");
      } else {
        toast.error(data.error || "Login failed");
      }
    } catch (error) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      {/* Background Decor */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-600/5 via-slate-700/5 to-transparent"></div>
      
      <div className="w-full max-w-md space-y-8 rounded-3xl border border-border/50 bg-card/50 p-8 backdrop-blur shadow-2xl transition-all hover:border-slate-500/30">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 shadow-lg shadow-slate-900/20">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <Image
            src="/rearvy-wordmark.svg"
            alt="Rearvy"
            width={120}
            height={28}
            className="h-8 w-auto mx-auto mb-4 opacity-80 dark:invert"
          />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin Access</h1>
          <p className="mt-2 text-sm text-muted-foreground">Exclusively for authorized administrators</p>
        </div>

        <form onSubmit={handleLogin} className="mt-8 space-y-6">
          <div className="space-y-4">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground group-focus-within:text-foreground transition-colors">
                <User className="h-5 w-5" />
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full rounded-xl border border-border/50 bg-background/50 py-3 pl-10 pr-3 text-foreground placeholder-muted-foreground focus:border-slate-500/50 focus:ring-2 focus:ring-slate-500/10 transition-all outline-none"
                placeholder="Username"
              />
            </div>

            <div className="relative group">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground group-focus-within:text-foreground transition-colors">
                <Lock className="h-5 w-5" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Return to rearvy.com
          </a>
        </div>
      </div>
    </div>
  );
}
