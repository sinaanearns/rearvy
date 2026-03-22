"use client";

import { 
  Users, 
  Settings, 
  BarChart3, 
  LayoutDashboard, 
  LogOut,
  Bell,
  Search,
  ChevronRight,
  TrendingUp,
  MessageSquare,
  ShieldCheck,
  Zap,
  Loader2
} from "lucide-react";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<"Overview" | "Users" | "Chats" | "Analytics" | "Settings">("Overview");
  const router = useRouter();

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/admin/stats");
        if (res.status === 401) {
          router.push("/admin/login");
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setStats(data.stats);
        }
      } catch (err) {
        console.error("Failed to load stats");
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [router]);

  if (loading) {
     return (
        <div className="flex h-screen items-center justify-center bg-background text-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
        </div>
      );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-slate-500/30">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border/50 bg-card/30 backdrop-blur-md hidden md:flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
             <Image
              src="/rearvy-wordmark.svg"
              alt="Rearvy"
              width={120}
              height={28}
              className="h-7 w-auto dark:invert"
            />
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400 border border-slate-500/20">ADMIN</span>
          </div>
          
          <nav className="space-y-1.5">
            <NavItem icon={<LayoutDashboard size={18} />} label="Overview" active={currentTab === "Overview"} onClick={() => setCurrentTab("Overview")} />
            <NavItem icon={<Users size={18} />} label="Users" active={currentTab === "Users"} onClick={() => setCurrentTab("Users")} />
            <NavItem icon={<MessageSquare size={18} />} label="Chats" active={currentTab === "Chats"} onClick={() => setCurrentTab("Chats")} />
            <NavItem icon={<BarChart3 size={18} />} label="Analytics" active={currentTab === "Analytics"} onClick={() => setCurrentTab("Analytics")} />
            <div className="pt-4 mt-4 border-t border-border/50">
              <NavItem icon={<Settings size={18} />} label="Settings" active={currentTab === "Settings"} onClick={() => setCurrentTab("Settings")} />
              <NavItem icon={<LogOut size={18} />} label="Logout" danger onClick={() => router.push("/admin/login")} />
            </div>
          </nav>
        </div>
        
        <div className="mt-auto p-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={14} className="text-slate-400" />
              <span className="text-xs font-semibold text-white uppercase tracking-wider">System Health</span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full w-[94%] bg-gradient-to-r from-slate-400 to-slate-600"></div>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 text-right">94.8% Operational</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        {/* Header Decor */}
        <div className="absolute top-0 inset-x-0 h-64 -z-10 bg-gradient-to-b from-slate-600/5 via-slate-700/5 to-transparent"></div>

        {/* Header */}
        <header className="h-16 border-b border-border/50 bg-background/60 backdrop-blur flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-4 bg-muted/30 px-4 py-2 rounded-full border border-border/40 w-96 transition-all focus-within:border-slate-500/40">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search system logs..." className="bg-transparent border-none outline-none text-sm w-full placeholder:text-muted-foreground" />
          </div>
          
          <div className="flex items-center gap-4">
            <button className="p-2 rounded-xl hover:bg-muted/50 transition-colors relative border border-transparent hover:border-border/50">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span className="absolute top-2.5 right-2.5 h-1.5 w-1.5 bg-slate-500 rounded-full border-2 border-background"></span>
            </button>
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600/50 flex items-center justify-center text-[10px] font-bold text-white uppercase">
              SF
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-500/20 bg-slate-500/10 px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                {currentTab}
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-foreground flex items-center gap-3">
                {currentTab === "Overview" ? "Admin Panel" : currentTab}
              </h1>
            </div>
            <div className="flex items-center gap-2 bg-slate-500/5 text-slate-400 px-4 py-2 rounded-xl border border-slate-500/10 text-sm font-medium">
              <div className="h-2 w-2 bg-slate-500 rounded-full animate-pulse"></div>
              Session Active: Admin
            </div>
          </div>

          {currentTab === "Overview" && (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard title="Total Users" value={stats?.totalUsers?.toString() || "0"} change="+0%" icon={<Users className="text-slate-400" />} />
                <StatsCard title="Active Chats" value={stats?.activeChats?.toString() || "0"} change="+0%" icon={<MessageSquare className="text-slate-400" />} />
                <StatsCard title="Platform Revenue" value={`${stats?.currency === 'INR' ? '₹' : '$'}${stats?.revenue?.toLocaleString() || "0"}`} change="+0%" icon={<TrendingUp className="text-slate-400" />} />
                <StatsCard title="API Latency" value={stats?.latency || "124ms"} change="Stable" icon={<Zap className="text-slate-400" />} />
              </div>

              {/* Content Sections */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <section className="bg-card/40 border border-border/50 rounded-3xl p-6 backdrop-blur transition-all hover:bg-card/60">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-xl font-bold text-foreground">Critical Activities</h3>
                      <button className="text-slate-400 hover:text-foreground text-sm font-medium flex items-center gap-1 transition-colors">
                        Security Audit <ChevronRight size={14} />
                      </button>
                    </div>
                    <div className="space-y-2">
                      <ActivityItem user="Sinaan" action="Updated platform security" time="Just now" status="Admin" />
                      <ActivityItem user="System" action="Dashboard data synced" time="Recently" status="Success" />
                    </div>
                  </section>
                </div>

                <div className="space-y-8">
                  <section className="bg-gradient-to-br from-slate-800/20 to-card/50 border border-slate-700/30 rounded-3xl p-8 relative overflow-hidden group hover:bg-slate-800/30 transition-all">
                    <div className="absolute -top-12 -right-12 p-4 opacity-[0.03] group-hover:scale-110 transition-transform group-hover:rotate-12 duration-1000">
                      <ShieldCheck size={200} />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-3 relative z-10">Infrastructure</h3>
                    <p className="text-muted-foreground text-sm mb-8 relative z-10 leading-relaxed">All core services are operating within normal parameters.</p>
                    <div className="space-y-5 relative z-10">
                      <StatusIndicator label="API Engine" status="Healthy" />
                      <StatusIndicator label="Database Cluster" status="Healthy" />
                      <StatusIndicator label="AI Generation" status="Healthy" />
                    </div>
                  </section>
                </div>
              </div>
            </>
          )}

          {currentTab === "Users" && (
            <div className="bg-card/40 border border-border/50 rounded-3xl p-8 backdrop-blur text-center py-20">
              <Users className="h-12 w-12 mx-auto mb-4 text-slate-500/50" />
              <h3 className="text-xl font-bold">User Management</h3>
              <p className="text-muted-foreground mt-2 max-w-md mx-auto">This section is currently being populated with real-time user metrics and access control tools.</p>
            </div>
          )}

          {currentTab === "Chats" && (
            <div className="bg-card/40 border border-border/50 rounded-3xl p-8 backdrop-blur text-center py-20">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-slate-500/50" />
              <h3 className="text-xl font-bold">Live Conversations</h3>
              <p className="text-muted-foreground mt-2 max-w-md mx-auto">Real-time monitoring of AI interactions and support requests will appear here.</p>
            </div>
          )}

          {(currentTab === "Analytics" || currentTab === "Settings") && (
            <div className="bg-card/40 border border-border/50 rounded-3xl p-8 backdrop-blur text-center py-20">
              <Zap className="h-12 w-12 mx-auto mb-4 text-slate-500/50" />
              <h3 className="text-xl font-bold">{currentTab}</h3>
              <p className="text-muted-foreground mt-2 max-w-md mx-auto">Module under construction. Check back soon for advanced {currentTab.toLowerCase()} tools.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active = false, danger = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, danger?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-all group ${
      active 
        ? "bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-lg shadow-slate-900/20" 
        : danger 
          ? "text-muted-foreground hover:text-red-400 hover:bg-red-500/10" 
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
    }`}>
      <span className={active ? "text-white" : "text-muted-foreground group-hover:text-foreground transition-colors"}>{icon}</span>
      <span>{label}</span>
      {active && <div className="ml-auto h-1 w-1 bg-white rounded-full"></div>}
    </button>
  );
}

function StatsCard({ title, value, change, icon }: { title: string, value: string, change: string, icon: React.ReactNode }) {
  const isPositive = change.startsWith("+");
  return (
    <div className="bg-card/40 border border-border/50 rounded-3xl p-6 hover:border-slate-500/30 transition-all group backdrop-blur hover:bg-card/60">
      <div className="flex items-center justify-between mb-5">
        <div className="p-2.5 rounded-xl bg-muted/50 border border-border/50 text-foreground group-hover:bg-slate-700 group-hover:text-white transition-all group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-slate-900/10">
          {icon}
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
          isPositive 
            ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400" 
            : "border-slate-500/20 bg-slate-500/5 text-slate-400"
        }`}>
          {change}
        </span>
      </div>
      <h3 className="text-muted-foreground text-xs font-bold uppercase tracking-widest mb-1">{title}</h3>
      <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
    </div>
  );
}

function ActivityItem({ user, action, time, status }: { user: string, action: string, time: string, status: string }) {
  return (
    <div className="flex items-center gap-5 py-4 border-b border-border/30 last:border-0 hover:bg-muted/10 px-2 rounded-2xl transition-all">
      <div className="h-10 w-10 shrink-0 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center font-bold text-white text-sm shadow-inner overflow-hidden">
        {user[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">
          {user} <span className="text-muted-foreground font-normal ml-1">{action}</span>
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{time}</p>
      </div>
      <span className="shrink-0 text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-lg bg-muted text-muted-foreground border border-border/50">
        {status}
      </span>
    </div>
  );
}

function StatusIndicator({ label, status }: { label: string, status: string }) {
  return (
    <div className="flex items-center justify-between text-xs py-1 border-b border-border/10 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="h-1 w-1 bg-emerald-400 rounded-full animate-pulse"></span>
        <span className="text-emerald-400 font-bold uppercase tracking-wider">{status}</span>
      </div>
    </div>
  );
}
