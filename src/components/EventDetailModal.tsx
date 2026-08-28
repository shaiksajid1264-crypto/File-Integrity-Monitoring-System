import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  History,
  FileCode2,
  Copy,
  Check,
  FileText,
  Binary
} from 'lucide-react';
import * as Diff from 'diff';
import { IntegrityEvent } from '../types';
import { useAuth } from '../context/AuthContext';

interface EventDetailModalProps {
  event: IntegrityEvent;
  onClose: () => void;
  onReview: (eventId: string, decision: 'APPROVE' | 'REJECT' | 'RESOLVE', notes: string) => Promise<IntegrityEvent | undefined>;
  onRestore: (eventId: string) => Promise<void>;
  onOpenFileHistory: (filePath: string) => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  onClose,
  onReview,
  onRestore,
  onOpenFileHistory
}) => {
  const { user } = useAuth();
  const [currentEvent, setCurrentEvent] = useState<IntegrityEvent>(event);
  const [reviewNotes, setReviewNotes] = useState(event.reviewNotes || '');
  const [submitting, setSubmitting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleReviewAction = async (decision: 'APPROVE' | 'REJECT' | 'RESOLVE') => {
    setSubmitting(true);
    setFeedback(null);
    try {
      const updated = await onReview(currentEvent.id, decision, reviewNotes);
      if (updated) {
        setCurrentEvent(updated);
      } else {
        setCurrentEvent((prev) => ({
          ...prev,
          status: decision === 'APPROVE' ? 'AUTHORIZED' : decision === 'REJECT' ? 'UNAUTHORIZED' : 'RESOLVED',
          reviewedBy: user?.name || user?.username || 'Security Officer',
          reviewedAt: new Date().toISOString(),
          reviewDecision: decision,
          reviewNotes: reviewNotes
        }));
      }
      setFeedback({
        message: decision === 'APPROVE'
          ? `Change Approved: Set status to AUTHORIZED and logged in immutable audit ledger.`
          : decision === 'REJECT'
          ? `Incident Flagged: Marked as UNAUTHORIZED change and logged in audit ledger.`
          : `Status Updated: Marked as RESOLVED.`,
        type: 'success'
      });
    } catch (err: any) {
      setFeedback({ message: `Review failed: ${err.message}`, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestoreAction = async () => {
    if (!window.confirm(`Are you sure you want to rollback and restore '${currentEvent.relativePath}' from the trusted baseline snapshot?`)) {
      return;
    }
    setRestoring(true);
    setFeedback(null);
    try {
      await onRestore(currentEvent.id);
      setFeedback({
        message: `File '${currentEvent.relativePath}' successfully restored and verified against baseline.`,
        type: 'success'
      });
    } catch (err: any) {
      setFeedback({ message: `Restore failed: ${err.message}`, type: 'error' });
    } finally {
      setRestoring(false);
    }
  };

  // Generate text diff if both previous and current content exist
  const diffParts = (currentEvent.isText && (currentEvent.previousContent !== undefined || currentEvent.currentContent !== undefined))
    ? Diff.diffLines(currentEvent.previousContent || '', currentEvent.currentContent || '')
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto font-sans text-xs transition-colors duration-300">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-slate-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <FileCode2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 font-mono tracking-tight">{currentEvent.relativePath}</h2>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                  {currentEvent.changeType}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono">Event ID: {currentEvent.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenFileHistory(currentEvent.relativePath)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-mono font-bold text-cyan-700 dark:text-cyan-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              <History className="w-3.5 h-3.5" />
              <span>File History</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 font-sans text-xs">
          {/* Status Alert Banner if feedback is set */}
          {feedback && (
            <div
              className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all shadow-md ${
                feedback.type === 'error'
                  ? 'bg-rose-50 dark:bg-rose-950/90 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                  : 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {feedback.type === 'error' ? (
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                )}
                <span className="font-semibold">{feedback.message}</span>
              </div>
              <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Status and Recovery Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 font-mono">
            <div>
              <span className="text-slate-500 uppercase tracking-wider text-[10px] font-bold">Lifecycle Status</span>
              <div className="mt-1">
                {currentEvent.status === 'PENDING_REVIEW' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-bold text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    PENDING REVIEW
                  </span>
                )}
                {currentEvent.status === 'AUTHORIZED' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-bold text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    AUTHORIZED CHANGE
                  </span>
                )}
                {currentEvent.status === 'UNAUTHORIZED' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 font-bold text-xs">
                    <XCircle className="w-3.5 h-3.5 text-rose-500" />
                    UNAUTHORIZED CHANGE
                  </span>
                )}
                {currentEvent.status === 'RESOLVED' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 font-bold text-xs">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-500" />
                    RESOLVED / RECOVERED
                  </span>
                )}
              </div>
            </div>

            <div>
              <span className="text-slate-500 uppercase tracking-wider text-[10px] font-bold">Detected Timestamp</span>
              <p className="text-slate-800 dark:text-slate-200 mt-1 font-bold">{new Date(currentEvent.detectedAt).toLocaleString()}</p>
            </div>

            <div>
              <span className="text-slate-500 uppercase tracking-wider text-[10px] font-bold">Reviewer Attribution</span>
              <p className="text-slate-800 dark:text-slate-200 mt-1 font-bold">
                {currentEvent.reviewedBy ? `${currentEvent.reviewedBy} (${new Date(currentEvent.reviewedAt || '').toLocaleTimeString()})` : 'Awaiting Review'}
              </p>
            </div>
          </div>

          {/* Recovery Verification Note if present */}
          {currentEvent.recoveryVerified && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 rounded-xl flex items-center justify-between text-emerald-800 dark:text-emerald-300 font-mono">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="font-semibold">Recovery Verified: Restored file matches baseline cryptographic hash (100% Cryptographic Match)</span>
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                {currentEvent.recoveryTimestamp ? new Date(currentEvent.recoveryTimestamp).toLocaleTimeString() : ''}
              </span>
            </div>
          )}

          {/* Cryptographic Hashes Comparison */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">Cryptographic SHA-256 Hashes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
              {/* Expected Baseline Hash */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400 font-semibold text-[11px]">Expected Baseline Hash</span>
                  <span className="text-[10px] text-slate-500">{currentEvent.oldSize !== null ? `${currentEvent.oldSize} bytes` : 'N/A'}</span>
                </div>
                {currentEvent.oldHash ? (
                  <div className="flex items-center justify-between gap-2 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                    <span className="truncate">{currentEvent.oldHash}</span>
                    <button
                      onClick={() => copyToClipboard(currentEvent.oldHash!, 'oldHash')}
                      className="p-1 hover:text-slate-900 dark:hover:text-slate-200 transition cursor-pointer"
                      title="Copy SHA-256 Hash"
                    >
                      {copiedHash === 'oldHash' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ) : (
                  <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-[11px] text-slate-400 italic">
                    None (File did not exist in baseline)
                  </div>
                )}
              </div>

              {/* Current Detected Hash */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400 font-semibold text-[11px]">Current Computed Hash</span>
                  <span className="text-[10px] text-slate-500">{currentEvent.newSize !== null ? `${currentEvent.newSize} bytes` : 'N/A'}</span>
                </div>
                {currentEvent.newHash ? (
                  <div className="flex items-center justify-between gap-2 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-[11px] text-rose-600 dark:text-rose-400">
                    <span className="truncate">{currentEvent.newHash}</span>
                    <button
                      onClick={() => copyToClipboard(currentEvent.newHash!, 'newHash')}
                      className="p-1 hover:text-slate-900 dark:hover:text-slate-200 transition cursor-pointer"
                      title="Copy SHA-256 Hash"
                    >
                      {copiedHash === 'newHash' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ) : (
                  <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-[11px] text-rose-500 italic">
                    None (File deleted from target directory)
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Visual Diff View or Content Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between font-mono">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                <span>Payload Content & Structural Diff</span>
              </h3>
              {diffParts && (
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Added Lines (+)
                  </span>
                  <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span> Removed Lines (-)
                  </span>
                </div>
              )}
            </div>

            {diffParts ? (
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 font-mono text-[11px] overflow-x-auto max-h-72 divide-y divide-slate-200 dark:divide-slate-900">
                {diffParts.map((part, idx) => {
                  if (part.added) {
                    return (
                      <div key={idx} className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 pl-2 py-0.5 border-l-2 border-emerald-500 whitespace-pre-wrap font-semibold">
                        {part.value.split('\n').filter(Boolean).map((line, lIdx) => (
                          <div key={lIdx}>+ {line}</div>
                        ))}
                      </div>
                    );
                  }
                  if (part.removed) {
                    return (
                      <div key={idx} className="bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 pl-2 py-0.5 border-l-2 border-rose-500 whitespace-pre-wrap font-semibold">
                        {part.value.split('\n').filter(Boolean).map((line, lIdx) => (
                          <div key={lIdx}>- {line}</div>
                        ))}
                      </div>
                    );
                  }
                  return (
                    <div key={idx} className="text-slate-600 dark:text-slate-400 pl-2 py-0.5 whitespace-pre-wrap">
                      {part.value.split('\n').filter(Boolean).map((line, lIdx) => (
                        <div key={lIdx}>  {line}</div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ) : currentEvent.isText ? (
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                {currentEvent.changeType === 'DELETED' ? (
                  <p className="text-rose-500 font-bold">File has been deleted from disk. Prior content stored in baseline.</p>
                ) : currentEvent.changeType === 'CREATED' ? (
                  <div className="whitespace-pre-wrap text-emerald-700 dark:text-emerald-300 max-h-48 overflow-y-auto">
                    {currentEvent.currentContent || 'New file created with 0 bytes.'}
                  </div>
                ) : (
                  <p>Content preview not available for this snapshot.</p>
                )}
              </div>
            ) : (
              <div className="p-6 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-center space-y-2 font-mono">
                <Binary className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-slate-800 dark:text-slate-300 font-bold">Binary File Detected</p>
                <p className="text-slate-500 text-[11px] max-w-md mx-auto">
                  Binary files cannot be rendered as text diffs. Integrity validation is enforced via exact SHA-256 byte checksum comparison.
                </p>
              </div>
            )}
          </div>

          {/* Administrator Decision Form & Actions */}
          <div className="p-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4 font-mono">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Security Analyst / Administrator Review</h3>

            {currentEvent.reviewNotes && (
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase tracking-wider font-bold">Recorded Review Notes:</span>
                <p className="text-slate-800 dark:text-slate-200 mt-0.5">{currentEvent.reviewNotes}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-[11px] text-slate-600 dark:text-slate-400 font-bold">Audit Justification / Change Ticket / Notes</label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Enter justification, maintenance change request ID, or incident notes..."
                className="w-full h-20 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono text-xs resize-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              {/* Recovery Button */}
              <div>
                {currentEvent.oldHash && (
                  <button
                    onClick={handleRestoreAction}
                    disabled={restoring}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold border border-indigo-500 text-xs font-mono transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-md shadow-indigo-500/20"
                    title="Rollback file content to trusted baseline snapshot and cryptographically verify"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${restoring ? 'animate-spin' : ''}`} />
                    <span>{restoring ? 'RESTORING...' : 'RESTORE FROM BASELINE'}</span>
                  </button>
                )}
              </div>

              {/* Review Decision Buttons */}
              <div className="flex items-center gap-2">
                <button
                  id="btn-mark-unauthorized"
                  onClick={() => handleReviewAction('REJECT')}
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-950 hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-xs font-bold font-mono transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
                  title="Flag this modification as an unauthorized security incident"
                >
                  <XCircle className="w-3.5 h-3.5 text-rose-500" />
                  <span>{submitting ? 'SAVING...' : 'MARK UNAUTHORIZED'}</span>
                </button>

                <button
                  id="btn-approve-change"
                  onClick={() => handleReviewAction('APPROVE')}
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono transition-all duration-200 shadow-md shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
                  title="Approve this change as authorized maintenance"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{submitting ? 'SAVING...' : 'APPROVE CHANGE'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
