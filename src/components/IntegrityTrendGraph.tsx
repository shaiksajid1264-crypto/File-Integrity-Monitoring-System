import React from "react";
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  FolderTree,
  FileCheck2,
  FileEdit,
  FilePlus,
  FileMinus,
  Activity,
  ShieldCheck,
  AlertTriangle,
  Folder,
} from "lucide-react";
import { IntegrityTrendPoint, DirectorySummary } from "../types";

interface IntegrityTrendGraphProps {
  trendHistory: IntegrityTrendPoint[];
  directoryBreakdown: DirectorySummary[];
  onSelectDirectory?: (dirPath: string) => void;
  onOpenSandbox?: () => void;
}

export const IntegrityTrendGraph: React.FC<IntegrityTrendGraphProps> = ({
  trendHistory = [],
  directoryBreakdown = [],
  onSelectDirectory,
  onOpenSandbox,
}) => {
  const chartData = trendHistory.map((pt, idx) => {
    const timeLabel = pt.timestamp
      ? new Date(pt.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : `T-${idx}`;
    return {
      time: timeLabel,
      integrity: pt.integrityScore,
      totalFiles: pt.totalFiles,
      modified: pt.modifiedCount,
      added: pt.addedCount,
      deleted: pt.deletedCount,
      matched: pt.matchedCount,
    };
  });

  const latestPoint =
    trendHistory.length > 0 ? trendHistory[trendHistory.length - 1] : null;
  const mutationData = [
    {
      name: "Unchanged",
      value: latestPoint?.matchedCount ?? 0,
      color: "#10b981",
    },
    { name: "Added", value: latestPoint?.addedCount ?? 0, color: "#818cf8" },
    {
      name: "Modified",
      value: latestPoint?.modifiedCount ?? 0,
      color: "#f59e0b",
    },
    {
      name: "Deleted",
      value: latestPoint?.deletedCount ?? 0,
      color: "#f43f5e",
    },
  ];
  const scopeTotal = mutationData.reduce(
    (total, item) => total + item.value,
    0,
  );

  return (
    <div className="space-y-6 font-sans text-xs transition-colors duration-300">
      {/* Top Trend Graph Header & Metric Ribbon */}
      <div className="bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                Directory Integrity Trend & Mutation Dynamics
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-800">
                REAL-TIME SHA-256
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Live cryptographic time-series tracking total monitored files (N)
              alongside Added, Modified, and Deleted file mutations (X).
            </p>
          </div>

          {latestPoint && (
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 font-mono text-xs shadow-sm">
              <span className="text-slate-500 dark:text-slate-400 font-bold">Current Health:</span>
              <span
                className={`font-extrabold ${latestPoint.integrityScore === 100 ? "text-emerald-600 dark:text-emerald-400" : latestPoint.integrityScore >= 70 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"}`}
              >
                {latestPoint.integrityScore}%
              </span>
            </div>
          )}
        </div>

        {/* 4 Summary Mini-Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800/80">
          <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
              <span className="flex items-center gap-1.5 font-bold">
                <FileCheck2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Intact Files</span>
              </span>
              <span className="font-mono text-slate-900 dark:text-slate-200 font-extrabold">
                {latestPoint?.matchedCount ?? 0}
              </span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
              <span className="flex items-center gap-1.5 font-bold">
                <FileEdit className="w-3.5 h-3.5 text-amber-500" />
                <span>Modified Files</span>
              </span>
              <span className="font-mono text-amber-600 dark:text-amber-300 font-extrabold">
                {latestPoint?.modifiedCount ?? 0}
              </span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
              <span className="flex items-center gap-1.5 font-bold">
                <FilePlus className="w-3.5 h-3.5 text-indigo-500" />
                <span>Added Files</span>
              </span>
              <span className="font-mono text-indigo-600 dark:text-indigo-300 font-extrabold">
                {latestPoint?.addedCount ?? 0}
              </span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
              <span className="flex items-center gap-1.5 font-bold">
                <FileMinus className="w-3.5 h-3.5 text-rose-500" />
                <span>Deleted Files</span>
              </span>
              <span className="font-mono text-rose-600 dark:text-rose-300 font-extrabold">
                {latestPoint?.deletedCount ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* The Recharts Chart */}
        <div className="h-64 w-full pt-2">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="colorIntegrity"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorFiles" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  vertical={false}
                />
                <XAxis
                  dataKey="time"
                  stroke="#64748b"
                  tick={{
                    fontSize: 10,
                    fill: "#64748b",
                    fontFamily: "monospace",
                  }}
                  tickLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  tick={{
                    fontSize: 10,
                    fill: "#64748b",
                    fontFamily: "monospace",
                  }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "12px",
                    fontFamily: "monospace",
                    fontSize: "11px",
                    color: "#f8fafc"
                  }}
                  itemStyle={{ padding: "2px 0" }}
                />
                <Legend
                  wrapperStyle={{
                    fontSize: "11px",
                    fontFamily: "monospace",
                    paddingTop: "10px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="integrity"
                  name="Integrity %"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorIntegrity)"
                />
                <Line
                  type="monotone"
                  dataKey="totalFiles"
                  name="Total Monitored Files (N)"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#38bdf8" }}
                />
                <Line
                  type="stepAfter"
                  dataKey="modified"
                  name="Modified (X)"
                  stroke="#fbbf24"
                  strokeWidth={1.5}
                  dot={{ r: 2 }}
                />
                <Line
                  type="stepAfter"
                  dataKey="added"
                  name="Added (X)"
                  stroke="#a855f7"
                  strokeWidth={1.5}
                  dot={{ r: 2 }}
                />
                <Line
                  type="stepAfter"
                  dataKey="deleted"
                  name="Deleted (X)"
                  stroke="#f43f5e"
                  strokeWidth={1.5}
                  dot={{ r: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 font-mono text-xs">
              Collecting time-series cryptographic telemetry...
            </div>
          )}
        </div>
      </div>

      {/* Directory-by-Directory Breakdown Table */}
      <div className="bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-indigo-500" />
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                Directory-Level Monitoring & Integrity Breakdown
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Cryptographic integrity statistics aggregated per directory folder structure.
            </p>
          </div>

          {onOpenSandbox && (
            <button
              onClick={onOpenSandbox}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold transition-all hover:scale-105 cursor-pointer shadow-sm"
            >
              <Folder className="w-3.5 h-3.5 text-indigo-500" />
              <span>Explore / Modify Target Directories</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-3">Directory Folder</th>
                <th className="py-2.5 px-3 text-center">Files (N)</th>
                <th className="py-2.5 px-3 text-center">Matched</th>
                <th className="py-2.5 px-3 text-center">Modified</th>
                <th className="py-2.5 px-3 text-center">Added</th>
                <th className="py-2.5 px-3 text-center">Deleted</th>
                <th className="py-2.5 px-3 text-right">Integrity Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
              {directoryBreakdown.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    No directory branches discovered.
                  </td>
                </tr>
              ) : (
                directoryBreakdown.map((dir) => {
                  const hasIssues =
                    dir.modifiedCount > 0 ||
                    dir.addedCount > 0 ||
                    dir.deletedCount > 0;
                  const intactPct =
                    dir.fileCount > 0 && !hasIssues
                      ? 100
                      : Math.max(
                          0,
                          Math.round(
                            (dir.matchedCount /
                              Math.max(
                                1,
                                dir.matchedCount +
                                  dir.modifiedCount +
                                  dir.addedCount +
                                  dir.deletedCount,
                              )) *
                              100,
                          ),
                        );

                  return (
                    <tr
                      key={dir.path}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer"
                      onClick={() =>
                        onSelectDirectory && onSelectDirectory(dir.path)
                      }
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <Folder
                            className={`w-4 h-4 ${hasIssues ? "text-amber-500" : "text-indigo-500"}`}
                          />
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {dir.name}
                            </span>
                            <span className="text-[10px] text-slate-400 ml-2">
                              ({(dir.totalSizeBytes / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center text-slate-800 dark:text-slate-300 font-bold">
                        {dir.fileCount}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          {dir.matchedCount}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        {dir.modifiedCount > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 font-bold">
                            {dir.modifiedCount}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        {dir.addedCount > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-400 font-bold">
                            +{dir.addedCount}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        {dir.deletedCount > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-400 font-bold">
                            -{dir.deletedCount}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right">
                        {!hasIssues ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                            <ShieldCheck className="w-3 h-3 text-emerald-500" />
                            100% INTACT
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                            {intactPct}% (
                            {dir.modifiedCount +
                              dir.addedCount +
                              dir.deletedCount}{" "}
                            DEVIATIONS)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
