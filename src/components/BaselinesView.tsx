import React, { useState } from 'react';
import {
  Layers,
  PlusCircle,
  ShieldCheck,
  Radio,
  RefreshCw,
  FolderTree,
  Copy,
  Check
} from 'lucide-react';
import { Baseline, BaselineFileRecord } from '../types';
import { api } from '../lib/api';

interface BaselinesViewProps {
  baselines: Baseline[];
  loading: boolean;
  onRefresh: () => void;
  onOpenCreateBaseline: () => void;
  onOpenVerifyModal: (baseline: Baseline) => void;
  onActivateBaseline: (baselineId: string) => Promise<void>;
}

export const BaselinesView: React.FC<BaselinesViewProps> = ({
  baselines,
  loading,
  onRefresh,
  onOpenCreateBaseline,
  onOpenVerifyModal,
  onActivateBaseline
}) => {
  const [selectedBaseline, setSelectedBaseline] = useState<Baseline | null>(null);
  const [detailedFiles, setDetailedFiles] = useState<BaselineFileRecord[] | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleInspectBaseline = async (baseline: Baseline) => {
    setSelectedBaseline(baseline);
    setLoadingFiles(true);
    try {
      const full = await api.getBaselineById(baseline.id);
      setDetailedFiles(full.files || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingFiles(false);
    }
  };

  return (
    <div id="baselines-view" className="p-6 space-y-6 max-w-7xl mx-auto font-sans text-xs transition-colors duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Trusted Baseline Management</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-800">
              {baselines.length} Versions
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Cryptographic snapshots of authorized filesystem states, versions, and verification references.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-mono font-bold border border-slate-200 dark:border-slate-700 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            id="btn-auto-baseline-generator"
            onClick={onOpenCreateBaseline}
            className="btn-primary-gradient flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono tracking-wide cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>AUTO BASELINE GENERATOR</span>
          </button>
        </div>
      </div>

      {/* Grid of Baseline Versions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Version Cards List */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold font-mono">Baseline Versions</span>
            <span className="text-[11px] text-slate-400 font-mono">Newest first</span>
          </div>

          {baselines.length === 0 ? (
            <div className="p-8 text-center bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 space-y-2 shadow-md">
              <Layers className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto" />
              <p className="text-xs">No baselines established yet.</p>
              <button
                onClick={onOpenCreateBaseline}
                className="text-xs text-cyan-600 dark:text-cyan-400 font-bold hover:underline"
              >
                Generate Baseline v1
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {baselines.map((bl) => {
                const isSelected = selectedBaseline?.id === bl.id;
                return (
                  <div
                    key={bl.id}
                    onClick={() => handleInspectBaseline(bl)}
                    className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer space-y-3 ${
                      isSelected
                        ? 'bg-cyan-50 dark:bg-slate-800/90 border-cyan-500 text-slate-900 dark:text-slate-100 shadow-md scale-[1.01]'
                        : 'bg-white/90 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-cyan-400 dark:hover:border-slate-700 hover:-translate-y-0.5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 font-mono">Baseline v{bl.version}</span>
                        {bl.status === 'ACTIVE' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                            <Radio className="w-2 h-2 text-emerald-500 animate-pulse" />
                            ACTIVE
                          </span>
                        )}
                        {bl.status === 'SUPERSEDED' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                            HISTORICAL
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(bl.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold line-clamp-1">{bl.name}</p>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                      <div>
                        <span className="text-slate-400">Files:</span> <strong className="text-slate-800 dark:text-slate-200">{bl.fileCount}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Size:</span> <strong className="text-slate-800 dark:text-slate-200">{(bl.totalSizeBytes / 1024).toFixed(1)} KB</strong>
                      </div>
                      <div className="col-span-2 truncate">
                        <span className="text-slate-400">Root:</span> <span className="text-cyan-600 dark:text-cyan-400 text-[10px] font-bold">{bl.overallHash.substring(0, 14)}...</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 gap-2 font-mono">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenVerifyModal(bl);
                        }}
                        className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs border border-slate-200 dark:border-slate-700 flex items-center gap-1 transition-all hover:scale-105 cursor-pointer font-bold"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-cyan-500" />
                        <span>Verify Disk</span>
                      </button>

                      {bl.status !== 'ACTIVE' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onActivateBaseline(bl.id);
                          }}
                          className="px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-800 transition-all hover:scale-105 cursor-pointer"
                        >
                          Set Active
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 2 Cols: Selected Baseline Detailed File Records Inspector */}
        <div className="lg:col-span-2 bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
          {selectedBaseline ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 font-mono">{selectedBaseline.name}</h2>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-800">
                      v{selectedBaseline.version}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                    Created by <span className="text-slate-800 dark:text-slate-200 font-bold">{selectedBaseline.createdBy}</span> on {new Date(selectedBaseline.createdAt).toLocaleString()}
                  </p>
                </div>

                <button
                  onClick={() => onOpenVerifyModal(selectedBaseline)}
                  className="btn-primary-gradient flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer shadow-md self-start sm:self-auto"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify Filesystem Now</span>
                </button>
              </div>

              {/* Composite Root Hash Banner */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Baseline Root Cryptographic Fingerprint (SHA-256)</span>
                  <span className="text-xs text-cyan-600 dark:text-cyan-400 font-bold select-all break-all">{selectedBaseline.overallHash}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(selectedBaseline.overallHash, 'rootHash')}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  title="Copy root hash"
                >
                  {copiedHash === 'rootHash' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              {/* Files Table */}
              <div className="space-y-2 font-mono">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-bold uppercase tracking-wider text-[11px]">Recorded Monitored Files ({detailedFiles?.length || 0})</span>
                  <span>Target Scope: {selectedBaseline.targetPath}</span>
                </div>

                {loadingFiles ? (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-500" />
                    <p className="text-xs">Loading baseline file records...</p>
                  </div>
                ) : detailedFiles && detailedFiles.length > 0 ? (
                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 text-[11px]">
                          <th className="py-2.5 px-3">File Path</th>
                          <th className="py-2.5 px-3">Size</th>
                          <th className="py-2.5 px-3">SHA-256 Hash</th>
                          <th className="py-2.5 px-3">Snapshot</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                        {detailedFiles.map((file, i) => (
                          <tr key={i} className="hover:bg-slate-100 dark:hover:bg-slate-800/30">
                            <td className="py-2 px-3 text-slate-800 dark:text-slate-200 font-bold">{file.relativePath}</td>
                            <td className="py-2 px-3 text-slate-500 dark:text-slate-400 text-[11px]">{file.size} B</td>
                            <td className="py-2 px-3 text-[11px] text-cyan-600 dark:text-cyan-400 font-bold truncate max-w-[200px]" title={file.hash}>
                              {file.hash.substring(0, 18)}...
                            </td>
                            <td className="py-2 px-3 text-[10px]">
                              {file.contentSnapshot !== undefined ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 font-bold">
                                  Captured (Diff Ready)
                                </span>
                              ) : (
                                <span className="text-slate-400">Binary / Large</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No files found in this baseline record.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-24 text-center text-slate-400 space-y-2 font-mono">
              <FolderTree className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
              <p className="text-sm font-extrabold text-slate-800 dark:text-slate-300">Select a Baseline Version</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">Click on any baseline version card on the left to inspect its individual cryptographic hashes.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
