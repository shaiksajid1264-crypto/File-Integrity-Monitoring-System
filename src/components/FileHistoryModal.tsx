import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  CheckCircle2,
  FileCode2
} from 'lucide-react';
import { IntegrityEvent, HashLogEntry } from '../types';
import { api } from '../lib/api';

interface FileHistoryModalProps {
  filePath: string;
  onClose: () => void;
}

export const FileHistoryModal: React.FC<FileHistoryModalProps> = ({
  filePath,
  onClose
}) => {
  const [events, setEvents] = useState<IntegrityEvent[]>([]);
  const [hashLogs, setHashLogs] = useState<HashLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [allEvents, allLogs] = await Promise.all([
          api.getEvents(undefined, undefined, filePath),
          api.getHashLogs(filePath)
        ]);
        setEvents(allEvents.filter(e => e.relativePath === filePath || e.filePath.endsWith(filePath)));
        setHashLogs(allLogs.filter(l => l.relativePath === filePath || l.filePath.endsWith(filePath)));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [filePath]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto font-sans text-xs transition-colors duration-300">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-950 border border-cyan-300 dark:border-cyan-800 flex items-center justify-center text-cyan-700 dark:text-cyan-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 font-mono">{filePath}</h2>
              <p className="text-[11px] text-slate-500 font-mono">Chronological Integrity Audit & State Lifecycle</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Timeline Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 font-sans">
          {loading ? (
            <div className="py-12 text-center text-slate-400 font-mono">Loading file history timeline...</div>
          ) : (
            <div className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-800 space-y-6">
              {/* Event entries */}
              {events.map((evt) => (
                <div key={evt.id} className="relative group font-mono">
                  <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-white dark:bg-slate-900 border-2 border-cyan-500 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-900 dark:text-slate-100 text-xs">
                        FIM Event: {evt.changeType}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(evt.detectedAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 dark:text-slate-400 text-[11px]">Lifecycle Status:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{evt.status}</span>
                    </div>

                    {evt.oldHash && (
                      <p className="text-[10px] text-cyan-600 dark:text-cyan-400 truncate">
                        Expected Baseline: {evt.oldHash}
                      </p>
                    )}
                    {evt.newHash && (
                      <p className="text-[10px] text-rose-600 dark:text-rose-400 truncate">
                        Detected Digest: {evt.newHash}
                      </p>
                    )}

                    {evt.reviewedBy && (
                      <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-700 dark:text-slate-300">
                        <span className="text-slate-400 text-[10px]">Decision by {evt.reviewedBy}: </span>
                        <strong>{evt.reviewDecision}</strong>
                        {evt.reviewNotes && <p className="text-slate-500 dark:text-slate-400 mt-0.5">{evt.reviewNotes}</p>}
                      </div>
                    )}

                    {evt.recoveryVerified && (
                      <div className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Restored & Cryptographically Verified Against Baseline</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Hash Log calculations */}
              {hashLogs.map((log) => (
                <div key={log.id} className="relative group font-mono">
                  <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-400 dark:border-slate-600 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-600"></span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/60 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-600 dark:text-slate-400 font-bold">Cryptographic Hash Operation ({log.trigger})</span>
                      <span className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold truncate">
                      SHA-256: {log.newHash || 'N/A'}
                    </p>
                    <span className="text-[10px] text-slate-500 font-bold">Status: {log.status}</span>
                  </div>
                </div>
              ))}

              {events.length === 0 && hashLogs.length === 0 && (
                <div className="text-slate-400 py-6 font-mono">No recorded timeline events for this file path.</div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex justify-end font-mono">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all duration-200 hover:scale-105 cursor-pointer"
          >
            Close Timeline
          </button>
        </div>
      </div>
    </div>
  );
};
