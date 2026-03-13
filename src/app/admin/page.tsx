import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
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
  ShieldCheck
} from "lucide-react";

export default async function AdminDashboardPage() {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    redirect("/admin/login");
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/50 backdrop-blur-md hidden md:flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">Rearvy Admin</span>
          </div>
          
          <nav className="space-y-1">
            <NavItem icon={<LayoutDashboard size={20} />} label="Overview" active />
            <NavItem icon={<Users size={20} />} label="Users" />
            <NavItem icon={<MessageSquare size={20} />} label="Chats" />
            <NavItem icon={<BarChart3 size={20} />} label="Analytics" />
            <div className="pt-4 mt-4 border-t border-slate-800">
              <NavItem icon={<Settings size={20} />} label="Settings" />
              <NavItem icon={<LogOut size={20} />} label="Logout" danger />
            </div>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/30 backdrop-blur-sm flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-4 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700 w-96 transform hover:scale-[1.01] transition-all">
            <Search className="h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search data..." className="bg-transparent border-none outline-none text-sm w-full placeholder:text-slate-500" />
          </div>
          
          <div className="flex items-center gap-4">
            <button className="p-2 rounded-full hover:bg-slate-800 transition-colors relative">
              <Bell className="h-5 w-5 text-slate-400" />
              <span className="absolute top-2 right-2 h-2 w-2 bg-indigo-500 rounded-full border border-slate-900"></span>
            </button>
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 border border-slate-700"></div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="text-sm font-medium text-slate-400 mb-1">DASHBOARD</h2>
              <h1 className="text-3xl font-bold text-white uppercase tracking-tight">System Overview</h1>
            </div>
            <div className="flex items-center gap-2 bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-lg border border-indigo-500/20 text-sm font-medium animate-pulse">
              <div className="h-2 w-2 bg-indigo-400 rounded-full"></div>
              Live Monitoring Active
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <StatsCard title="Total Users" value="1,248" change="+12.5%" icon={<Users className="text-indigo-400" />} />
            <StatsCard title="Active Chats" value="48" change="+5.2%" icon={<MessageSquare className="text-purple-400" />} />
            <StatsCard title="Platform Revenue" value="$4,830" change="+18.7%" icon={<TrendingUp className="text-emerald-400" />} />
            <StatsCard title="Server Load" value="14.2%" change="-2.1%" icon={<BarChart3 className="text-amber-400" />} />
          </div>

          {/* Content Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white">Recent Activities</h3>
                  <button className="text-indigo-400 hover:text-indigo-300 text-sm font-medium flex items-center gap-1">
                    View all <ChevronRight size={14} />
                  </button>
                </div>
                <div className="space-y-4">
                  <ActivityItem user="Sinaan" action="Updated platform security" time="2 mins ago" status="Admin" />
                  <ActivityItem user="John Doe" action="Started new Shopify sync" time="15 mins ago" status="Success" />
                  <ActivityItem user="Emily Chen" action="Integrated Instagram" time="1 hour ago" status="Integration" />
                </div>
              </section>
            </div>

            <div className="space-y-8">
              <section className="bg-gradient-to-br from-indigo-900/40 to-slate-900 border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                  <ShieldCheck size={120} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 relative z-10">System Status</h3>
                <p className="text-slate-400 text-sm mb-6 relative z-10">All core services are operating within normal parameters.</p>
                <div className="space-y-3 relative z-10">
                  <StatusIndicator label="API Engine" status="Healthy" />
                  <StatusIndicator label="Database Cluster" status="Healthy" />
                  <StatusIndicator label="AI Generation" status="Healthy" />
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active = false, danger = false }: { icon: React.ReactNode, label: string, active?: boolean, danger?: boolean }) {
  return (
    <button className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
      active 
        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
        : danger 
          ? "text-slate-400 hover:text-red-400 hover:bg-red-500/10" 
          : "text-slate-400 hover:text-white hover:bg-slate-800"
    }`}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function StatsCard({ title, value, change, icon }: { title: string, value: string, change: string, icon: React.ReactNode }) {
  const isPositive = change.startsWith("+");
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 rounded-lg bg-slate-800 text-white group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${isPositive ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
          {change}
        </span>
      </div>
      <h3 className="text-slate-400 text-sm font-medium mb-1">{title}</h3>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function ActivityItem({ user, action, time, status }: { user: string, action: string, time: string, status: string }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-slate-800/50 last:border-0 hover:bg-slate-800/20 px-2 rounded-lg transition-colors">
      <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-indigo-400">
        {user[0]}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-white">{user} <span className="text-slate-400 font-normal">{action}</span></p>
        <p className="text-xs text-slate-500">{time}</p>
      </div>
      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">
        {status}
      </span>
    </div>
  );
}

function StatusIndicator({ label, status }: { label: string, status: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-emerald-400 font-medium">{status}</span>
    </div>
  );
}
