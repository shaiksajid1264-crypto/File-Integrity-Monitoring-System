import {
  DashboardStats,
  Baseline,
  IntegrityEvent,
  HashLogEntry,
  AuditLogEntry,
  BaselineVerificationResult,
  ExclusionRule,
  GeneratedReport,
  SelfIntegrityFile,
  SandboxFile,
  User
} from '../types';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('fimguard_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  // Auth
  async login(username: string, password: string): Promise<{ token: string; user: User }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    return handleResponse(res);
  },

  async logout(): Promise<{ success: boolean }> {
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  async getMe(): Promise<User> {
    const res = await fetch('/api/auth/me', {
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  // Dashboard
  async getDashboardStats(): Promise<DashboardStats> {
    const res = await fetch('/api/dashboard/stats', {
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  async getStats(): Promise<DashboardStats> {
    return this.getDashboardStats();
  },

  // Realtime SSE Subscriptions
  subscribeToEvents(onEvent: (data: any) => void): () => void {
    const eventSource = new EventSource('/api/events/stream');

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onEvent(parsed);
      } catch (err) {
        console.error('Failed to parse SSE payload:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.warn('SSE stream error/reconnecting:', err);
    };

    return () => {
      eventSource.close();
    };
  },

  // Baselines
  async getBaselines(): Promise<Baseline[]> {
    const res = await fetch('/api/baselines', {
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  async getBaselineById(id: string): Promise<Baseline> {
    const res = await fetch(`/api/baselines/${id}`, {
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  async createBaseline(targetPath?: string, name?: string, notes?: string, selectedFiles?: string[]): Promise<Baseline> {
    const res = await fetch('/api/baselines', {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify({ targetPath, name, notes, selectedFiles })
    });
    return handleResponse(res);
  },

  async activateBaseline(id: string): Promise<{ success: boolean; activeBaseline: Baseline }> {
    const res = await fetch(`/api/baselines/${id}/activate`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  async verifyBaseline(id: string): Promise<BaselineVerificationResult> {
    const res = await fetch(`/api/baselines/${id}/verify`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  async getVerifications(): Promise<BaselineVerificationResult[]> {
    const res = await fetch('/api/verifications', {
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  // Events & Reviews
  async getEvents(status?: string, changeType?: string, search?: string): Promise<IntegrityEvent[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (changeType) params.append('changeType', changeType);
    if (search) params.append('search', search);

    const res = await fetch(`/api/events?${params.toString()}`, {
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  async getEventById(id: string): Promise<IntegrityEvent> {
    const res = await fetch(`/api/events/${id}`, {
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  async reviewEvent(eventId: string, decision: 'APPROVE' | 'REJECT' | 'RESOLVE', notes?: string): Promise<IntegrityEvent> {
    const res = await fetch(`/api/events/${eventId}/review`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify({ decision, notes })
    });
    return handleResponse(res);
  },

  async restoreFile(eventId: string): Promise<{ success: boolean; message: string; event?: IntegrityEvent; verification: { expectedHash: string; restoredHash: string; match: boolean } }> {
    const res = await fetch(`/api/events/${eventId}/restore`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  // Hash Logs
  async getHashLogs(search?: string, trigger?: string, status?: string): Promise<HashLogEntry[]> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (trigger) params.append('trigger', trigger);
    if (status) params.append('status', status);

    const res = await fetch(`/api/hash-logs?${params.toString()}`, {
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  // Audit Logs & Cryptographic Ledger Verification
  async getAuditLogs(): Promise<AuditLogEntry[]> {
    const res = await fetch('/api/audit-logs', {
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  async verifyAuditChain(): Promise<{ valid: boolean; totalEntries: number; brokenIndex?: number; reason?: string }> {
    const res = await fetch('/api/audit-logs/verify-chain', {
      method: 'POST',
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  // Scanning
  async triggerScan(): Promise<{ success: boolean; timestamp: string; detectedCount: number; events: IntegrityEvent[] }> {
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  // Self Integrity
  async getSelfIntegrity(): Promise<{ files: SelfIntegrityFile[]; allPassed: boolean }> {
    const res = await fetch('/api/self-integrity', {
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  async verifySelfIntegrity(): Promise<{ files: SelfIntegrityFile[]; allPassed: boolean }> {
    const res = await fetch('/api/self-integrity/verify', {
      method: 'POST',
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  async initializeSelfIntegrity(): Promise<{ files: SelfIntegrityFile[]; allPassed: boolean }> {
    const res = await fetch('/api/self-integrity/initialize', {
      method: 'POST',
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  // Exclusions
  async getExclusions(): Promise<ExclusionRule[]> {
    const res = await fetch('/api/exclusions', {
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  async addExclusion(pattern: string, description?: string): Promise<ExclusionRule> {
    const res = await fetch('/api/exclusions', {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify({ pattern, description })
    });
    return handleResponse(res);
  },

  async toggleExclusion(id: string): Promise<ExclusionRule> {
    const res = await fetch(`/api/exclusions/${id}/toggle`, {
      method: 'PUT',
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  async deleteExclusion(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/exclusions/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  // Reports
  async getReports(): Promise<GeneratedReport[]> {
    const res = await fetch('/api/reports', {
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  async generateReport(title?: string): Promise<GeneratedReport> {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify({ title })
    });
    return handleResponse(res);
  },

  async verifyReportHash(hash: string): Promise<{ valid: boolean; report?: GeneratedReport; message: string }> {
    const res = await fetch('/api/reports/verify-hash', {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify({ hash })
    });
    return handleResponse(res);
  },

  // Target / Sandbox Files & Directory Manager
  async getSandboxFiles(): Promise<{ targetDirectory: string; files: SandboxFile[]; directories: string[] }> {
    const res = await fetch('/api/sandbox/files', {
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  async createSandboxDirectory(directoryName: string, parentDirectory?: string): Promise<{ success: boolean; relativePath: string }> {
    const res = await fetch('/api/sandbox/directories', {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify({ directoryName, parentDirectory })
    });
    return handleResponse(res);
  },

  async createSandboxFile(fileName: string, content: string, directory?: string, relativePath?: string): Promise<{ success: boolean; filePath: string; relativePath: string }> {
    const res = await fetch('/api/sandbox/files', {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify({ fileName, content, directory, relativePath })
    });
    return handleResponse(res);
  },

  async editSandboxFile(fileName: string, content: string, directory?: string, relativePath?: string): Promise<{ success: boolean; relativePath: string }> {
    const res = await fetch('/api/sandbox/files', {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify({ fileName, content, directory, relativePath })
    });
    return handleResponse(res);
  },

  async uploadSandboxFiles(files: Array<{ name: string; content: string; relativePath?: string; isBase64?: boolean }>, targetFolder?: string): Promise<{ success: boolean; count: number; savedFiles: string[] }> {
    const res = await fetch('/api/sandbox/upload', {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify({ files, targetFolder })
    });
    return handleResponse(res);
  },

  async deleteSandboxFile(pathOrName: string): Promise<{ success: boolean; relativePath: string }> {
    const res = await fetch(`/api/sandbox/files/${encodeURIComponent(pathOrName)}?path=${encodeURIComponent(pathOrName)}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  async clearAllSandboxFiles(): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/sandbox/clear-all', {
      method: 'POST',
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  // System Config
  async getConfig(): Promise<any> {
    const res = await fetch('/api/config', {
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  async updateConfig(payload: { targetDirectory?: string; realtimeMonitoring?: boolean; autoScanIntervalSeconds?: number }): Promise<any> {
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  }
};
