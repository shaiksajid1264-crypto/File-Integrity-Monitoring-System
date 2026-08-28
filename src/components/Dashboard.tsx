import React, { useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers,
  RefreshCw,
  ArrowUpRight,
  FileCode2,
  KeyRound,
  FileCheck2,
  Radio,
  FolderTree,
  ChevronDown,
} from "lucide-react";
import { DashboardStats, IntegrityEvent, AuditLogEntry } from "../types";
import { NavTab } from "./Sidebar";
import { IntegrityTrendGraph } from "./IntegrityTrendGraph";

interface DashboardProps {
  stats: DashboardStats | null;
  recentEvents?: IntegrityEvent[];
  recentAuditLogs?: AuditLogEntry[];
  scanning?: boolean;
  onTriggerScan: () => void;
  onSelectTab: (tab: NavTab) => void;
  onOpenEventDetail: (event: IntegrityEvent) => void;
  onOpenVerifyModal: () => void;
  onOpenNewBaselineModal: () => void;
  onQuickReview?: (
    eventId: string,
    decision: "APPROVE" | "REJECT" | "RESOLVE",
  ) => Promise<void>;
}

export const Dashboard: React.FC<DashboardProps> = ({
  stats,
  recentEvents = [],
  recentAuditLogs = [],
  scanning = false,
  onTriggerScan,
  onSelectTab,
  onOpenEventDetail,
  onOpenVerifyModal,
  onOpenNewBaselineModal,
  onQuickReview,
}) => {
  const [showAdvancedTelemetry, setShowAdvancedTelemetry] = useState(false);

  const formatTime = (iso?: string | null) => {
    if (!iso) return "Never";
    try {
      return new Date(iso).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING_REVIEW":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/80">
            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            PENDING REVIEW
          </span>
        );
      case "AUTHORIZED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/80">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            AUTHORIZED
          </span>
        );
      case "UNAUTHORIZED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800/80">
            <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            UNAUTHORIZED
          </span>
        );
      case "RESOLVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800/80">
            <ShieldCheck className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
            RESOLVED
          </span>
        );
      default:
        return <span className="text-xs text-slate-500 font-mono">{status}</span>;
    }
  };

  const getChangeTypeBadge = (type: string) => {
    switch (type) {
      case "MODIFIED":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
            MODIFIED
          </span>
        );
      case "CREATED":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
            ADDED
          </span>
        );
      case "DELETED":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
            DELETED
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-500">
            {type}
          </span>
        );
    }
  };

  return (
    <div id="dashboard-view" className="p-6 space-y-6 max-w-7xl mx-auto font-sans text-xs transition-colors duration-300">
      {/* Top Banner / System State Summary */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-lg shadow-slate-200/50 dark:shadow-slate-950/50">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              Security Operations Dashboard
            </h1>
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
              <Radio className="w-2.5 h-2.5 animate-pulse text-emerald-600 dark:text-emerald-400" />
              LIVE FIM ENGINE
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Real-time cryptographic filesystem monitoring, baseline deviation
            detection, and administrative authorization workflow.
          </p>
        </div>

        {/* Quick Command Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="btn-dash-scan"
            onClick={onTriggerScan}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono tracking-wide transition-all duration-200 shadow-md shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`}
            />
            <span>{scanning ? "SCANNING FS..." : "SCAN INTEGRITY"}</span>
          </button>

          <button
            id="btn-dash-verify"
            onClick={onOpenVerifyModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold font-mono border border-slate-200 dark:border-slate-700 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>VERIFY BASELINE</span>
          </button>

          <button
            id="btn-dash-new-baseline"
            onClick={onOpenNewBaselineModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold font-mono border border-slate-200 dark:border-slate-700 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>NEW BASELINE</span>
          </button>

          <button
            id="btn-dash-advanced-telemetry"
            onClick={() => setShowAdvancedTelemetry((open) => !open)}
            aria-expanded={showAdvancedTelemetry}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold font-mono border transition-all duration-200 cursor-pointer ${showAdvancedTelemetry ? "bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700 shadow-sm" : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700"}`}
          >
            <FolderTree className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>
              {showAdvancedTelemetry ? "HIDE ANALYTICS" : "TELEMETRY"}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${showAdvancedTelemetry ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* 4 Essential Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Monitored Files & Active Baseline */}
        <div className="bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-md hover:border-cyan-400 dark:hover:border-cyan-600 hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-mono font-bold uppercase tracking-wider">
              Monitored Target Files
            </span>
            <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div>
            <div className="text-3xl font-extrabold font-mono text-slate-900 dark:text-slate-100">
              {stats?.monitoredFilesCount ?? 0}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-600 dark:text-slate-400">
              <span>Active Baseline:</span>
              <span className="text-cyan-700 dark:text-cyan-300 font-mono font-bold">
                {stats?.activeBaseline
                  ? `v${stats.activeBaseline.version}`
                  : "None"}
              </span>
            </div>
          </div>
          <div
            className="pt-2 border-t border-slate-200 dark:border-slate-800/80 text-[11px] font-mono text-slate-500 truncate"
            title={stats?.activeBaseline?.overallHash}
          >
            Root SHA-256:{" "}
            {stats?.activeBaseline?.overallHash
              ? `${stats.activeBaseline.overallHash.substring(0, 16)}...`
              : "Pending"}
          </div>
        </div>

        {/* Pending Integrity Reviews */}
        <div className="bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-md hover:border-amber-400 dark:hover:border-amber-600 hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-mono font-bold uppercase tracking-wider">
              Pending Event Reviews
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          </div>
          <div>
            <div
              className={`text-3xl font-extrabold font-mono ${(stats?.pendingEvents || 0) > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-slate-100"}`}
            >
              {stats?.pendingEvents ?? 0}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-600 dark:text-slate-400">
              <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                {stats?.authorizedChanges ?? 0} Auth
              </span>
              <span>•</span>
              <span className="text-rose-600 dark:text-rose-400 font-mono font-bold">
                {stats?.unauthorizedChanges ?? 0} Unauth
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>Resolved: {stats?.resolvedEvents ?? 0}</span>
            <button
              onClick={() => onSelectTab("events")}
              className="text-amber-600 dark:text-amber-400 font-semibold hover:underline flex items-center gap-0.5 text-[11px] cursor-pointer"
            >
              Review queue <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Baseline Verification Status */}
        <div className="bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-md hover:border-emerald-400 dark:hover:border-emerald-600 hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-mono font-bold uppercase tracking-wider">
              Baseline Verification
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              {stats?.lastVerification?.status === "PASSED" ? (
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-mono font-extrabold text-lg">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>100% MATCH</span>
                </div>
              ) : stats?.lastVerification?.status ===
                "INTEGRITY_VIOLATION_DETECTED" ? (
                <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-mono font-extrabold text-lg">
                  <ShieldAlert className="w-5 h-5" />
                  <span>VIOLATION DETECTED</span>
                </div>
              ) : (
                <span className="text-slate-500 text-sm font-mono font-semibold">
                  Unverified
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Last check: {formatTime(stats?.lastVerification?.timestamp)}
            </div>
          </div>
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>
              Target: Baseline v
              {stats?.lastVerification?.baselineVersion ??
                stats?.activeBaseline?.version ??
                1}
            </span>
            <button
              onClick={onOpenVerifyModal}
              className="text-cyan-600 dark:text-cyan-400 font-semibold hover:underline flex items-center gap-0.5 text-[11px] cursor-pointer"
            >
              Run test <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Self-Integrity & Tamper Ledger */}
        <div className="bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-md hover:border-indigo-400 dark:hover:border-indigo-600 hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-mono font-bold uppercase tracking-wider">
              Self-Integrity & Ledger
            </span>
            <KeyRound className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              {stats?.selfIntegrityStatus === "SECURE" ? (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 font-mono font-bold text-xs">
                  CORE INTEGRITY SECURE
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-400 border border-rose-300 dark:border-rose-800 font-mono font-bold text-xs">
                  TAMPER ALERT
                </span>
              )}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-2 font-mono">
              Chained Audit Ledger:{" "}
              <span className="text-slate-900 dark:text-slate-200 font-bold">
                {stats?.totalAuditEntries ?? 0} entries
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>SHA-256 Chaining</span>
            <button
              onClick={() => onSelectTab("audit-trail")}
              className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-0.5 text-[11px] cursor-pointer"
            >
              Verify Chain <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Split: Recent Integrity Events & Recent Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Real-Time Detected Events Queue */}
        <div className="lg:col-span-2 bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                Recent File Integrity Events
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Real-time deviations detected between disk and active baseline
              </p>
            </div>
            <button
              onClick={() => onSelectTab("events")}
              className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 flex items-center gap-1 cursor-pointer"
            >
              View Full Queue ({stats?.totalEventsCount ?? 0}){" "}
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentEvents.length === 0 ? (
            <div className="py-12 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 space-y-3">
              <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto" />
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-300">
                  Filesystem in Full Integrity
                </p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  No unhandled integrity deviations detected. To test detection
                  live, open the File Manager & FIM Test tab.
                </p>
              </div>
              <button
                onClick={() => onSelectTab("sandbox")}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 inline-flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <FileCode2 className="w-3.5 h-3.5 text-indigo-500" />
                <span>Open File Manager & FIM Test</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-mono">
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">File Path</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Detected At</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono">
                  {recentEvents.slice(0, 4).map((evt) => (
                    <tr
                      key={evt.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors duration-150 group cursor-pointer"
                      onClick={() => onOpenEventDetail(evt)}
                    >
                      <td className="py-3 px-3">
                        {getChangeTypeBadge(evt.changeType)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {evt.relativePath}
                        </div>
                        <div
                          className="text-[10px] text-slate-400 truncate max-w-[200px]"
                          title={evt.newHash || evt.oldHash || ""}
                        >
                          Hash:{" "}
                          {evt.newHash
                            ? evt.newHash.substring(0, 12)
                            : evt.oldHash
                              ? evt.oldHash.substring(0, 12)
                              : "DELETED"}
                          ...
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {getStatusBadge(evt.status)}
                      </td>
                      <td className="py-3 px-3 text-slate-500 dark:text-slate-400">
                        {formatTime(evt.detectedAt)}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div
                          className="flex items-center justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {onQuickReview && (
                            <>
                              <button
                                onClick={() => onQuickReview(evt.id, "APPROVE")}
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-300 dark:border-emerald-800/80 transition-all hover:scale-105 cursor-pointer"
                                title="Approve change as authorized"
                              >
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => onQuickReview(evt.id, "REJECT")}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 text-[11px] font-bold border border-rose-300 dark:border-rose-800/80 transition-all hover:scale-105 cursor-pointer"
                                title="Mark as unauthorized incident"
                              >
                                <XCircle className="w-3 h-3 text-rose-500" />
                                <span>Unauthorized</span>
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => onOpenEventDetail(evt)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold border border-slate-300 dark:border-slate-700 transition-all cursor-pointer"
                            title="Inspect details & diff"
                          >
                            Review
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right 1 Col: Recent Tamper-Evident Audit Ledger */}
        <div className="bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-md">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                  Audit Trail
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Chained SHA-256 Security Log
                </p>
              </div>
              <button
                onClick={() => onSelectTab("audit-trail")}
                className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 flex items-center gap-1 cursor-pointer"
              >
                Inspect <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {recentAuditLogs
                .slice(-3)
                .reverse()
                .map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs font-mono space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        #{entry.index} {entry.action}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatTime(entry.timestamp)}
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 text-[11px] line-clamp-2">
                      {entry.details}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-900">
                      <span>
                        Actor:{" "}
                        <strong className="text-slate-700 dark:text-slate-300">
                          {entry.actor}
                        </strong>
                      </span>
                      <span className="font-mono text-slate-400">
                        {entry.hash.substring(0, 8)}...
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => onSelectTab("reports")}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm"
            >
              <FileCheck2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Generate Signed PDF Report</span>
            </button>
          </div>
        </div>
      </div>

      {showAdvancedTelemetry && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <IntegrityTrendGraph
            trendHistory={stats?.trendHistory || []}
            directoryBreakdown={stats?.directoryBreakdown || []}
            onSelectDirectory={() => onSelectTab("sandbox")}
            onOpenSandbox={() => onSelectTab("sandbox")}
          />
        </div>
      )}
    </div>
  );
};
