import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { Baseline, BaselineVerificationResult } from '../types';
import { api } from '../lib/api';

interface BaselineVerificationModalProps {
  baseline: Baseline | null;
  onClose: () => void;
  onVerificationComplete: () => void;
}

export const BaselineVerificationModal: React.FC<BaselineVerificationModalProps> = ({
  baseline,
  onClose,
  onVerificationComplete
}) => {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BaselineVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runVerification = async () => {
    if (!baseline) return;
    setRunning(true);
    setError(null);
    try {
      const res = await api.verifyBaseline(baseline.id);
      setResult(res);
      onVerificationComplete();
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    runVerification();
  }, [baseline?.id]);

  if (!baseline) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto font-sans text-xs transition-colors duration-300">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-950/80 border border-cyan-300 dark:border-cyan-800 flex items-center justify-center text-cyan-700 dark:text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">Baseline Cryptographic Verification</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-800 font-bold font-mono">
                  v{baseline.version}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Target: <span className="text-slate-800 dark:text-slate-300 font-semibold">{baseline.targetPath}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 font-sans">
          {running && (
            <div className="py-12 text-center space-y-3 font-mono">
              <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin mx-auto" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Scanning Filesystem & Recalculating Hashes...</p>
              <p className="text-xs text-slate-500">Comparing disk state against cryptographic baseline records.</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-300 font-mono">
              <p className="font-bold">Verification Error:</p>
              <p className="mt-1">{error}</p>
            </div>
          )}

          {result && !running && (
            <div className="space-y-6">
              {/* Verdict Banner */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-md font-mono ${
                result.status === 'PASSED'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/80 text-rose-800 dark:text-rose-300'
              }`}>
                <div className="flex items-center gap-3">
                  {result.status === 'PASSED' ? (
                    <CheckCircle2 className="w-7 h-7 text-emerald-500 shrink-0" />
                  ) : (
                    <ShieldAlert className="w-7 h-7 text-rose-500 shrink-0" />
                  )}
                  <div>
                    <h3 className="text-sm font-extrabold tracking-tight">
                      {result.status === 'PASSED'
                        ? '100% Cryptographic Match – Baseline Fully Intact'
                        : 'Integrity Violation Detected – Discrepancies Found'}
                    </h3>
                    <p className="text-xs opacity-90 mt-0.5 font-sans">
                      {result.status === 'PASSED'
                        ? `All ${result.matchedCount} monitored files match baseline hashes with zero deviations.`
                        : `Found ${result.modifiedCount} modified, ${result.addedCount} added, and ${result.deletedCount} deleted items.`}
                    </p>
                  </div>
                </div>

                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(result.timestamp).toLocaleTimeString()}
                </span>
              </div>

              {/* Statistics Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Matching Files</span>
                  <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{result.matchedCount}</div>
                </div>
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Modified Files</span>
                  <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">{result.modifiedCount}</div>
                </div>
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Added Files</span>
                  <div className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">{result.addedCount}</div>
                </div>
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Deleted Files</span>
                  <div className="text-xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">{result.deletedCount}</div>
                </div>
              </div>

              {/* File Differences Table */}
              <div className="space-y-2 font-mono">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                  Filesystem vs. Baseline Cryptographic Comparison Details
                </h4>

                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400">
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">File Path</th>
                        <th className="py-2.5 px-3">Expected Hash</th>
                        <th className="py-2.5 px-3">Current Disk Hash</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                      {result.differences.map((diff, i) => (
                        <tr key={i} className="hover:bg-slate-100 dark:hover:bg-slate-800/30">
                          <td className="py-2 px-3 whitespace-nowrap">
                            {diff.type === 'MATCH' && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 text-[10px] font-bold">
                                MATCH
                              </span>
                            )}
                            {diff.type === 'MODIFIED' && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800 text-[10px] font-bold">
                                MODIFIED
                              </span>
                            )}
                            {diff.type === 'ADDED' && (
                              <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-800 text-[10px] font-bold">
                                NEW
                              </span>
                            )}
                            {diff.type === 'DELETED' && (
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-400 border border-rose-300 dark:border-rose-800 text-[10px] font-bold">
                                DELETED
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-800 dark:text-slate-200 font-bold">{diff.filePath}</td>
                          <td className="py-2 px-3 text-[10px] text-cyan-600 dark:text-cyan-400 font-mono">
                            {diff.expectedHash ? `${diff.expectedHash.substring(0, 14)}...` : 'None (Added)'}
                          </td>
                          <td className="py-2 px-3 text-[10px] text-rose-600 dark:text-rose-400 font-mono">
                            {diff.currentHash ? `${diff.currentHash.substring(0, 14)}...` : 'None (Deleted)'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between font-mono">
          <button
            onClick={runVerification}
            disabled={running}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all duration-200 hover:scale-105 cursor-pointer flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
            <span>Re-verify</span>
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all duration-200 hover:scale-105 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
