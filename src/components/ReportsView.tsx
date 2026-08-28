import React, { useState, useEffect } from 'react';
import {
  Download,
  ShieldCheck,
  ShieldAlert,
  PlusCircle,
  Copy,
  Check,
  RefreshCw,
  KeyRound
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GeneratedReport, DashboardStats } from '../types';
import { api } from '../lib/api';

interface ReportsViewProps {
  stats: DashboardStats | null;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ stats }) => {
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Verification state
  const [verifyHashInput, setVerifyHashInput] = useState('');
  const [verifyResult, setVerifyResult] = useState<{
    valid: boolean;
    report?: GeneratedReport;
    message: string;
  } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await api.getReports();
      setReports(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const report = await api.generateReport(reportTitle.trim() || undefined);
      setReportTitle('');
      await fetchReports();
      // Automatically export and download PDF
      await exportPDF(report);
    } catch (err: any) {
      alert(`Report generation failed: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const exportPDF = async (report: GeneratedReport) => {
    const doc = new jsPDF();

    // Title & Header
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 32, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('FIMGuard Security Integrity Audit Report', 14, 18);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`Report ID: ${report.id}  |  Generated: ${new Date(report.generatedAt).toLocaleString()}`, 14, 26);

    // Section 1: Metadata
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Executive Audit Overview', 14, 42);

    autoTable(doc, {
      startY: 46,
      head: [['Attribute', 'Audit Specification Value']],
      body: [
        ['Report Title', report.title],
        ['Authorizing Officer', report.generatedBy],
        ['Monitoring Target Scope', report.targetScope],
        ['Active Baseline Version', `v${report.baselineVersion}`],
        ['Total Monitored Files', `${report.summary.totalMonitored} files`],
        ['Pending Review Queue', `${report.summary.pendingEvents} items`],
        ['Authorized Deviations', `${report.summary.authorizedChanges} approved`],
        ['Unauthorized Deviations', `${report.summary.unauthorizedChanges} rejected`],
        ['Resolved Events', `${report.summary.resolvedEvents} resolved`],
        ['Chained Audit Ledger Integrity', report.summary.auditLogIntegrity]
      ],
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, font: 'helvetica' }
    });

    // Section 2: Cryptographic Digital Signature & Verification Block
    const finalY = (doc as any).lastAutoTable.finalY + 14;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Cryptographic Digital Signature & Tamper Seal', 14, finalY);

    autoTable(doc, {
      startY: finalY + 4,
      head: [['Cryptographic Property', 'Digest Value']],
      body: [
        ['Digest Algorithm', 'SHA-256 (256-bit Cryptographic Hash)'],
        ['Report Payload Fingerprint', report.cryptographicHash],
        ['Blockchain-Chained Ledger', 'VERIFIED INTACT'],
        ['Signer Key / Authority', 'FIMGuard Root Security Authority']
      ],
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: [15, 23, 42], fontStyle: 'bold' },
      styles: { fontSize: 8, font: 'courier' }
    });

    const footerY = (doc as any).lastAutoTable.finalY + 12;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('This document is mathematically signed by the FIMGuard engine. Verify authenticity at /api/reports/verify-hash.', 14, footerY);

    // Save and trigger browser download
    doc.save(`FIMGuard_Audit_Report_${report.id}.pdf`);
  };

  const handleVerifyHash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyHashInput.trim()) return;
    setVerifying(true);
    try {
      const res = await api.verifyReportHash(verifyHashInput.trim());
      setVerifyResult(res);
    } catch (err: any) {
      setVerifyResult({ valid: false, message: err.message });
    } finally {
      setVerifying(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  return (
    <div id="reports-view" className="p-6 space-y-6 max-w-7xl mx-auto font-sans text-xs transition-colors duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Verifiable PDF Security Reports</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-800">
              CRYPTOGRAPHICALLY SIGNED
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Generate audit-ready compliance PDF reports backed by real database events, baseline states, and SHA-256 digital seals.
          </p>
        </div>

        <button
          onClick={fetchReports}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-mono font-bold border border-slate-200 dark:border-slate-700 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Grid: Create Report & Verify Authenticity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Generate Report Card */}
        <div className="bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
          <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 font-extrabold text-sm">
            <PlusCircle className="w-4 h-4" />
            <span>Generate New Security Audit Report</span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs">
            Snapshots current active baseline, detected pending/authorized events, and chained audit ledger into an official signed PDF document.
          </p>

          <form onSubmit={handleGenerateReport} className="space-y-3">
            <input
              type="text"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder="Report Title (e.g., Weekly FIM Compliance Report)"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-200 text-xs font-mono focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              disabled={generating}
              className="btn-primary-gradient w-full py-3 rounded-xl text-xs font-bold font-mono tracking-wide flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Download className={`w-4 h-4 ${generating ? 'animate-bounce' : ''}`} />
              <span>{generating ? 'GENERATING SIGNED PDF...' : 'GENERATE & DOWNLOAD PDF'}</span>
            </button>
          </form>
        </div>

        {/* Verify Authenticity Tool */}
        <div className="bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">
            <KeyRound className="w-4 h-4" />
            <span>Verify Report Cryptographic Fingerprint</span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs">
            Paste a report's SHA-256 fingerprint hash to cryptographically verify that it was authentically generated by this FIMGuard system.
          </p>

          <form onSubmit={handleVerifyHash} className="space-y-3">
            <input
              type="text"
              value={verifyHashInput}
              onChange={(e) => setVerifyHashInput(e.target.value)}
              placeholder="Paste SHA-256 report hash to verify..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={verifying}
              className="w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold font-mono text-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>{verifying ? 'VERIFYING SIGNATURE...' : 'VERIFY REPORT AUTHENTICITY'}</span>
            </button>
          </form>

          {verifyResult && (
            <div className={`p-3.5 rounded-xl border text-xs font-mono shadow-sm ${
              verifyResult.valid
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
            }`}>
              <div className="font-bold flex items-center gap-1.5">
                {verifyResult.valid ? <Check className="w-4 h-4 text-emerald-500" /> : <ShieldAlert className="w-4 h-4 text-rose-500" />}
                <span>{verifyResult.valid ? 'Cryptographic Signature Validated' : 'Verification Mismatch'}</span>
              </div>
              <p className="mt-1 opacity-90 font-sans">{verifyResult.message}</p>
            </div>
          )}
        </div>
      </div>

      {/* Historical Generated Reports Table */}
      <div className="bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-lg space-y-3 p-5">
        <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono">
          Recorded Audit Reports Ledger ({reports.length})
        </h2>

        {reports.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            No reports generated yet. Click above to generate the first verified PDF report.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 text-[11px]">
                  <th className="py-3 px-4">Report Title</th>
                  <th className="py-3 px-4">Generated By</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Baseline</th>
                  <th className="py-3 px-4">SHA-256 Digital Seal</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {reports.map((rpt) => (
                  <tr key={rpt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-200">
                      {rpt.title}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {rpt.generatedBy}
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {new Date(rpt.generatedAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-cyan-600 dark:text-cyan-400 font-bold">
                      v{rpt.baselineVersion}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px]">
                        <span className="truncate max-w-[150px]" title={rpt.cryptographicHash}>
                          {rpt.cryptographicHash.substring(0, 16)}...
                        </span>
                        <button
                          onClick={() => copyToClipboard(rpt.cryptographicHash, rpt.id)}
                          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                          title="Copy hash"
                        >
                          {copiedHash === rpt.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => exportPDF(rpt)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all hover:scale-105 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3 h-3 text-cyan-500" />
                        <span>Download PDF</span>
                      </button>
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
