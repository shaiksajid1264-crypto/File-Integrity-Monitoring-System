import React, { useState, useEffect, useCallback } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./components/Dashboard";
import { EventsView } from "./components/EventsView";
import { BaselinesView } from "./components/BaselinesView";
import { HashLogsView } from "./components/HashLogsView";
import { AuditTrailView } from "./components/AuditTrailView";
import { SelfIntegrityView } from "./components/SelfIntegrityView";
import { SandboxManagerView } from "./components/SandboxManagerView";
import { ReportsView } from "./components/ReportsView";
import { SettingsView } from "./components/SettingsView";
import { LoginView } from "./components/LoginView";
import { EventDetailModal } from "./components/EventDetailModal";
import { BaselineVerificationModal } from "./components/BaselineVerificationModal";
import { CreateBaselineModal } from "./components/CreateBaselineModal";
import { FileHistoryModal } from "./components/FileHistoryModal";
import { api } from "./lib/api";
import {
  DashboardStats,
  IntegrityEvent,
  Baseline,
  AuditLogEntry,
} from "./types";
import { NavTab } from "./components/Sidebar";

const MainApp: React.FC = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    const savedTab = sessionStorage.getItem(
      "fimguard_active_tab",
    ) as NavTab | null;
    return savedTab || "dashboard";
  });
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [events, setEvents] = useState<IntegrityEvent[]>([]);
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Modals state
  const [selectedEvent, setSelectedEvent] = useState<IntegrityEvent | null>(
    null,
  );
  const [verifyingBaseline, setVerifyingBaseline] = useState<Baseline | null>(
    null,
  );
  const [showCreateBaselineModal, setShowCreateBaselineModal] = useState(false);
  const [inspectHistoryPath, setInspectHistoryPath] = useState<string | null>(
    null,
  );

  useEffect(() => {
    sessionStorage.setItem("fimguard_active_tab", activeTab);
  }, [activeTab]);

  // Toast banner for live SSE events
  const [liveToast, setLiveToast] = useState<{
    id: string;
    message: string;
    type: "MODIFIED" | "CREATED" | "DELETED";
    event: IntegrityEvent;
  } | null>(null);

  const fetchGlobalData = useCallback(async () => {
    setLoading(true);
    try {
      const [sData, eData, bData, aData] = await Promise.all([
        api.getStats().catch(() => null),
        api.getEvents().catch(() => []),
        api.getBaselines().catch(() => []),
        api.getAuditLogs().catch(() => []),
      ]);
      setStats(sData);
      setEvents(eData);
      setBaselines(bData);
      setAuditLogs(aData);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchGlobalData();

      // Subscribe to Server-Sent Events (SSE) for Real-Time Watcher Notifications
      const unsubscribe = api.subscribeToEvents((data) => {
        const payload = data.data || data;
        if (data.type === "NEW_EVENT" && payload.event) {
          const newEvt: IntegrityEvent = payload.event;
          setEvents((prev) => [
            newEvt,
            ...prev.filter((e) => e.id !== newEvt.id),
          ]);

          // Show real-time SOC alert notification
          setLiveToast({
            id: newEvt.id,
            message: `Realtime FIM Alert: [${newEvt.changeType}] on ${newEvt.relativePath}`,
            type: newEvt.changeType,
            event: newEvt,
          });
          setTimeout(() => setLiveToast(null), 6000);

          // Refresh stats
          api.getStats().then(setStats).catch(console.error);
          api.getAuditLogs().then(setAuditLogs).catch(console.error);
        } else if (data.type === "INTEGRITY_EVENTS_DETECTED") {
          fetchGlobalData();
        } else if (data.type === "INITIAL_STATE") {
          fetchGlobalData();
        }
      });

      return () => {
        unsubscribe();
      };
    }
  }, [isAuthenticated, fetchGlobalData]);

  const handleManualScan = async () => {
    setScanning(true);
    try {
      const res = await api.triggerScan();
      await fetchGlobalData();
      if (res.detectedCount > 0) {
        setLiveToast({
          id: Date.now().toString(),
          message: `Manual Scan Finished: ${res.detectedCount} file deviations detected.`,
          type: "MODIFIED",
          event: res.events[0] || events[0] || ({} as any),
        });
        setTimeout(() => setLiveToast(null), 5000);
      }
    } catch (err: any) {
      alert(`Scan failed: ${err.message}`);
    } finally {
      setScanning(false);
    }
  };

  const handleReviewEvent = async (
    eventId: string,
    decision: "APPROVE" | "REJECT" | "RESOLVE",
    notes: string,
  ) => {
    try {
      const updated = await api.reviewEvent(eventId, decision, notes);
      setEvents((prev) => prev.map((e) => (e.id === eventId ? updated : e)));
      setSelectedEvent(updated);
      await fetchGlobalData();
      return updated;
    } catch (err: any) {
      alert(`Review failed: ${err.message}`);
      throw err;
    }
  };

  const handleQuickReview = async (
    eventId: string,
    decision: "APPROVE" | "REJECT" | "RESOLVE",
  ) => {
    try {
      const updated = await api.reviewEvent(
        eventId,
        decision,
        `Quick ${decision} from table action`,
      );
      setEvents((prev) => prev.map((e) => (e.id === eventId ? updated : e)));
      await fetchGlobalData();
    } catch (err: any) {
      alert(`Quick action failed: ${err.message}`);
    }
  };

  const handleRestoreFile = async (eventId: string) => {
    try {
      const res = await api.restoreFile(eventId);
      if (res.event) {
        setEvents((prev) =>
          prev.map((e) => (e.id === eventId ? res.event! : e)),
        );
        setSelectedEvent(res.event);
      }
      await fetchGlobalData();
      alert(
        `File restored successfully! Cryptographic verification hash: ${res.verification.restoredHash}`,
      );
    } catch (err: any) {
      alert(`Recovery failed: ${err.message}`);
    }
  };

  const handleActivateBaseline = async (baselineId: string) => {
    try {
      await api.activateBaseline(baselineId);
      await fetchGlobalData();
    } catch (err: any) {
      alert(`Activate failed: ${err.message}`);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-cyan-600 dark:text-cyan-400 font-mono text-xs">
        Initializing FIMGuard Security Engine...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200 transition-colors duration-300">
      {/* Top Header */}
      <Header
        stats={stats}
        scanning={scanning}
        onTriggerScan={handleManualScan}
      />

      {/* Live Toast Alert for Realtime FIM Watcher Event */}
      {liveToast && (
        <div className="fixed top-20 right-6 z-50 animate-bounce">
          <div
            onClick={() =>
              liveToast.event?.id && setSelectedEvent(liveToast.event)
            }
            className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-cyan-500 shadow-2xl text-xs font-mono flex items-center gap-3 cursor-pointer hover:scale-105 transition-all"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100">{liveToast.message}</p>
              <p className="text-[10px] text-cyan-600 dark:text-cyan-400 font-semibold">
                Click to inspect cryptographic diff & review
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Layout Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar Navigation */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          stats={stats}
        />

        {/* Dynamic Main View */}
        <main className="flex-1 overflow-y-auto bg-slate-100/60 dark:bg-slate-950/50 transition-colors duration-300">
          {activeTab === "dashboard" && (
            <Dashboard
              stats={stats}
              recentEvents={events}
              recentAuditLogs={auditLogs}
              scanning={scanning}
              onTriggerScan={handleManualScan}
              onSelectTab={setActiveTab}
              onOpenEventDetail={setSelectedEvent}
              onOpenVerifyModal={() => {
                if (stats?.activeBaseline) {
                  setVerifyingBaseline(stats.activeBaseline);
                } else if (baselines.length > 0) {
                  setVerifyingBaseline(baselines[0]);
                } else {
                  setShowCreateBaselineModal(true);
                }
              }}
              onOpenNewBaselineModal={() => setShowCreateBaselineModal(true)}
            />
          )}

          {activeTab === "events" && (
            <EventsView
              events={events}
              loading={loading}
              onRefresh={fetchGlobalData}
              onSelectEvent={setSelectedEvent}
              onQuickReview={handleQuickReview}
              onOpenFileHistory={(filePath) => setInspectHistoryPath(filePath)}
            />
          )}

          {activeTab === "baselines" && (
            <BaselinesView
              baselines={baselines}
              loading={loading}
              onRefresh={fetchGlobalData}
              onOpenCreateBaseline={() => setShowCreateBaselineModal(true)}
              onOpenVerifyModal={(b) => setVerifyingBaseline(b)}
              onActivateBaseline={handleActivateBaseline}
            />
          )}

          {(activeTab === "hash-logs" || (activeTab as any) === "hashlogs") && (
            <HashLogsView />
          )}

          {(activeTab === "audit-trail" || (activeTab as any) === "audit") && (
            <AuditTrailView />
          )}

          {(activeTab === "self-integrity" ||
            (activeTab as any) === "selfintegrity") && <SelfIntegrityView />}

          {activeTab === "sandbox" && (
            <SandboxManagerView onTriggerScan={handleManualScan} />
          )}

          {activeTab === "reports" && <ReportsView stats={stats} />}

          {(activeTab === "exclusions" ||
            (activeTab as any) === "settings") && <SettingsView />}
        </main>
      </div>

      {/* Event Detail / Diff & Review Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onReview={handleReviewEvent}
          onRestore={handleRestoreFile}
          onOpenFileHistory={(path) => {
            setSelectedEvent(null);
            setInspectHistoryPath(path);
          }}
        />
      )}

      {/* Baseline Verification Modal */}
      {verifyingBaseline && (
        <BaselineVerificationModal
          baseline={verifyingBaseline}
          onClose={() => setVerifyingBaseline(null)}
          onVerificationComplete={fetchGlobalData}
        />
      )}

      {/* Create Baseline Modal */}
      {showCreateBaselineModal && (
        <CreateBaselineModal
          onClose={() => setShowCreateBaselineModal(false)}
          onBaselineCreated={async () => {
            await fetchGlobalData();
          }}
        />
      )}

      {/* File History Timeline Modal */}
      {inspectHistoryPath && (
        <FileHistoryModal
          filePath={inspectHistoryPath}
          onClose={() => setInspectHistoryPath(null)}
        />
      )}
    </div>
  );
};

import { ThemeProvider } from "./context/ThemeContext";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
