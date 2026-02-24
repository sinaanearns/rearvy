"use client";

import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";

interface RecentChat {
  id: string;
  title: string | null;
  updated_at: string | null;
}

interface Project {
  id: string;
  name: string;
}

interface TopbarProps {
  userName?: string | null;
  userEmail?: string | null;
  recentChats?: RecentChat[];
  projects?: Project[];
}

export function Topbar({
  userName,
  userEmail,
  recentChats = [],
  projects = [],
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:justify-end">
      {/* Mobile menu */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            suppressHydrationWarning
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-60 p-0">
          <Sidebar
            userName={userName}
            userEmail={userEmail}
            recentChats={recentChats}
            projects={projects}
          />
        </SheetContent>
      </Sheet>

      <span className="text-lg font-semibold md:hidden">Rearvy</span>
    </header>
  );
}
