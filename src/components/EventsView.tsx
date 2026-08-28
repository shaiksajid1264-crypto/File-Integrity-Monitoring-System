import React, { useState } from 'react';
import {
  Activity,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  Eye,
  Clock
} from 'lucide-react';
import { IntegrityEvent, EventStatus, EventChangeType } from '../types';

interface EventsViewProps {
  events: IntegrityEvent[];
  loading: boolean;
  onRefresh: () => void;
  onSelectEvent: (event: IntegrityEvent) => void;
  onQuickReview: (eventId: string, decision: 'APPROVE' | 'REJECT' | 'RESOLVE') => Promise<void>;
  onOpenFileHistory: (filePath: string) => void;
}

export const EventsView: React.FC<EventsViewProps> = ({
  events,
  loading,
  onRefresh,
  onSelectEvent,
  onQuickReview,
  onOpenFileHistory
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  const filteredEvents = events.filter((e) => {
    if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
    if (typeFilter !== 'ALL' && e.changeType !== typeFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchPath = e.relativePath.toLowerCase().includes(q);
      const matchOld = e.oldHash && e.oldHash.toLowerCase().includes(q);
      const matchNew = e.newHash && e.newHash.toLowerCase().includes(q);
      return matchPath || matchOld || matchNew;
    }
    return true;
  });

  const getStatusBadge = (status: EventStatus) => {
    switch (status) {
      case 'PENDING_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            PENDING
          </span>
        );
      case 'AUTHORIZED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            AUTHORIZED
          </span>
        );
      case 'UNAUTHORIZED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <XCircle className="w-3 h-3 text-rose-500" />
            UNAUTHORIZED
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
            <ShieldCheck className="w-3 h-3 text-cyan-500" />
            RESOLVED
          </span>
        );
    }
  };

  const getTypeBadge = (type: EventChangeType) => {
    switch (type) {
      case 'MODIFIED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800">MODIFIED</span>;
      case 'CREATED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">ADDED</span>;
      case 'DELETED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-400 border border-rose-300 dark:border-rose-800">DELETED</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-500">{type}</span>;
    }
  };

  return (
    <div id="events-view" className="p-6 space-y-6 max-w-7xl mx-auto font-sans text-xs transition-colors duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">File Integrity Events Queue</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {filteredEvents.length} records
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Chronological log of all detected filesystem additions, modifications, and deletions.
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-mono font-bold border border-slate-200 dark:border-slate-700 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center gap-3 shadow-md">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by file path, old hash, or new hash..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 font-mono text-xs focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <label className="text-xs font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap font-semibold">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="AUTHORIZED">Authorized</option>
            <option value="UNAUTHORIZED">Unauthorized</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <label className="text-xs font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap font-semibold">Type:</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="ALL">All Types</option>
            <option value="MODIFIED">Modified</option>
            <option value="CREATED">Created</option>
            <option value="DELETED">Deleted</option>
          </select>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        {filteredEvents.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <Activity className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Integrity Events Found</p>
            <p className="text-xs text-slate-500">No events matched the current search or filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Event ID / Time</th>
                  <th className="py-3 px-4">Change Type</th>
                  <th className="py-3 px-4">File Path</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Cryptographic Hashes</th>
                  <th className="py-3 px-4">Reviewer</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {filteredEvents.map((evt) => (
                  <tr
                    key={evt.id}
                    onClick={() => onSelectEvent(evt)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors duration-150 cursor-pointer group"
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">{evt.id.split('-').slice(0, 2).join('-')}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {new Date(evt.detectedAt).toLocaleTimeString()}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {getTypeBadge(evt.changeType)}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">{evt.relativePath}</div>
                      <div className="text-[10px] text-slate-400">
                        {evt.isText ? 'Text Document' : 'Binary File'} • {evt.newSize !== null ? `${evt.newSize} B` : `${evt.oldSize} B (Deleted)`}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {getStatusBadge(evt.status)}
                    </td>

                    <td className="py-3 px-4">
                      <div className="space-y-0.5 max-w-[180px]">
                        {evt.oldHash && (
                          <div className="text-[10px] text-cyan-600 dark:text-cyan-400 truncate" title={`Expected: ${evt.oldHash}`}>
                            Exp: {evt.oldHash.substring(0, 10)}...
                          </div>
                        )}
                        {evt.newHash && (
                          <div className="text-[10px] text-rose-600 dark:text-rose-400 truncate" title={`Current: ${evt.newHash}`}>
                            Cur: {evt.newHash.substring(0, 10)}...
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 text-xs">
                      {evt.reviewedBy ? (
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-200">{evt.reviewedBy}</div>
                          <div className="text-[10px] text-slate-400">{new Date(evt.reviewedAt || '').toLocaleTimeString()}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Unreviewed</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onQuickReview(evt.id, 'APPROVE')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-800/80 transition-all hover:scale-105 cursor-pointer"
                          title="Approve change as authorized"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span className="hidden xl:inline">Approve</span>
                        </button>
                        <button
                          onClick={() => onQuickReview(evt.id, 'REJECT')}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 text-xs font-bold border border-rose-300 dark:border-rose-800/80 transition-all hover:scale-105 cursor-pointer"
                          title="Mark as unauthorized incident"
                        >
                          <XCircle className="w-3 h-3 text-rose-500" />
                          <span className="hidden xl:inline">Unauthorized</span>
                        </button>
                        <button
                          onClick={() => onSelectEvent(evt)}
                          className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-300 dark:border-slate-700 transition-all cursor-pointer"
                          title="Open full diff & review details"
                        >
                          <Eye className="w-3 h-3 text-cyan-500" />
                          <span>Review</span>
                        </button>
                      </div>
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
