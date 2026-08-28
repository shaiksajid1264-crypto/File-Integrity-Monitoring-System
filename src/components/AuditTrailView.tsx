import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Lock,
  Link,
  RefreshCw,
  Copy,
  Check,
  Search,
  KeyRound
} from 'lucide-react';
import { AuditLogEntry } from '../types';
import { api } from '../lib/api';

export const AuditTrailView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    totalEntries: number;
    brokenIndex?: number;
    reason?: string;
  } | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs();
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const timer = window.setInterval(fetchLogs, 2000);
    return () => window.clearInterval(timer);
  }, []);

  const handleVerifyChain = async () => {
    setVerifying(true);
    try {
      const res = await api.verifyAuditChain();
      setVerificationResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setVerifying(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const filtered = logs.filter(l =>
    l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.actor.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.hash.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div id="audit-trail-view" className="p-6 space-y-6 max-w-7xl mx-auto font-sans text-xs transition-colors duration-300">
      {/* Header & Chain Verifier Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Tamper-Evident Audit Ledger</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
              <Lock className="w-3 h-3 text-emerald-500" />
              SHA-256 Chained
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Immutable cryptographic ledger linking administrative actions with previous block hash digests.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-mono font-bold border border-slate-200 dark:border-slate-700 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            id="btn-verify-audit-chain"
            onClick={handleVerifyChain}
            disabled={verifying}
            className="btn-emerald-gradient flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono tracking-wide cursor-pointer"
          >
            <ShieldCheck className={`w-4 h-4 ${verifying ? 'animate-spin' : ''}`} />
            <span>{verifying ? 'VERIFYING CHAIN...' : 'VERIFY CHAIN INTEGRITY'}</span>
          </button>
        </div>
      </div>

      {/* Chain Verification Result Box */}
      {verificationResult && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md font-mono ${
          verificationResult.valid
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
            : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
        }`}>
          <div className="flex items-center gap-3">
            {verificationResult.valid ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
            ) : (
              <ShieldAlert className="w-6 h-6 text-rose-500 shrink-0" />
            )}
            <div>
              <p className="font-extrabold text-sm">
                {verificationResult.valid
                  ? 'Audit Ledger Integrity 100% Cryptographically Verified'
                  : 'Ledger Tamper Alert – Cryptographic Chain Broken'}
              </p>
              <p className="text-xs opacity-90 mt-0.5">
                {verificationResult.valid
                  ? `All ${verificationResult.totalEntries} chained blocks verified from Genesis to latest block with flawless mathematical hash continuity.`
                  : `Chain discrepancy detected at index #${verificationResult.brokenIndex}: ${verificationResult.reason}`}
              </p>
            </div>
          </div>

          <span className="px-3 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 self-start sm:self-auto">
            {verificationResult.totalEntries} BLOCKS VALIDATED
          </span>
        </div>
      )}

      {/* Search Input */}
      <div className="bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex items-center gap-3 shadow-md">
        <Search className="w-4 h-4 text-slate-400 ml-2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter audit log by action, actor, target, or hash..."
          className="w-full bg-transparent text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 text-xs font-mono focus:outline-none"
        />
      </div>

      {/* Chained Ledger Entries List */}
      <div className="space-y-3">
        {filtered.slice().reverse().map((entry) => (
          <div
            key={entry.id}
            className="p-4 rounded-2xl bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5 hover:border-cyan-400 dark:hover:border-slate-700 transition-all duration-200 shadow-md"
          >
            {/* Header: Block Index, Action, Timestamp */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-2 font-mono">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 font-extrabold text-xs">
                  BLOCK #{entry.index}
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">{entry.action}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px]">
                <span>Actor: <strong className="text-slate-800 dark:text-slate-200 font-bold">{entry.actor}</strong></span>
                <span>•</span>
                <span>{new Date(entry.timestamp).toLocaleString()}</span>
              </div>
            </div>

            {/* Details */}
            <p className="text-slate-700 dark:text-slate-300 text-xs font-sans font-medium">{entry.details}</p>
            {entry.target && (
              <p className="text-[11px] text-slate-500 font-mono">
                Target: <span className="text-slate-700 dark:text-slate-400 font-semibold">{entry.target}</span>
              </p>
            )}

            {/* Cryptographic Hashes Chaining Visualizer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 text-[11px] font-mono">
              {/* Prev Hash */}
              <div className="space-y-0.5">
                <div className="flex items-center gap-1 text-slate-500 text-[10px] uppercase font-bold">
                  <Link className="w-3 h-3 text-cyan-500" />
                  <span>Previous Block Hash (Link)</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 font-mono text-[10px] truncate" title={entry.prevHash}>
                  <span className="truncate">{entry.prevHash}</span>
                  <button
                    onClick={() => copyToClipboard(entry.prevHash, `prev-${entry.id}`)}
                    className="ml-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 shrink-0 cursor-pointer"
                  >
                    {copiedHash === `prev-${entry.id}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Block Entry Hash */}
              <div className="space-y-0.5">
                <div className="flex items-center gap-1 text-slate-500 text-[10px] uppercase font-bold">
                  <KeyRound className="w-3 h-3 text-emerald-500" />
                  <span>Block Hash (SHA-256 Digest)</span>
                </div>
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-mono text-[10px] truncate font-bold" title={entry.hash}>
                  <span className="truncate">{entry.hash}</span>
                  <button
                    onClick={() => copyToClipboard(entry.hash, `hash-${entry.id}`)}
                    className="ml-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 shrink-0 cursor-pointer"
                  >
                    {copiedHash === `hash-${entry.id}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
