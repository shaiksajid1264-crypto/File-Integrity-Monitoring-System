import React, { useState } from 'react';
import { Shield, Lock, User, KeyRound, AlertTriangle, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const presets = [
    { label: 'Admin (CSO)', user: 'admin', pass: 'admin123', role: 'Full Access & Baseline Control' },
    { label: 'SOC Analyst', user: 'analyst', pass: 'analyst123', role: 'Event Review & Approvals' },
    { label: 'Auditor', user: 'auditor', pass: 'auditor123', role: 'Audit Ledger Verification' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(username.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Invalid officer credentials. Please check your username and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPreset = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 font-sans transition-colors duration-300">
      <div className="w-full max-w-md bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl shadow-slate-200/60 dark:shadow-slate-950/80 space-y-6">
        {/* Logo & Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 border border-cyan-400 text-white shadow-lg shadow-cyan-500/20 hover:scale-105 transition-transform duration-300">
            <Shield className="w-9 h-9" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">FIMGuard</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Enterprise File Integrity Monitoring & Cryptographic Ledger</p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2 font-mono">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
          <div className="space-y-1.5">
            <label className="block text-slate-700 dark:text-slate-300 font-bold">Officer Username</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="input-login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                required
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-slate-700 dark:text-slate-300 font-bold">Cryptographic Key / Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="input-login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          <button
            id="btn-login-submit"
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all duration-200 shadow-md shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            <KeyRound className="w-4 h-4" />
            <span>{loading ? 'AUTHENTICATING...' : 'ENTER FIMGUARD CONSOLE'}</span>
          </button>
        </form>

        {/* Quick Role Selection Presets */}
        <div className="space-y-2">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1.5 font-mono">
            <UserCheck className="w-3.5 h-3.5 text-cyan-500" />
            <span>Quick Persona Presets:</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {presets.map((p) => {
              const isSelected = username === p.user;
              return (
                <button
                  key={p.user}
                  type="button"
                  onClick={() => handleSelectPreset(p.user, p.pass)}
                  className={`p-2.5 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-500 text-cyan-900 dark:text-cyan-200 shadow-sm scale-[1.02]'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <p className="font-bold text-[11px] truncate">{p.label}</p>
                  <p className="text-[9px] font-mono text-slate-400 dark:text-slate-500 truncate">{p.user}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
