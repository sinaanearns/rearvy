"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  KeyRound,
  Layers,
  Lightbulb,
  Lock,
  LogOut,
  Mail,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  XCircle,
} from "lucide-react";
import type { BusinessRegistration, FeatureRequest } from "@/lib/firebase/schema";

const STORAGE_KEY = "rearvy_admin_key";

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState<string>("");
  const [inputKey, setInputKey] = useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<"registrations" | "features">("registrations");
  const [registrations, setRegistrations] = useState<BusinessRegistration[]>([]);
  const [featureRequests, setFeatureRequests] = useState<FeatureRequest[]>([]);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // New feature request modal state for admin
  const [showAddFeatureModal, setShowAddFeatureModal] = useState<boolean>(false);
  const [newFeatureTitle, setNewFeatureTitle] = useState<string>("");
  const [newFeatureDesc, setNewFeatureDesc] = useState<string>("");
  const [newFeatureCategory, setNewFeatureCategory] = useState<string>("general");
  const [addFeatureLoading, setAddFeatureLoading] = useState<boolean>(false);

  const fetchData = useCallback(
    async (key: string) => {
      setIsRefreshing(true);
      try {
        const [regRes, featRes] = await Promise.all([
          fetch("/api/admin/registrations", {
            headers: { Authorization: `Bearer ${key}` },
          }),
          fetch("/api/feature-requests", {
            headers: { Authorization: `Bearer ${key}` },
          }),
        ]);

        if (!regRes.ok || !featRes.ok) {
          if (regRes.status === 401 || featRes.status === 401) {
            throw new Error("Invalid admin password.");
          }
          throw new Error("Failed to fetch admin data.");
        }

        const regData = (await regRes.json()) as { items: BusinessRegistration[] };
        const featData = (await featRes.json()) as { items: FeatureRequest[] };

        setRegistrations(regData.items || []);
        setFeatureRequests(featData.items || []);
        setIsAuthenticated(true);
        setAuthError(null);
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : "Authentication failed.");
        setIsAuthenticated(false);
      } finally {
        setIsRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    const savedKey = sessionStorage.getItem(STORAGE_KEY);
    if (savedKey) {
      setAdminKey(savedKey);
      void fetchData(savedKey);
    }
  }, [fetchData]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!inputKey.trim()) return;
    setLoading(true);
    setAuthError(null);
    const key = inputKey.trim();
    fetchData(key).then(() => {
      if (sessionStorage.getItem(STORAGE_KEY) || key) {
        sessionStorage.setItem(STORAGE_KEY, key);
        setAdminKey(key);
      }
      setLoading(false);
    });
  }

  function handleLogout() {
    sessionStorage.removeItem(STORAGE_KEY);
    setAdminKey("");
    setInputKey("");
    setIsAuthenticated(false);
  }

  async function updateRegistrationStatus(id: string, newStatus: BusinessRegistration["status"]) {
    try {
      const res = await fetch("/api/admin/registrations", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminKey}`,
        },
        body: JSON.stringify({ id, status: newStatus }),
      });

      if (!res.ok) throw new Error("Failed to update status.");

      setRegistrations((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error updating status");
    }
  }

  async function updateFeatureStatus(id: string, newStatus: FeatureRequest["status"]) {
    try {
      const res = await fetch("/api/feature-requests", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminKey}`,
        },
        body: JSON.stringify({ id, status: newStatus }),
      });

      if (!res.ok) throw new Error("Failed to update feature status.");

      setFeatureRequests((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error updating feature request");
    }
  }

  async function handleAddFeature(e: React.FormEvent) {
    e.preventDefault();
    if (!newFeatureTitle || !newFeatureDesc) return;
    setAddFeatureLoading(true);

    try {
      const res = await fetch("/api/feature-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newFeatureTitle,
          description: newFeatureDesc,
          category: newFeatureCategory,
          userEmail: "admin@rearvy.com",
        }),
      });

      if (!res.ok) throw new Error("Failed to create feature request.");

      setNewFeatureTitle("");
      setNewFeatureDesc("");
      setShowAddFeatureModal(false);
      void fetchData(adminKey);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error creating feature request");
    } finally {
      setAddFeatureLoading(false);
    }
  }

  // Filtered registrations
  const filteredRegistrations = registrations.filter((item) => {
    const matchesSearch =
      item.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.gmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.about && item.about.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filtered features
  const filteredFeatures = featureRequests.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Password Login Screen
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#030508] text-white flex items-center justify-center p-4 selection:bg-[#69d7ff] selection:text-black">
        <div className="w-full max-w-md rounded-[12px] border border-white/12 bg-black/60 p-8 shadow-2xl backdrop-blur-2xl">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-[12px] border border-[#69d7ff]/30 bg-[#69d7ff]/10 text-[#69d7ff]">
              <Lock className="h-7 w-7" />
            </div>
          </div>
          <h1 className="mt-5 text-center text-2xl font-bold tracking-tight text-white">
            Rearvy Admin Console
          </h1>
          <p className="mt-2 text-center text-xs text-white/60">
            Enter the admin authorization key to access dashboard submissions and feature requests.
          </p>

          <form onSubmit={handleLogin} className="mt-6 grid gap-4">
            <div className="grid gap-2">
              <label htmlFor="adminKey" className="text-xs font-semibold text-white/80 flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-[#69d7ff]" />
                Admin Secret Key
              </label>
              <input
                id="adminKey"
                type="password"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="Enter password..."
                required
                className="w-full rounded-[8px] border border-white/16 bg-white/[0.05] px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-[#69d7ff] focus:outline-none focus:ring-1 focus:ring-[#69d7ff]"
              />
            </div>

            {authError && (
              <div className="rounded-[8px] border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 text-red-400" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex min-h-11 items-center justify-center rounded-[8px] bg-white font-semibold text-black transition hover:bg-cyan-50"
            >
              {loading ? "Authenticating..." : "Unlock Dashboard"}
            </button>

            <div className="text-center">
              <Link href="/" className="text-xs text-white/40 hover:text-white/70 transition">
                &larr; Back to Public Home
              </Link>
            </div>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#030508] text-white selection:bg-[#69d7ff] selection:text-black">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#06090e]/80 backdrop-blur-xl px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="Rearvy Admin">
              <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-white text-black font-bold text-lg">
                R
              </div>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-tight">Rearvy Executive Admin</h1>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                  Live
                </span>
              </div>
              <p className="text-xs text-white/50">Manage business submissions & user feature requests</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => void fetchData(adminKey)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 rounded-[8px] border border-white/16 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10 transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-[8px] border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20 transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              Lock
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Metric Cards Summary */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="rounded-[10px] border border-white/12 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between text-white/50">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Registrations</span>
              <Building2 className="h-4 w-4 text-[#69d7ff]" />
            </div>
            <p className="mt-3 text-3xl font-bold text-white">{registrations.length}</p>
            <p className="mt-1 text-xs text-white/40">From business priority form</p>
          </div>

          <div className="rounded-[10px] border border-[#69d7ff]/30 bg-[#69d7ff]/5 p-5">
            <div className="flex items-center justify-between text-[#69d7ff]">
              <span className="text-xs font-semibold uppercase tracking-wider">New Submissions</span>
              <Sparkles className="h-4 w-4 text-[#69d7ff]" />
            </div>
            <p className="mt-3 text-3xl font-bold text-white">
              {registrations.filter((r) => r.status === "new" || !r.status).length}
            </p>
            <p className="mt-1 text-xs text-[#69d7ff]/70">Require executive review</p>
          </div>

          <div className="rounded-[10px] border border-white/12 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between text-white/50">
              <span className="text-xs font-semibold uppercase tracking-wider">Feature Requests</span>
              <Lightbulb className="h-4 w-4 text-[#f7c948]" />
            </div>
            <p className="mt-3 text-3xl font-bold text-white">{featureRequests.length}</p>
            <p className="mt-1 text-xs text-white/40">User feature ideas</p>
          </div>

          <div className="rounded-[10px] border border-emerald-500/30 bg-emerald-500/5 p-5">
            <div className="flex items-center justify-between text-emerald-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Approved Businesses</span>
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="mt-3 text-3xl font-bold text-white">
              {registrations.filter((r) => r.status === "approved").length}
            </p>
            <p className="mt-1 text-xs text-emerald-400/70">Ready for priority onboarding</p>
          </div>
        </div>

        {/* Tab Selection + Search & Filters Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="inline-flex rounded-[8px] border border-white/12 bg-black/40 p-1">
            <button
              onClick={() => {
                setActiveTab("registrations");
                setStatusFilter("all");
              }}
              className={`inline-flex items-center gap-2 rounded-[6px] px-4 py-2 text-xs font-semibold transition ${
                activeTab === "registrations"
                  ? "bg-white text-black shadow-sm"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              Business Submissions ({registrations.length})
            </button>
            <button
              onClick={() => {
                setActiveTab("features");
                setStatusFilter("all");
              }}
              className={`inline-flex items-center gap-2 rounded-[6px] px-4 py-2 text-xs font-semibold transition ${
                activeTab === "features"
                  ? "bg-white text-black shadow-sm"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <Lightbulb className="h-3.5 w-3.5" />
              Feature Requests ({featureRequests.length})
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 sm:w-64 rounded-[8px] border border-white/12 bg-white/[0.05] pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-white/40 focus:border-[#69d7ff] focus:outline-none"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-[8px] border border-white/12 bg-[#0a0f16] px-3 py-1.5 text-xs text-white focus:border-[#69d7ff] focus:outline-none"
            >
              <option value="all">All Statuses</option>
              {activeTab === "registrations" ? (
                <>
                  <option value="new">New</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="contacted">Contacted</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </>
              ) : (
                <>
                  <option value="open">Open</option>
                  <option value="under_review">Under Review</option>
                  <option value="planned">Planned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="closed">Closed</option>
                </>
              )}
            </select>

            {activeTab === "features" && (
              <button
                onClick={() => setShowAddFeatureModal(true)}
                className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#69d7ff] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#85deff] transition"
              >
                + Add Feature
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: Business Registrations Table */}
        {activeTab === "registrations" && (
          <div className="rounded-[12px] border border-white/12 bg-black/40 overflow-hidden shadow-2xl backdrop-blur-xl">
            {filteredRegistrations.length === 0 ? (
              <div className="p-12 text-center text-white/50">
                <Building2 className="mx-auto h-8 w-8 text-white/20 mb-3" />
                <p className="text-sm font-semibold">No business submissions found</p>
                <p className="text-xs text-white/35 mt-1">
                  Submissions from the business priority form will appear here in real-time.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/8">
                {filteredRegistrations.map((item) => {
                  const isExpanded = expandedId === item.id;
                  const status = item.status || "new";

                  return (
                    <div key={item.id} className="p-5 hover:bg-white/[0.02] transition">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3.5 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-white/16 bg-white/[0.05] text-[#69d7ff]">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2.5">
                              <h3 className="font-semibold text-white truncate text-base">
                                {item.businessName}
                              </h3>
                              <StatusBadge status={status} />
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-xs text-white/60 flex-wrap">
                              <span className="flex items-center gap-1 text-cyan-200">
                                <Mail className="h-3.5 w-3.5" />
                                {item.gmail}
                              </span>
                              <span>&bull;</span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-white/40" />
                                {new Date(item.submittedAt).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          {/* Quick Status Control Dropdown */}
                          <select
                            value={status}
                            onChange={(e) =>
                              updateRegistrationStatus(item.id!, e.target.value as BusinessRegistration["status"])
                            }
                            className="rounded-[6px] border border-white/16 bg-[#0f141d] px-2.5 py-1 text-xs text-white focus:border-[#69d7ff] focus:outline-none"
                          >
                            <option value="new">New</option>
                            <option value="reviewed">Reviewed</option>
                            <option value="contacted">Contacted</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>

                          <button
                            onClick={() => setExpandedId(isExpanded ? null : item.id!)}
                            className="inline-flex items-center gap-1 rounded-[6px] border border-white/12 bg-white/[0.05] px-3 py-1 text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 transition"
                          >
                            {isExpanded ? "Less" : "Details"}
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded Submission Details */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-white/8 grid gap-4 sm:grid-cols-2 text-xs">
                          {item.about && (
                            <div className="rounded-[8px] border border-white/8 bg-white/[0.02] p-3">
                              <p className="font-semibold text-[#69d7ff] mb-1">About the Business:</p>
                              <p className="text-white/80 whitespace-pre-wrap leading-relaxed">{item.about}</p>
                            </div>
                          )}

                          {item.hopes && (
                            <div className="rounded-[8px] border border-white/8 bg-white/[0.02] p-3">
                              <p className="font-semibold text-[#f7c948] mb-1">Hopes from Rearvy:</p>
                              <p className="text-white/80 whitespace-pre-wrap leading-relaxed">{item.hopes}</p>
                            </div>
                          )}

                          {item.thingsToImplement && (
                            <div className="rounded-[8px] border border-white/8 bg-white/[0.02] p-3">
                              <p className="font-semibold text-emerald-400 mb-1">Things to Implement:</p>
                              <p className="text-white/80 whitespace-pre-wrap leading-relaxed">{item.thingsToImplement}</p>
                            </div>
                          )}

                          {item.featuresWanted && (
                            <div className="rounded-[8px] border border-white/8 bg-white/[0.02] p-3">
                              <p className="font-semibold text-purple-400 mb-1">Features Wanted:</p>
                              <p className="text-white/80 whitespace-pre-wrap leading-relaxed">{item.featuresWanted}</p>
                            </div>
                          )}

                          {item.plannedUse && (
                            <div className="sm:col-span-2 rounded-[8px] border border-white/8 bg-white/[0.02] p-3">
                              <p className="font-semibold text-white/60 mb-1">Full Submission Text:</p>
                              <p className="text-white/70 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                                {item.plannedUse}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Feature Requests List */}
        {activeTab === "features" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredFeatures.length === 0 ? (
              <div className="sm:col-span-2 lg:col-span-3 rounded-[12px] border border-white/12 bg-black/40 p-12 text-center text-white/50">
                <Lightbulb className="mx-auto h-8 w-8 text-white/20 mb-3" />
                <p className="text-sm font-semibold">No feature requests found</p>
                <p className="text-xs text-white/35 mt-1">
                  User submitted features or requested capabilities will be listed here.
                </p>
              </div>
            ) : (
              filteredFeatures.map((feat) => (
                <div
                  key={feat.id}
                  className="rounded-[10px] border border-white/12 bg-black/40 p-5 flex flex-col justify-between hover:border-white/24 transition"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-semibold text-white/60 uppercase">
                        {feat.category || "general"}
                      </span>
                      <FeatureStatusBadge status={feat.status} />
                    </div>

                    <h3 className="mt-3 text-base font-semibold text-white leading-snug">{feat.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-white/70 line-clamp-4">{feat.description}</p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-white/8 flex items-center justify-between text-xs">
                    <div className="text-white/40">
                      {feat.userEmail ? (
                        <span className="truncate block max-w-[150px]">{feat.userEmail}</span>
                      ) : (
                        <span>Anonymous</span>
                      )}
                    </div>

                    <select
                      value={feat.status}
                      onChange={(e) => updateFeatureStatus(feat.id!, e.target.value as FeatureRequest["status"])}
                      className="rounded-[6px] border border-white/16 bg-[#0f141d] px-2 py-1 text-[11px] text-white focus:border-[#69d7ff] focus:outline-none"
                    >
                      <option value="open">Open</option>
                      <option value="under_review">Under Review</option>
                      <option value="planned">Planned</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal: Add Feature Request */}
      {showAddFeatureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[12px] border border-white/16 bg-[#090d14] p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-[#f7c948]" />
              Add Feature Request
            </h2>
            <p className="mt-1 text-xs text-white/60">Log a feature request or internal idea to track.</p>

            <form onSubmit={handleAddFeature} className="mt-5 grid gap-4">
              <div>
                <label className="text-xs font-semibold text-white/80">Title</label>
                <input
                  type="text"
                  value={newFeatureTitle}
                  onChange={(e) => setNewFeatureTitle(e.target.value)}
                  placeholder="e.g. Export reports to PDF"
                  required
                  className="mt-1 w-full rounded-[8px] border border-white/16 bg-white/[0.05] px-3.5 py-2 text-xs text-white placeholder:text-white/35 focus:border-[#69d7ff] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-white/80">Category</label>
                <select
                  value={newFeatureCategory}
                  onChange={(e) => setNewFeatureCategory(e.target.value)}
                  className="mt-1 w-full rounded-[8px] border border-white/16 bg-[#0f141d] px-3.5 py-2 text-xs text-white focus:border-[#69d7ff] focus:outline-none"
                >
                  <option value="general">General</option>
                  <option value="integrations">Integrations</option>
                  <option value="automations">Automations</option>
                  <option value="desktop">Desktop Shell</option>
                  <option value="ui_ux">UI / UX</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-white/80">Description</label>
                <textarea
                  value={newFeatureDesc}
                  onChange={(e) => setNewFeatureDesc(e.target.value)}
                  placeholder="Describe the requested capability..."
                  rows={4}
                  required
                  className="mt-1 w-full rounded-[8px] border border-white/16 bg-white/[0.05] px-3.5 py-2 text-xs text-white placeholder:text-white/35 focus:border-[#69d7ff] focus:outline-none"
                />
              </div>

              <div className="mt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddFeatureModal(false)}
                  className="rounded-[8px] border border-white/16 px-4 py-2 text-xs font-semibold text-white/70 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addFeatureLoading}
                  className="rounded-[8px] bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-cyan-50 transition"
                >
                  {addFeatureLoading ? "Saving..." : "Add Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: BusinessRegistration["status"] }) {
  switch (status) {
    case "approved":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
          <CheckCircle2 className="h-3 w-3" /> Approved
        </span>
      );
    case "contacted":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-cyan-300">
          <Mail className="h-3 w-3" /> Contacted
        </span>
      );
    case "reviewed":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-purple-300">
          <UserCheck className="h-3 w-3" /> Reviewed
        </span>
      );
    case "rejected":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-red-400">
          <XCircle className="h-3 w-3" /> Rejected
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-[#69d7ff]/30 bg-[#69d7ff]/10 px-2.5 py-0.5 text-[10px] font-semibold text-[#69d7ff]">
          <Sparkles className="h-3 w-3" /> New
        </span>
      );
  }
}

function FeatureStatusBadge({ status }: { status: FeatureRequest["status"] }) {
  switch (status) {
    case "completed":
      return (
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
          Completed
        </span>
      );
    case "in_progress":
      return (
        <span className="rounded-full border border-[#69d7ff]/30 bg-[#69d7ff]/10 px-2 py-0.5 text-[10px] font-semibold text-[#69d7ff]">
          In Progress
        </span>
      );
    case "planned":
      return (
        <span className="rounded-full border border-[#f7c948]/30 bg-[#f7c948]/10 px-2 py-0.5 text-[10px] font-semibold text-[#f7c948]">
          Planned
        </span>
      );
    case "under_review":
      return (
        <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
          Under Review
        </span>
      );
    case "closed":
      return (
        <span className="rounded-full border border-white/12 bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold text-white/40">
          Closed
        </span>
      );
    default:
      return (
        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
          Open
        </span>
      );
  }
}
