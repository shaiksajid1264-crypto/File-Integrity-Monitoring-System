import React, { useState } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  UserCheck,
  LogOut,
  Layers,
  ChevronDown,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DashboardStats } from '../types';

interface HeaderProps {
  stats: DashboardStats | null;
  scanning?: boolean;
  onTriggerScan: () => void;
  onOpenLogin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  scanning,
  onTriggerScan,
  onOpenLogin
}) => {
  const { user, logout, switchUserRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'admin':
        return <span className="text-[11px] px-2 py-0.5 rounded-full font-mono font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/60">ADMIN</span>;
      case 'security_analyst':
        return <span className="text-[11px] px-2 py-0.5 rounded-full font-mono font-semibold bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-800/60">ANALYST</span>;
      case 'auditor':
        return <span className="text-[11px] px-2 py-0.5 rounded-full font-mono font-semibold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800/60">AUDITOR</span>;
      default:
        return <span className="text-[11px] px-2 py-0.5 rounded-full font-mono font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">USER</span>;
    }
  };

  return (
    <header id="fim-header" className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-30 transition-colors duration-300 shadow-sm">
      {/* Brand & System Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm shadow-emerald-500/20 hover:scale-105 transition-transform duration-200">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 dark:text-slate-100 text-lg tracking-tight">FIMGuard</span>
              <span className="text-[10px] tracking-wider uppercase font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold">Enterprise FIM</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Cryptographic File Integrity Engine</p>
          </div>
        </div>

        {/* Live Watcher Pill */}
        <div className="hidden md:flex items-center gap-2 pl-4 border-l border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${stats?.realtimeMonitoring ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${stats?.realtimeMonitoring ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
            <span className="text-slate-700 dark:text-slate-300 font-semibold">
              {stats?.realtimeMonitoring ? 'Real-Time Watcher: Active' : 'Watcher: Standby'}
            </span>
          </div>

          {/* Active Baseline Quick View */}
          {stats?.activeBaseline && (
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 font-mono">
              <Layers className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Active:</span>
              <span className="text-cyan-700 dark:text-cyan-300 font-semibold">v{stats.activeBaseline.version}</span>
              <span className="text-slate-400 dark:text-slate-500">({stats.monitoredFilesCount} files)</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Controls, Theme Toggle & User Persona */}
      <div className="flex items-center gap-3">
        {/* Dark / Light Theme Toggle Button */}
        <button
          id="btn-theme-toggle"
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
          title={`Switch to ${theme === 'dark' ? 'White / Light' : 'Dark Cyber'} background theme`}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 hover:rotate-90" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-600 transition-transform duration-300 hover:-rotate-12" />
          )}
        </button>

        {/* Instant Manual Scan Trigger */}
        <button
          id="btn-header-scan"
          onClick={onTriggerScan}
          disabled={scanning}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono tracking-wide transition-all duration-200 shadow-md ${
            scanning
              ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-300 dark:border-slate-700'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500 shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98]'
          }`}
          title="Perform immediate cryptographic integrity scan across monitored files"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin text-emerald-300' : ''}`} />
          <span>{scanning ? 'SCANNING...' : 'SCAN INTEGRITY'}</span>
        </button>

        {/* User Session Dropdown */}
        <div className="relative">
          {user ? (
            <div className="relative">
              <button
                id="btn-user-menu"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-left transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm"
              >
                <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 text-xs font-bold font-mono">
                  {user.name.charAt(0)}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">{user.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {getRoleBadge(user.role)}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl py-2 z-50 transition-all">
                  <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800">
                    <p className="text-xs text-slate-400">Authenticated Session</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{user.name}</p>
                    <p className="text-xs font-mono text-slate-500">@{user.username}</p>
                  </div>

                  <div className="px-3 py-2 text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                    Switch Persona
                  </div>

                  <button
                    onClick={() => { switchUserRole('admin'); setUserDropdownOpen(false); }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="font-medium">Chief Security Officer</span>
                    {getRoleBadge('admin')}
                  </button>

                  <button
                    onClick={() => { switchUserRole('security_analyst'); setUserDropdownOpen(false); }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="font-medium">Lead SOC Analyst</span>
                    {getRoleBadge('security_analyst')}
                  </button>

                  <button
                    onClick={() => { switchUserRole('auditor'); setUserDropdownOpen(false); }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="font-medium">Compliance Auditor</span>
                    {getRoleBadge('auditor')}
                  </button>

                  <div className="border-t border-slate-200 dark:border-slate-800 mt-2 pt-1">
                    <button
                      onClick={() => { logout(); setUserDropdownOpen(false); }}
                      className="w-full text-left px-4 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 font-semibold transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              id="btn-header-login"
              onClick={onOpenLogin}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all hover:scale-105 cursor-pointer shadow-sm"
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
