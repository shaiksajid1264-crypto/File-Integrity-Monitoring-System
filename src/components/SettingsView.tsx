import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  Trash2,
  CheckCircle2,
  EyeOff,
  UserCheck,
  Sliders
} from 'lucide-react';
import { ExclusionRule } from '../types';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export const SettingsView: React.FC = () => {
  const { user } = useAuth();
  const [rules, setRules] = useState<ExclusionRule[]>([]);
  const [newPattern, setNewPattern] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [targetDirectory, setTargetDirectory] = useState('');
  const [savingTarget, setSavingTarget] = useState(false);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const data = await api.getExclusions();
      setRules(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
    api.getConfig().then(config => setTargetDirectory(config.targetDirectory || '')).catch(console.error);
  }, []);

  const handleTargetSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDirectory.trim()) return;
    setSavingTarget(true);
    try {
      const config = await api.updateConfig({ targetDirectory: targetDirectory.trim() });
      setTargetDirectory(config.targetDirectory);
      setStatusMsg(`Now monitoring the real path: ${config.targetDirectory}`);
      setTimeout(() => setStatusMsg(null), 5000);
    } catch (err: any) {
      alert(`Target path rejected: ${err.message}`);
    } finally {
      setSavingTarget(false);
    }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPattern.trim()) return;
    setSaving(true);
    try {
      await api.addExclusion(newPattern.trim(), newDesc.trim() || undefined);
      setNewPattern('');
      setNewDesc('');
      await fetchRules();
      setStatusMsg('Exclusion rule registered and active.');
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      alert(`Add failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await api.deleteExclusion(id);
      await fetchRules();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div id="settings-view" className="p-6 space-y-6 max-w-7xl mx-auto font-sans text-xs transition-colors duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">System Configuration & Exclusion Rules</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              OPERATIONAL PARAMETERS
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Define target directory scopes, ignore patterns, polling intervals, and security officer credentials.
          </p>
        </div>
      </div>

      {statusMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 flex items-center gap-2 font-mono shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="font-semibold">{statusMsg}</span>
        </div>
      )}

      <form onSubmit={handleTargetSave} className="bg-cyan-50/90 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800 rounded-2xl p-5 space-y-3 shadow-md">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-extrabold text-cyan-800 dark:text-cyan-300">Real Filesystem Monitoring Root</h2>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">Enter an existing absolute directory. Files are hashed and watched in place; nothing is copied into FIMGuard.</p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-[10px]">DIRECT PATH MODE</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input value={targetDirectory} onChange={e => setTargetDirectory(e.target.value)} placeholder="C:\\Users\\you\\Documents\\critical-files" className="flex-1 px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-cyan-300 dark:border-cyan-800 rounded-xl text-slate-900 dark:text-slate-200 text-xs font-mono focus:outline-none focus:border-cyan-500" />
          <button type="submit" disabled={savingTarget} className="btn-primary-gradient px-5 py-2.5 rounded-xl text-xs font-bold font-mono cursor-pointer disabled:opacity-50">{savingTarget ? 'VALIDATING...' : 'MONITOR THIS REAL PATH'}</button>
        </div>
      </form>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Exclusion Rules Management */}
        <div className="bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 font-extrabold text-sm">
              <EyeOff className="w-4 h-4" />
              <span>Monitored Scope Exclusion Rules</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">{rules.length} active filters</span>
          </div>

          <p className="text-slate-500 dark:text-slate-400 text-xs">
            Files or directories matching these glob patterns will be ignored during baseline generation, periodic scanning, and real-time watching.
          </p>

          {/* Add Rule Form */}
          <form onSubmit={handleAddRule} className="space-y-3 p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="space-y-1">
              <label className="text-slate-700 dark:text-slate-300 font-bold font-mono">Glob / Extension Pattern</label>
              <input
                type="text"
                value={newPattern}
                onChange={(e) => setNewPattern(e.target.value)}
                placeholder="e.g. *.tmp, *.log, cache/*, .DS_Store"
                required
                className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-200 text-xs font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-700 dark:text-slate-300 font-bold font-mono">Rule Description (Optional)</label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="e.g. Transient operating system log files"
                className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-200 text-xs font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="btn-primary-gradient w-full py-2.5 rounded-xl text-xs font-bold font-mono tracking-wide flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{saving ? 'ADDING RULE...' : 'ADD EXCLUSION RULE'}</span>
            </button>
          </form>

          {/* Rules List */}
          <div className="space-y-2 max-h-60 overflow-y-auto font-mono">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between group"
              >
                <div>
                  <div className="font-bold text-cyan-600 dark:text-cyan-300 text-xs">{rule.pattern}</div>
                  {rule.description && (
                    <div className="text-[10px] text-slate-400">{rule.description}</div>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  className="text-slate-400 hover:text-rose-500 p-1 transition cursor-pointer"
                  title="Remove pattern"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Security Officer Profile & Engine Settings */}
        <div className="space-y-6">
          {/* Officer Profile */}
          <div className="bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">
              <UserCheck className="w-4 h-4" />
              <span>Active Security Officer Session</span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Authenticated User:</span>
                <span className="text-slate-900 dark:text-slate-200 font-bold">{user?.username} ({user?.name})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">RBAC Role:</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 font-bold text-[10px]">
                  {user?.role}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Security Clearance:</span>
                <span className="text-cyan-600 dark:text-cyan-400 font-bold">LEVEL 4 – FULL FIM AUTHORIZATION</span>
              </div>
            </div>
          </div>

          {/* Engine Parameters */}
          <div className="bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-md">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-200 font-extrabold text-sm">
              <Sliders className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>Engine Operational Specifications</span>
            </div>

            <div className="space-y-2 text-xs font-mono text-slate-500 dark:text-slate-400">
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between">
                <span>Cryptographic Digest:</span>
                <span className="text-slate-900 dark:text-slate-200 font-bold">SHA-256 (NIST FIPS 180-4)</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between">
                <span>Filesystem Watcher Driver:</span>
                <span className="text-slate-900 dark:text-slate-200 font-bold">Chokidar Event Reactor (Linux inotify)</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between">
                <span>Audit Log Chaining:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Blockchain-grade Previous Hash Digest</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between">
                <span>Default Target Path:</span>
                <span className="text-cyan-600 dark:text-cyan-400 font-bold break-all">{targetDirectory || 'Not configured'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
