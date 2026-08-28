import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check
} from 'lucide-react';
import { SelfIntegrityFile } from '../types';
import { api } from '../lib/api';

export const SelfIntegrityView: React.FC = () => {
  const [files, setFiles] = useState<SelfIntegrityFile[]>([]);
  const [allPassed, setAllPassed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const fetchSelfIntegrity = async () => {
    setLoading(true);
    try {
      const data = await api.getSelfIntegrity();
      setFiles(data.files);
      setAllPassed(data.allPassed);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyNow = async () => {
    setLoading(true);
    try {
      const res = await api.verifySelfIntegrity();
      setFiles(res.files);
      setAllPassed(res.allPassed);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleReinit = async () => {
    if (!window.confirm('Re-establish self-integrity baseline with current codebase files?')) return;
    setLoading(true);
    try {
      const res = await api.initializeSelfIntegrity();
      setFiles(res.files);
      setAllPassed(res.allPassed);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSelfIntegrity();
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  return (
    <div id="self-integrity-view" className="p-6 space-y-6 max-w-7xl mx-auto font-sans text-xs transition-colors duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Self-Integrity Monitoring Shield</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
              allPassed
                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-400 border border-rose-300 dark:border-rose-800'
            }`}>
              {allPassed ? 'ALL CORE FILES SECURE' : 'TAMPERING DETECTED'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Internal watchdog monitoring FIMGuard's own critical system files, routes, database modules, and metadata against tampering.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleReinit}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-mono font-bold border border-slate-200 dark:border-slate-700 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm"
          >
            Re-Establish Self Baseline
          </button>

          <button
            id="btn-verify-self-integrity"
            onClick={handleVerifyNow}
            disabled={loading}
            className="btn-emerald-gradient flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono tracking-wide cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>VERIFY SELF-INTEGRITY</span>
          </button>
        </div>
      </div>

      {/* Banner */}
      <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-md font-mono ${
        allPassed
          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
          : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
      }`}>
        <div className="flex items-center gap-3">
          {allPassed ? (
            <ShieldCheck className="w-7 h-7 text-emerald-500 shrink-0" />
          ) : (
            <ShieldAlert className="w-7 h-7 text-rose-500 shrink-0" />
          )}
          <div>
            <h3 className="font-extrabold text-sm">
              {allPassed
                ? 'FIMGuard Self-Protection Active – 100% Core Verification'
                : 'Self-Integrity Anomaly – Core Engine Files Mismatched'}
            </h3>
            <p className="text-xs opacity-90 mt-0.5 font-sans">
              {allPassed
                ? `All ${files.length} protected core binaries and configuration scripts match cryptographic self-baseline.`
                : 'One or more internal application files have been modified outside authorized maintenance.'}
            </p>
          </div>
        </div>
      </div>

      {/* Monitored Core Files Table */}
      <div className="bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-lg font-mono">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 text-[11px]">
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Core File Component</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Expected SHA-256</th>
                <th className="py-3 px-4">Current Hash</th>
                <th className="py-3 px-4">Last Verified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
              {files.map((file, idx) => (
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 whitespace-nowrap">
                    {file.status === 'VERIFIED' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 text-[10px] font-bold inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        VERIFIED
                      </span>
                    )}
                    {file.status === 'TAMPERED' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-400 border border-rose-300 dark:border-rose-800 text-[10px] font-bold inline-flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3 text-rose-500" />
                        TAMPERED
                      </span>
                    )}
                    {file.status === 'MISSING' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800 text-[10px] font-bold inline-flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                        MISSING
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-200">
                    {file.path}
                  </td>
                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                    {file.size} bytes
                  </td>
                  <td className="py-3 px-4 text-cyan-600 dark:text-cyan-400 text-[10px] font-bold">
                    <div className="flex items-center gap-1">
                      <span className="truncate max-w-[130px]" title={file.expectedHash}>{file.expectedHash.substring(0, 14)}...</span>
                      <button
                        onClick={() => copyToClipboard(file.expectedHash, `exp-${idx}`)}
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                      >
                        {copiedHash === `exp-${idx}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[10px]">
                    {file.currentHash ? (
                      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                        <span className="truncate max-w-[130px]" title={file.currentHash}>{file.currentHash.substring(0, 14)}...</span>
                        <button
                          onClick={() => copyToClipboard(file.currentHash, `cur-${idx}`)}
                          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                        >
                          {copiedHash === `cur-${idx}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    ) : (
                      <span className="text-rose-600 dark:text-rose-400 font-bold">Missing File</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                    {new Date(file.lastChecked).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
