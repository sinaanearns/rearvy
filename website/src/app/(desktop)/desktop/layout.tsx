"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { getIdToken } from "@/lib/firebase/auth";
import { Loader2 } from "lucide-react";
import { DesktopCommandCenter } from "@/components/desktop/desktop-command-center";

type DesktopData = {
  userName: string | null;
  userEmail: string | null;
  recentChats: Array<{ id: string; title: string; updated_at: string }>;
  projects: Array<{ id: string; name: string }>;
};

export default function DesktopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const [desktopData, setDesktopData] = useState<DesktopData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      const target = pathname || "/desktop";
      router.replace(`/login?redirect=${encodeURIComponent(target)}`);
      return;
    }

    const fetchDesktopData = async () => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 12000);

      try {
        const token = await getIdToken();
        if (!token) {
          throw new Error("Missing auth token");
        }

        const response = await fetch("/api/dashboard/data", {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch desktop data (${response.status})`);
        }

        const data = await response.json();
        setDesktopData(data);
      } catch (error) {
        console.error("Error fetching desktop data:", error);
        setDesktopData({
          userName: user.displayName || null,
          userEmail: user.email || null,
          recentChats: [],
          projects: [],
        });
      } finally {
        window.clearTimeout(timeoutId);
        setLoading(false);
      }
    };

    void fetchDesktopData();
  }, [authLoading, pathname, router, user]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950 text-slate-100">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!desktopData) {
    return <div className="min-h-dvh bg-slate-950">{children}</div>;
  }

  return (
    <DesktopCommandCenter
      userName={desktopData.userName}
      userEmail={desktopData.userEmail}
      recentChats={desktopData.recentChats}
      projects={desktopData.projects}
    >
      {children}
    </DesktopCommandCenter>
  );
}