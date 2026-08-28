import React, { useState, useEffect } from 'react';
import {
  Binary,
  Search,
  RefreshCw,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  FilePlus,
  FileX
} from 'lucide-react';
import { HashLogEntry } from '../types';
import { api } from '../lib/api';

export const HashLogsView: React.FC = () => {
  const [logs, setLogs] = useState<HashLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [triggerFilter, setTriggerFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getHashLogs(
        searchTerm || undefined,
        triggerFilter !== 'ALL' ? triggerFilter : undefined,
        statusFilter !== 'ALL' ? statusFilter : undefined
      );
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [triggerFilter, statusFilter]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const getStatusBadge = (status: HashLogEntry['status']) => {
    switch (status) {
      case 'VERIFIED':
      case 'MATCH':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            MATCH / VERIFIED
          </span>
        );
      case 'MISMATCH':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-400 border border-rose-300 dark:border-rose-800 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-rose-500" />
            MISMATCH
          </span>
        );
      case 'NEW_FILE':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 flex items-center gap-1">
            <FilePlus className="w-3 h-3 text-indigo-500" />
            NEW FILE
          </span>
        );
      case 'DELETED_FILE':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
            <FileX className="w-3 h-3 text-amber-500" />
            DELETED
          </span>
        );
    }
  };

  const getTriggerBadge = (trigger: HashLogEntry['trigger']) => {
    switch (trigger) {
      case 'BASELINE_CREATION':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-800">BASELINE</span>;
      case 'REALTIME_WATCHER':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">WATCHER</span>;
      case 'MANUAL_SCAN':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">SCAN</span>;
      case 'VERIFICATION':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">VERIFY</span>;
      case 'RECOVERY_CHECK':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800">RECOVERY</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-500">{trigger}</span>;
    }
  };

  return (
    <div id="hash-logs-view" className="p-6 space-y-6 max-w-7xl mx-auto font-sans text-xs transition-colors duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Cryptographic Hash Operations Ledger</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {logs.length} Recorded Operations
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Immutable log of all computed cryptographic SHA-256 digest comparisons and state transitions.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-mono font-bold border border-slate-200 dark:border-slate-700 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center gap-3 shadow-md">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
            placeholder="Search by file path, old hash, or new hash (Press Enter)..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto font-mono">
          <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap font-bold">Trigger:</label>
          <select
            value={triggerFilter}
            onChange={(e) => setTriggerFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="ALL">All Triggers</option>
            <option value="REALTIME_WATCHER">Realtime Watcher</option>
            <option value="BASELINE_CREATION">Baseline Creation</option>
            <option value="MANUAL_SCAN">Manual Scan</option>
            <option value="RECOVERY_CHECK">Recovery Verification</option>
          </select>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto font-mono">
          <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap font-bold">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="MATCH">Match / Verified</option>
            <option value="MISMATCH">Mismatch</option>
            <option value="NEW_FILE">New File</option>
            <option value="DELETED_FILE">Deleted File</option>
          </select>
        </div>
      </div>

      {/* Hash Ledger Table */}
      <div className="bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-lg font-mono">
        {logs.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <Binary className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-300">No Hash Log Entries Found</p>
            <p className="text-xs text-slate-500">Perform a scan or baseline creation to generate hash calculations.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 text-[11px]">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Trigger</th>
                  <th className="py-3 px-4">File Path</th>
                  <th className="py-3 px-4">Algorithm</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Previous SHA-256</th>
                  <th className="py-3 px-4">Calculated SHA-256</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getTriggerBadge(log.trigger)}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-200">
                      {log.relativePath}
                    </td>
                    <td className="py-3 px-4 text-cyan-600 dark:text-cyan-400 font-bold">
                      {log.algorithm}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getStatusBadge(log.status)}
                    </td>
                    <td className="py-3 px-4">
                      {log.oldHash ? (
                        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                          <span className="text-[11px] truncate max-w-[130px]" title={log.oldHash}>
                            {log.oldHash.substring(0, 12)}...
                          </span>
                          <button
                            onClick={() => copyToClipboard(log.oldHash!, `old-${log.id}`)}
                            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                          >
                            {copiedHash === `old-${log.id}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">None</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {log.newHash ? (
                        <div className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                          <span className="text-[11px] truncate max-w-[130px]" title={log.newHash}>
                            {log.newHash.substring(0, 12)}...
                          </span>
                          <button
                            onClick={() => copyToClipboard(log.newHash!, `new-${log.id}`)}
                            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                          >
                            {copiedHash === `new-${log.id}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400 font-bold">Deleted (0 B)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
