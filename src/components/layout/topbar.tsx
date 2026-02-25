"use client";

import { Button } from "@/components/ui/button";
import { Menu, PanelLeft, PanelRight, Bell } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";
import { useSidebar } from "./sidebar-provider";


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
  const { toggle, toggleRight, openRightTo } = useSidebar();
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-2">
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
              variant="mobile"
              userName={userName}
              userEmail={userEmail}
              recentChats={recentChats}
              projects={projects}
            />
          </SheetContent>
        </Sheet>

        {/* Desktop Sidebar Toggle (Left Spot) */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:flex"
          title="Toggle Sidebar"
          onClick={toggle}
        >
          <PanelLeft className="h-5 w-5" />
        </Button>

        <span className="text-lg font-semibold md:hidden">Rearvy</span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          title="Notifications"
          onClick={() => openRightTo("notifications")}
          className="hidden md:flex"
        >
          <Bell className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Toggle News"
          onClick={toggleRight}
          className="hidden md:flex"
        >
          <PanelRight className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
