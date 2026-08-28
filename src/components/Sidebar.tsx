import React from "react";
import {
  LayoutDashboard,
  Activity,
  Layers,
  Binary,
  ScrollText,
  ShieldCheck,
  FileCode2,
  FileCheck2,
  SlidersHorizontal,
} from "lucide-react";
import { DashboardStats } from "../types";

export type NavTab =
  | "dashboard"
  | "events"
  | "baselines"
  | "hash-logs"
  | "audit-trail"
  | "self-integrity"
  | "sandbox"
  | "reports"
  | "exclusions";

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  stats: DashboardStats | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  stats,
}) => {
  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    section: "Live Demo" | "Evidence & Configuration";
    badge?: number | string | null;
    badgeColor?: string;
  }> = [
    {
      id: "dashboard",
      label: "Security Dashboard",
      icon: LayoutDashboard,
      section: "Live Demo",
    },
    {
      id: "events",
      label: "Integrity Events",
      icon: Activity,
      section: "Live Demo",
      badge: stats?.pendingEvents ? stats.pendingEvents : null,
      badgeColor: "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40",
    },
    {
      id: "baselines",
      label: "Trusted Baselines",
      icon: Layers,
      section: "Live Demo",
      badge: stats?.activeBaseline ? `v${stats.activeBaseline.version}` : null,
      badgeColor: "bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-800",
    },
    {
      id: "hash-logs",
      label: "Hash Operations Log",
      icon: Binary,
      section: "Evidence & Configuration",
    },
    {
      id: "audit-trail",
      label: "Tamper-Evident Audit",
      icon: ScrollText,
      section: "Evidence & Configuration",
      badge: stats?.totalAuditEntries ? `${stats.totalAuditEntries}` : null,
      badgeColor: "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700",
    },
    {
      id: "self-integrity",
      label: "Self-Integrity Shield",
      icon: ShieldCheck,
      section: "Evidence & Configuration",
      badge: stats?.selfIntegrityStatus === "SECURE" ? "OK" : "CHECK",
      badgeColor:
        stats?.selfIntegrityStatus === "SECURE"
          ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800"
          : "bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-400 border border-rose-300 dark:border-rose-800",
    },
    {
      id: "sandbox",
      label: "Real Path Inspector",
      icon: FileCode2,
      section: "Live Demo",
      badge: "LIVE",
      badgeColor: "bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800",
    },
    {
      id: "reports",
      label: "Verifiable Reports",
      icon: FileCheck2,
      section: "Evidence & Configuration",
    },
    {
      id: "exclusions",
      label: "Exclusion Rules",
      icon: SlidersHorizontal,
      section: "Evidence & Configuration",
    },
  ];

  return (
    <aside
      id="fim-sidebar"
      className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 flex flex-col justify-between p-4 shrink-0 min-h-[calc(100vh-4rem)] transition-colors duration-300 shadow-sm"
    >
      <div className="space-y-6">
        <div>
          <p className="px-3 text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            Operations & Monitoring
          </p>
          <nav className="space-y-1">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <React.Fragment key={item.id}>
                  {(index === 0 ||
                    navItems[index - 1].section !== item.section) && (
                    <p className="px-3 pt-4 pb-1 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-600">
                      {item.section}
                    </p>
                  )}
                  <button
                    id={`nav-item-${item.id}`}
                    onClick={() => onSelectTab(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                      isActive
                        ? "bg-slate-900 dark:bg-slate-800/90 text-white dark:text-slate-100 border border-slate-800 dark:border-slate-700 shadow-md shadow-slate-900/10 scale-[1.01]"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/60 border border-transparent hover:scale-[1.01]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-4 h-4 transition-colors duration-200 ${isActive ? "text-emerald-500 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"}`}
                      />
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== null && item.badge !== undefined && (
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold shadow-xs ${item.badgeColor || "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"}`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                </React.Fragment>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Node & Crypto status footer */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-900 text-slate-500 dark:text-slate-400 text-[11px] font-mono space-y-1.5">
        <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
          <span>Engine:</span>
          <span className="text-slate-900 dark:text-slate-200 font-semibold">SHA-256 Crypto</span>
        </div>
        <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
          <span>Audit Chain:</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
            Chained & Signed
          </span>
        </div>
        <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
          <span>Target Scope:</span>
          <span
            className="text-slate-800 dark:text-slate-300 truncate max-w-[120px] font-semibold"
            title={stats?.targetDirectory || 'No real path configured'}
          >
            {stats?.targetDirectory || 'No path'}
          </span>
        </div>
      </div>
    </aside>
  );
};
