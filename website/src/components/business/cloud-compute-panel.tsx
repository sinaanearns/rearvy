"use client";

import { useState, useEffect } from "react";
import {
  Cpu,
  Server,
  Play,
  Pause,
  RefreshCw,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Terminal,
  Activity,
  Zap,
  Globe,
  Sliders,
  Shield,
  Trash2,
  Loader2,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface AutonomousCloudJob {
  id: string;
  name: string;
  schedule: string;
  targetService: string;
  status: "running" | "active" | "paused" | "completed";
  lastRunAt: string;
  nextRunAt: string;
  executionCount: number;
  memoryTier: "Standard (2 vCPU, 4GB)" | "High-Compute (4 vCPU, 8GB)";
  logs: string[];
}

const INITIAL_CLOUD_JOBS: AutonomousCloudJob[] = [
  {
    id: "job-1",
    name: "Competitor Pricing & Inventory Scraper",
    schedule: "Daily @ 03:00 UTC",
    targetService: "Supplier & Competitor Web Portals",
    status: "active",
    lastRunAt: "Today at 03:00 UTC (Took 42s)",
    nextRunAt: "Tomorrow at 03:00 UTC",
    executionCount: 28,
    memoryTier: "Standard (2 vCPU, 4GB)",
    logs: [
      "[03:00:01 UTC] [Cloud Runner VM-104] Initialized headless Chromium sandbox.",
      "[03:00:04 UTC] [Browser-Use] Navigated to supplier portal #1 (Authenticated via encrypted session).",
      "[03:00:12 UTC] [Extractor] Scraped 142 SKUs, detected 3 price updates.",
      "[03:00:25 UTC] [Rearvy RAG] Updated internal inventory knowledge base doc #inv-2026.",
      "[03:00:42 UTC] [Execution Complete] Job finished successfully with 0 errors.",
    ],
  },
  {
    id: "job-2",
    name: "Inbound Lead Qualification & CRM Sync",
    schedule: "Hourly (:00)",
    targetService: "HubSpot CRM & Email Webhooks",
    status: "active",
    lastRunAt: "24 mins ago (Took 14s)",
    nextRunAt: "In 36 mins",
    executionCount: 312,
    memoryTier: "Standard (2 vCPU, 4GB)",
    logs: [
      "[12:00:00 UTC] [Cloud Runner VM-102] Checked inbound lead queue (3 new entries).",
      "[12:00:05 UTC] [AI Brain] Scored lead intent: Lead #1 (Score 92/100, High Priority).",
      "[12:00:09 UTC] [Connector] Drafted personalized follow-up brief and queued in review dashboard.",
      "[12:00:14 UTC] [Execution Complete] 3 leads processed, 1 VIP notification sent.",
    ],
  },
  {
    id: "job-3",
    name: "Nightly Financial Reconciliation & Payout Alert",
    schedule: "Every Sunday @ 23:00 UTC",
    targetService: "Stripe & Mercury API Connectors",
    status: "active",
    lastRunAt: "Aug 17 at 23:00 UTC (Took 18s)",
    nextRunAt: "Sunday at 23:00 UTC",
    executionCount: 14,
    memoryTier: "Standard (2 vCPU, 4GB)",
    logs: [
      "[23:00:00 UTC] [Cloud Runner VM-108] Queried weekly Stripe gross volume ($14,280.00).",
      "[23:00:06 UTC] [Connector] Matched 48 settled invoices against Mercury treasury ledger.",
      "[23:00:18 UTC] [Execution Complete] Zero discrepancy found. Weekly digest generated.",
    ],
  },
];

export function CloudComputePanel() {
  const [jobs, setJobs] = useState<AutonomousCloudJob[]>(INITIAL_CLOUD_JOBS);
  const [selectedJob, setSelectedJob] = useState<AutonomousCloudJob | null>(null);
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);
  const [newJobName, setNewJobName] = useState("");
  const [newJobSchedule, setNewJobSchedule] = useState("Daily @ 08:00 UTC");
  const [newJobTarget, setNewJobTarget] = useState("");
  const [newJobTier, setNewJobTier] = useState<"Standard (2 vCPU, 4GB)" | "High-Compute (4 vCPU, 8GB)">("Standard (2 vCPU, 4GB)");
  const [isDeploying, setIsDeploying] = useState(false);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);

  // Compute stats
  const usedHours = 14.8;
  const totalHours = 50.0;
  const percentage = Math.round((usedHours / totalHours) * 100);

  const handleToggleJob = (jobId: string) => {
    setJobs((prev) =>
      prev.map((job) => {
        if (job.id === jobId) {
          const nextStatus = job.status === "active" ? "paused" : "active";
          toast.success(`Autonomous job "${job.name}" is now ${nextStatus}.`);
          return { ...job, status: nextStatus };
        }
        return job;
      })
    );
  };

  const handleRunNow = (job: AutonomousCloudJob) => {
    setRunningJobId(job.id);
    toast.info(`Triggering cloud sandbox runner for "${job.name}"...`);
    
    setTimeout(() => {
      setRunningJobId(null);
      const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC";
      const newLog = `[${timestamp}] [Manual Trigger] Cloud sandbox executed successfully in 12.4s.`;
      
      setJobs((prev) =>
        prev.map((j) => {
          if (j.id === job.id) {
            return {
              ...j,
              lastRunAt: "Just now (Took 12.4s)",
              executionCount: j.executionCount + 1,
              logs: [newLog, ...j.logs.slice(0, 10)],
            };
          }
          return j;
        })
      );
      toast.success(`Cloud execution completed for "${job.name}".`);
    }, 1800);
  };

  const handleDeleteJob = (jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    if (selectedJob?.id === jobId) setSelectedJob(null);
    toast.success("Autonomous cloud worker job deleted.");
  };

  const handleCreateJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobName.trim()) {
      toast.error("Please enter a job name.");
      return;
    }
    setIsDeploying(true);

    setTimeout(() => {
      const newJob: AutonomousCloudJob = {
        id: `job-${Date.now()}`,
        name: newJobName.trim(),
        schedule: newJobSchedule,
        targetService: newJobTarget.trim() || "Custom Web / SaaS Connector",
        status: "active",
        lastRunAt: "Scheduled (Never run)",
        nextRunAt: "Next scheduled trigger",
        executionCount: 0,
        memoryTier: newJobTier,
        logs: [
          `[${new Date().toISOString()}] Cloud sandbox container provisioned in cluster us-east-1.`,
          `[${new Date().toISOString()}] Awaiting first scheduled trigger: ${newJobSchedule}.`,
        ],
      };

      setJobs((prev) => [newJob, ...prev]);
      setIsDeploying(false);
      setIsProvisionModalOpen(false);
      setNewJobName("");
      setNewJobTarget("");
      toast.success(`Autonomous cloud job "${newJob.name}" deployed to 24/7 cluster!`);
    }, 1200);
  };

  return (
    <section className="space-y-6">
      {/* Top Banner / Compute Telemetry Overview */}
      <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-transparent p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.08] text-white shadow-inner">
              <Cpu className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-white">Autonomous Cloud Compute & Sandboxes</h2>
                <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs">
                  24/7 Cloud Cluster
                </Badge>
              </div>
              <p className="mt-1 text-xs leading-5 text-white/65 max-w-2xl">
                Deploy headless browser agents and autonomous AI workers to dedicated cloud sandboxes. 
                Execute web scraping, CRM enrichment, and automated workflows 24/7 without keeping your computer on.
              </p>
            </div>
          </div>

          <Button
            onClick={() => setIsProvisionModalOpen(true)}
            className="shrink-0 rounded-xl bg-white font-semibold text-xs text-black shadow-lg shadow-black/40 hover:bg-white/90"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Deploy Cloud Worker
          </Button>
        </div>

        {/* Telemetry Metrics Grid */}
        <div className="mt-6 grid gap-4 border-t border-white/[0.08] pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-black/50 p-4">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>Cloud Execution Hours</span>
              <Zap className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">{usedHours} hrs</span>
              <span className="text-xs text-white/40">/ {totalHours} hrs limit</span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-cyan-400 transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/50 p-4">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>Active Cloud Sandboxes</span>
              <Server className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="mt-2 text-2xl font-bold text-white">
              {jobs.filter((j) => j.status === "active").length} Running
            </p>
            <p className="mt-1 text-[11px] text-white/50">Across us-east & eu-central clusters</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/50 p-4">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>Autonomous Executions</span>
              <Activity className="h-4 w-4 text-indigo-400" />
            </div>
            <p className="mt-2 text-2xl font-bold text-white">
              {jobs.reduce((acc, curr) => acc + curr.executionCount, 0)} Total
            </p>
            <p className="mt-1 text-[11px] text-white/50">99.8% execution success rate</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/50 p-4">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>Sandboxed Isolation</span>
              <Shield className="h-4 w-4 text-amber-400" />
            </div>
            <p className="mt-2 text-2xl font-bold text-white">Ephemeral VM</p>
            <p className="mt-1 text-[11px] text-white/50">Isolated memory & encrypted cookies</p>
          </div>
        </div>
      </div>

      {/* Cloud Jobs List & Terminal Logs Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Jobs List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Scheduled Cloud Autonomous Jobs</h3>
              <p className="text-xs text-white/55">Background workflows running independently on cloud compute</p>
            </div>
            <Badge variant="outline" className="border-white/15 text-xs text-white/70">
              {jobs.length} Configured
            </Badge>
          </div>

          <div className="space-y-3">
            {jobs.map((job) => (
              <article
                key={job.id}
                onClick={() => setSelectedJob(job)}
                className={cn(
                  "cursor-pointer rounded-2xl border p-4.5 transition-all backdrop-blur-xl",
                  selectedJob?.id === job.id
                    ? "border-cyan-400/40 bg-white/[0.06] shadow-lg shadow-cyan-950/20"
                    : "border-white/10 bg-[#0b0b0b]/80 hover:border-white/20 hover:bg-[#111111]"
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{job.name}</h4>
                      <Badge
                        className={cn(
                          "text-[10px] uppercase font-semibold",
                          job.status === "active"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                        )}
                      >
                        {job.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-white/60 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-white/40" />
                      <span>{job.schedule}</span>
                      <span className="text-white/30">·</span>
                      <span>Target: {job.targetService}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRunNow(job);
                      }}
                      disabled={runningJobId === job.id}
                      className="h-7 rounded-lg bg-white px-2.5 text-xs font-semibold text-black hover:bg-white/90"
                    >
                      {runningJobId === job.id ? (
                        <>
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Running...
                        </>
                      ) : (
                        <>
                          <Play className="mr-1 h-3 w-3 fill-black" /> Run Now
                        </>
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleJob(job.id);
                      }}
                      className="h-7 rounded-lg border-white/15 bg-white/[0.04] px-2 text-xs text-white/80 hover:bg-white/10"
                    >
                      {job.status === "active" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteJob(job.id);
                      }}
                      className="h-7 rounded-lg px-2 text-white/40 hover:bg-rose-500/10 hover:text-rose-400"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between border-t border-white/[0.06] pt-3 text-[11px] text-white/50">
                  <span>Last run: <strong className="text-white/80 font-normal">{job.lastRunAt}</strong></span>
                  <span>Executions: <strong className="text-white/80 font-normal">{job.executionCount} runs</strong></span>
                  <span>Tier: <strong className="text-white/80 font-normal">{job.memoryTier}</strong></span>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Right 1 Col: Live Worker Execution Terminal */}
        <div className="rounded-2xl border border-white/12 bg-[#060606] p-5 backdrop-blur-xl flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Live Worker Sandbox Logs</h3>
              </div>
              <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-[10px] text-cyan-400">
                Connected
              </Badge>
            </div>
            <p className="text-[11px] text-white/50">
              {selectedJob ? `Viewing logs for: ${selectedJob.name}` : "Select a job to inspect live stdout/stderr."}
            </p>
          </div>

          <div className="flex-1 min-h-64 max-h-96 overflow-y-auto rounded-xl border border-white/10 bg-black/90 p-3.5 font-mono text-[11px] leading-5 text-white/80 space-y-1.5 selection:bg-cyan-500/30">
            {selectedJob ? (
              selectedJob.logs.map((log, index) => (
                <div key={index} className="break-words">
                  <span className="text-cyan-400/80 mr-1.5">›</span>
                  {log}
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center text-white/40">
                <Terminal className="h-7 w-7 mb-2 opacity-30" />
                <p>Click any scheduled job to stream its execution logs and telemetry.</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-white/50 border-t border-white/[0.08] pt-3">
            <span>Runtime: <strong className="text-white/70 font-normal">Node.js + Chromium Headless</strong></span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Live
            </span>
          </div>
        </div>
      </div>

      {/* Provision New Cloud Job Modal */}
      <Dialog open={isProvisionModalOpen} onOpenChange={setIsProvisionModalOpen}>
        <DialogContent className="max-w-lg border-white/15 bg-[#0b0b0b] text-white p-6 shadow-2xl">
          <DialogHeader className="border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-cyan-400" />
              <DialogTitle className="text-lg font-bold text-white">Deploy Autonomous Cloud Worker</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-white/60">
              Provision a dedicated headless browser sandbox that runs scheduled business operations in the cloud.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateJob} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/80">Worker Task Name</label>
              <Input
                required
                value={newJobName}
                onChange={(e) => setNewJobName(e.target.value)}
                placeholder="e.g. Daily Amazon & Shopify Inventory Sync"
                className="border-white/10 bg-black/60 text-xs text-white focus-visible:border-white/35"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/80">Execution Schedule</label>
              <select
                value={newJobSchedule}
                onChange={(e) => setNewJobSchedule(e.target.value)}
                className="h-10 w-full rounded-lg border border-white/10 bg-black/60 px-3 text-xs text-white outline-none focus:border-white/35"
              >
                <option value="Hourly (:00)">Hourly (Every 60 minutes)</option>
                <option value="Daily @ 03:00 UTC">Daily @ 03:00 UTC (Nightly scan)</option>
                <option value="Daily @ 08:00 UTC">Daily @ 08:00 UTC (Morning briefing)</option>
                <option value="Every 12 Hours">Every 12 Hours (Twice daily)</option>
                <option value="Every Monday @ 09:00 UTC">Weekly (Monday 09:00 UTC)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/80">Target Web Service / Connector Brief</label>
              <Input
                value={newJobTarget}
                onChange={(e) => setNewJobTarget(e.target.value)}
                placeholder="e.g. https://supplier-portal.com or HubSpot Connector"
                className="border-white/10 bg-black/60 text-xs text-white focus-visible:border-white/35"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/80">Cloud Sandbox Compute Tier</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewJobTier("Standard (2 vCPU, 4GB)")}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-all",
                    newJobTier === "Standard (2 vCPU, 4GB)"
                      ? "border-cyan-400 bg-cyan-500/10 text-white"
                      : "border-white/10 bg-black/40 text-white/60 hover:bg-white/5"
                  )}
                >
                  <p className="text-xs font-bold">Standard Runner</p>
                  <p className="text-[11px] text-white/50 mt-0.5">2 vCPU · 4GB RAM</p>
                  <p className="text-[10px] text-cyan-400 mt-1">Included in Pro</p>
                </button>

                <button
                  type="button"
                  onClick={() => setNewJobTier("High-Compute (4 vCPU, 8GB)")}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-all",
                    newJobTier === "High-Compute (4 vCPU, 8GB)"
                      ? "border-cyan-400 bg-cyan-500/10 text-white"
                      : "border-white/10 bg-black/40 text-white/60 hover:bg-white/5"
                  )}
                >
                  <p className="text-xs font-bold">High Compute</p>
                  <p className="text-[11px] text-white/50 mt-0.5">4 vCPU · 8GB RAM</p>
                  <p className="text-[10px] text-white/40 mt-1">High-speed scraping</p>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsProvisionModalOpen(false)}
                className="border-white/15 text-xs text-white/70 hover:bg-white/10 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isDeploying}
                className="bg-white font-semibold text-xs text-black hover:bg-white/90"
              >
                {isDeploying ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Provisioning Sandbox...
                  </>
                ) : (
                  <>
                    <Server className="mr-1.5 h-3.5 w-3.5" /> Deploy Worker
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
