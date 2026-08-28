import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Layers,
  RefreshCw,
  FolderSearch,
  KeyRound,
  Upload,
  CheckSquare,
  Square,
  FileCode2
} from 'lucide-react';
import { api } from '../lib/api';
import { Baseline, SandboxFile } from '../types';

interface CreateBaselineModalProps {
  onClose: () => void;
  onBaselineCreated: (baseline: Baseline) => void;
}

export const CreateBaselineModal: React.FC<CreateBaselineModalProps> = ({
  onClose,
  onBaselineCreated
}) => {
  const [targetPath, setTargetPath] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // File selection state
  const [availableFiles, setAvailableFiles] = useState<SandboxFile[]>([]);
  const [selectedFilePaths, setSelectedFilePaths] = useState<Set<string>>(new Set());
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = async () => {
    setLoadingFiles(true);
    try {
      const data = await api.getSandboxFiles();
      const nonDeleted = data.files.filter(f => f.baselineStatus !== 'DELETED');
      setAvailableFiles(nonDeleted);
      setSelectedFilePaths(new Set(nonDeleted.map(f => f.relativePath || f.name)));
    } catch (err) {
      console.error('Failed to load files:', err);
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    Promise.all([fetchFiles(), api.getConfig().then(config => setTargetPath(config.targetDirectory || ''))]);
  }, []);

  const toggleFile = (pathName: string) => {
    const next = new Set(selectedFilePaths);
    if (next.has(pathName)) {
      next.delete(pathName);
    } else {
      next.add(pathName);
    }
    setSelectedFilePaths(next);
  };

  const selectAll = () => {
    setSelectedFilePaths(new Set(availableFiles.map(f => f.relativePath || f.name)));
  };

  const deselectAll = () => {
    setSelectedFilePaths(new Set());
  };

  const handleUploadNewFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    try {
      const payload: Array<{ name: string; content: string; isBase64?: boolean }> = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const isText = file.type.startsWith('text/') ||
          file.name.endsWith('.txt') || file.name.endsWith('.json') || file.name.endsWith('.conf') ||
          file.name.endsWith('.env') || file.name.endsWith('.js') || file.name.endsWith('.ts') ||
          file.name.endsWith('.py') || file.name.endsWith('.sh') || file.name.endsWith('.yml') ||
          file.name.endsWith('.yaml') || file.name.endsWith('.xml') || file.name.endsWith('.md');

        if (isText) {
          const text = await file.text();
          payload.push({ name: file.name, content: text, isBase64: false });
        } else {
          const b64 = await new Promise<string>((res, rej) => {
            const reader = new FileReader();
            reader.onload = () => res((reader.result as string).split(',')[1] || '');
            reader.onerror = rej;
            reader.readAsDataURL(file);
          });
          payload.push({ name: file.name, content: b64, isBase64: true });
        }
      }

      await api.uploadSandboxFiles(payload);
      await fetchFiles();
    } catch (err: any) {
      setError(`Failed to upload files: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFilePaths.size === 0) {
      setError('Please select at least one file to include in the baseline.');
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      const created = await api.createBaseline(
        targetPath.trim() || undefined,
        name.trim() || undefined,
        notes.trim() || undefined,
        Array.from(selectedFilePaths)
      );
      onBaselineCreated(created);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to generate baseline');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto font-sans text-xs transition-colors duration-300">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-950 border border-cyan-300 dark:border-cyan-800 flex items-center justify-center text-cyan-700 dark:text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 font-mono">Establish Trusted Baseline</h2>
              <p className="text-[11px] text-slate-500 font-mono">Select original real-path files to snapshot their cryptographic state</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleGenerate} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto font-sans">
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-xl font-mono">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-slate-700 dark:text-slate-300 font-bold font-mono">Choose Files ({selectedFilePaths.size}/{availableFiles.length} Selected)</label>
              <div className="flex items-center gap-2 font-mono">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleUploadNewFiles}
                  multiple
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="text-cyan-600 dark:text-cyan-400 hover:underline text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Upload className="w-3 h-3" />
                  <span>{uploading ? 'Uploading...' : 'Upload More'}</span>
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-[11px] font-semibold"
                >
                  All
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-[11px] font-semibold"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl p-2 max-h-44 overflow-y-auto space-y-1 font-mono">
              {loadingFiles ? (
                <div className="p-4 text-center text-slate-400">Loading files from disk...</div>
              ) : availableFiles.length === 0 ? (
                <div className="p-4 text-center text-slate-400 space-y-2">
                  <p>No target files found in directory.</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-cyan-600 text-white font-bold rounded-lg cursor-pointer shadow-md"
                  >
                    Upload Files Now
                  </button>
                </div>
              ) : (
                availableFiles.map((file) => {
                  const key = file.relativePath || file.name;
                  const isChecked = selectedFilePaths.has(key);
                  return (
                    <div
                      key={key}
                      onClick={() => toggleFile(key)}
                      className={`p-2.5 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-cyan-100 dark:bg-cyan-950/40 text-slate-900 dark:text-slate-100 border border-cyan-300 dark:border-cyan-800/40'
                          : 'bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <FileCode2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <div className="min-w-0 truncate">
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">{file.name}</span>
                          {file.directory && (
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 ml-1.5 font-mono">({file.directory}/)</span>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {file.size} B
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-1.5 font-mono">
            <label className="block text-slate-700 dark:text-slate-300 font-bold">Target Scope Directory</label>
            <div className="relative">
              <FolderSearch className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                placeholder="Configured absolute real path"
                required
                className="w-full pl-10 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="space-y-1.5 font-mono">
            <label className="block text-slate-700 dark:text-slate-300 font-bold">Baseline Name / Label</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Master Production Baseline (v2)"
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="space-y-1.5 font-mono">
            <label className="block text-slate-700 dark:text-slate-300 font-bold">Establishment Notes / Change Authorization</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Verified and approved clean release state..."
              className="w-full h-16 px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500 resize-none"
            />
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1 text-[11px] text-slate-500 font-mono">
            <div className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400 font-bold">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Real Cryptographic Guarantee</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-sans">
              Each chosen file is hashed with SHA-256 and snapshotted for automated change and tampering detection.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5 font-mono">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={generating || selectedFilePaths.size === 0}
              className="btn-primary-gradient px-5 py-2 rounded-xl text-xs font-bold font-mono tracking-wide flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
              <span>{generating ? 'COMPUTING BASELINE...' : `CREATE BASELINE (${selectedFilePaths.size} FILES)`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
