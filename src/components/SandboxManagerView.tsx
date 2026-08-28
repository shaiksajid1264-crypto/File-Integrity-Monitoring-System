import React, { useState, useEffect, useRef } from "react";
import {
  FileCode2,
  Save,
  Trash2,
  Upload,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  Edit3,
  Sparkles,
  Zap,
  SplitSquareVertical,
  Check,
  X,
  Folder,
  FolderTree,
} from "lucide-react";
import { SandboxFile } from "../types";
import { api } from "../lib/api";

interface SandboxManagerViewProps {
  onTriggerScan: () => void;
}

export const SandboxManagerView: React.FC<SandboxManagerViewProps> = ({
  onTriggerScan,
}) => {
  const [files, setFiles] = useState<SandboxFile[]>([]);
  const [directories, setDirectories] = useState<string[]>([]);
  const [selectedDirectory, setSelectedDirectory] = useState<string>("ALL");
  const [selectedFile, setSelectedFile] = useState<SandboxFile | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [targetDir, setTargetDir] = useState("");
  const [targetInput, setTargetInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [viewMode, setViewMode] = useState<"editor" | "diff">("editor");
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [liveHash, setLiveHash] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const showNotification = (
    text: string,
    type: "success" | "error" | "info" = "success",
  ) => {
    setStatusMessage({ text, type });
    setTimeout(() => {
      setStatusMessage(null);
    }, 4500);
  };

  const fetchSandbox = async () => {
    setLoading(true);
    try {
      const data = await api.getSandboxFiles();
      setFiles(data.files || []);
      setDirectories(data.directories || []);
      setTargetDir(data.targetDirectory);
      setTargetInput(data.targetDirectory);

      if (data.files && data.files.length > 0) {
        if (!selectedFile) {
          const firstNonDeleted =
            data.files.find((f) => f.baselineStatus !== "DELETED") ||
            data.files[0];
          setSelectedFile(firstNonDeleted);
          setEditorContent(firstNonDeleted.content || "");
        } else {
          const updated = data.files.find(
            (f) =>
              (f.relativePath || f.name) ===
              (selectedFile.relativePath || selectedFile.name),
          );
          if (updated) {
            setSelectedFile(updated);
            if (
              viewMode === "editor" &&
              editorContent === selectedFile.content
            ) {
              setEditorContent(updated.content || "");
            }
          }
        }
      } else {
        setSelectedFile(null);
        setEditorContent("");
      }
    } catch (e: any) {
      console.error(e);
      showNotification(
        `Failed to load target filesystem: ${e.message}`,
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRealPathChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetInput.trim()) return;
    try {
      const config = await api.updateConfig({ targetDirectory: targetInput.trim() });
      setTargetDir(config.targetDirectory);
      setTargetInput(config.targetDirectory);
      setSelectedFile(null);
      showNotification(`Monitoring original files at ${config.targetDirectory}`, "success");
      await fetchSandbox();
    } catch (err: any) {
      showNotification(err.message || "The real path could not be opened", "error");
    }
  };

  useEffect(() => {
    fetchSandbox();
  }, []);

  // Compute live SHA-256 for the editor content in browser
  useEffect(() => {
    let isMounted = true;
    async function computeEditorHash() {
      if (!editorContent && editorContent !== "") return;
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(editorContent);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        if (isMounted) {
          setLiveHash(hashHex);
        }
      } catch (err) {
        // ignore
      }
    }
    computeEditorHash();
    return () => {
      isMounted = false;
    };
  }, [editorContent]);

  const handleSelectFile = (file: SandboxFile) => {
    setSelectedFile(file);
    setEditorContent(file.content || "");
    setViewMode("editor");
  };

  // SAVE / MODIFY FILE
  const handleSaveFile = async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      const filePath = selectedFile.relativePath || selectedFile.name;
      await api.editSandboxFile(
        selectedFile.name,
        editorContent,
        selectedFile.directory,
        filePath,
      );
      showNotification(
        `Saved alterations to '${filePath}'. Live SHA-256 calculated & integrity scan triggered.`,
        "success",
      );
      await fetchSandbox();
      onTriggerScan();
    } catch (err: any) {
      showNotification(`Save failed: ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  // DELETE FILE
  const handleDeleteFile = async (file: SandboxFile) => {
    const targetPath = file.relativePath || file.name;
    if (
      !window.confirm(
        `Permanently delete '${targetPath}' from disk? This will test FIM deletion anomaly detection.`,
      )
    )
      return;
    try {
      await api.deleteSandboxFile(targetPath);
      showNotification(
        `Deleted '${targetPath}' from target filesystem. FIM change event generated.`,
        "info",
      );
      await fetchSandbox();
      onTriggerScan();
    } catch (err: any) {
      showNotification(`Delete failed: ${err.message}`, "error");
    }
  };

  // UPLOAD / CHOOSE FILES OR A DIRECTORY FROM DEVICE
  const processUploadedFiles = async (fileList: FileList | File[]) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      const payload: Array<{
        name: string;
        content: string;
        relativePath?: string;
        isBase64?: boolean;
      }> = [];
      const targetFolder =
        selectedDirectory !== "ALL" && selectedDirectory !== "ROOT"
          ? selectedDirectory
          : undefined;

      for (let i = 0; i < fileList.length; i++) {
        const f = fileList[i];
        const browserRelativePath = (
          f as File & { webkitRelativePath?: string }
        ).webkitRelativePath;
        const uploadPath = browserRelativePath || f.name;
        const relativePath = targetFolder
          ? `${targetFolder}/${uploadPath}`
          : uploadPath;
        const isText =
          f.type.startsWith("text/") ||
          f.name.endsWith(".txt") ||
          f.name.endsWith(".json") ||
          f.name.endsWith(".conf") ||
          f.name.endsWith(".env") ||
          f.name.endsWith(".js") ||
          f.name.endsWith(".ts") ||
          f.name.endsWith(".py") ||
          f.name.endsWith(".sh") ||
          f.name.endsWith(".yml") ||
          f.name.endsWith(".yaml") ||
          f.name.endsWith(".xml") ||
          f.name.endsWith(".md");

        if (isText) {
          const text = await f.text();
          payload.push({
            name: f.name,
            content: text,
            relativePath,
            isBase64: false,
          });
        } else {
          // Base64 for binary files
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const res = reader.result as string;
              const b64 = res.split(",")[1] || "";
              resolve(b64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(f);
          });
          payload.push({
            name: f.name,
            content: base64,
            relativePath,
            isBase64: true,
          });
        }
      }

      const res = await api.uploadSandboxFiles(payload, targetFolder);
      showNotification(
        `Successfully uploaded ${res.count} file(s) into directory '${targetFolder || "root"}'!`,
        "success",
      );
      await fetchSandbox();
      onTriggerScan();
    } catch (err: any) {
      showNotification(`Upload failed: ${err.message}`, "error");
    } finally {
      setUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processUploadedFiles(e.target.files);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processUploadedFiles(e.dataTransfer.files);
    }
  };

  // CLEAR ALL DIRECTORY FILES
  const handleClearAll = async () => {
    if (
      !window.confirm(
        "Are you sure you want to permanently delete all files and directories in the monitored directory?",
      )
    )
      return;
    try {
      await api.clearAllSandboxFiles();
      showNotification("Monitored target directory cleared.", "success");
      setSelectedFile(null);
      await fetchSandbox();
      onTriggerScan();
    } catch (err: any) {
      showNotification(`Clear failed: ${err.message}`, "error");
    }
  };

  const getStatusBadge = (
    status?: "MATCHED" | "MODIFIED" | "UNTRACKED" | "DELETED",
  ) => {
    switch (status) {
      case "MATCHED":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-800/80 flex items-center gap-1 shadow-sm">
            <Check className="w-3 h-3" /> MATCHES BASELINE
          </span>
        );
      case "MODIFIED":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-300 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-800/80 flex items-center gap-1 animate-pulse shadow-sm">
            <AlertTriangle className="w-3 h-3" /> MODIFIED (TAMPERED)
          </span>
        );
      case "UNTRACKED":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950/80 text-cyan-300 dark:bg-cyan-950/80 dark:text-cyan-300 border border-cyan-800/80 flex items-center gap-1 shadow-sm">
            <Sparkles className="w-3 h-3" /> NEW (UNTRACKED)
          </span>
        );
      case "DELETED":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950/80 text-rose-300 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-800/80 flex items-center gap-1 shadow-sm">
            <X className="w-3 h-3" /> DELETED FROM DISK
          </span>
        );
      default:
        return null;
    }
  };

  // Filter files by selected directory
  const filteredFiles = files.filter((f) => {
    if (selectedDirectory === "ALL") return true;
    if (selectedDirectory === "ROOT") return !f.directory;
    return f.directory === selectedDirectory;
  });

  return (
    <div
      id="sandbox-view"
      className="p-6 space-y-6 max-w-7xl mx-auto font-sans text-xs transition-colors duration-300"
    >
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-lg shadow-slate-200/50 dark:shadow-slate-950/50 transition-all duration-300">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              Real Path Monitor & File Inspector
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
              RECURSIVE FIM SCOPE
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Inspect the original files in the configured absolute directory and evaluate live SHA-256 anomaly detection without sandbox copies.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-500 font-mono">
            <span>
              Root Scope:{" "}
              <code className="text-cyan-600 dark:text-cyan-400 bg-slate-100 dark:bg-slate-950 px-1.5 py-0.5 rounded font-bold border border-slate-200 dark:border-slate-800">
                {targetDir || "No real path configured"}
              </code>
            </span>
            <span>•</span>
            <span>
              Directories:{" "}
              <strong className="text-slate-700 dark:text-slate-200">
                {directories.length + 1} folders
              </strong>
            </span>
            <span>•</span>
            <span>
              Monitored Total:{" "}
              <strong className="text-slate-700 dark:text-slate-200">{files.length} files</strong>
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            multiple
            className="hidden"
          />
          <input
            type="file"
            ref={folderInputRef}
            onChange={handleFileInputChange}
            multiple
            {...({
              webkitdirectory: "",
              directory: "",
            } as React.InputHTMLAttributes<HTMLInputElement>)}
            className="hidden"
          />

          <button
            id="btn-choose-upload-files"
            hidden
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-2 transition-all duration-200 shadow-md shadow-cyan-500/20 hover:shadow-lg hover:shadow-cyan-500/30 hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{uploading ? "UPLOADING..." : "UPLOAD FILES"}</span>
          </button>

          <button
            id="btn-choose-upload-folder"
            hidden
            onClick={() => folderInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs flex items-center gap-2 transition-all duration-200 shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>{uploading ? "UPLOADING..." : "UPLOAD FOLDER"}</span>
          </button>

          <button
            id="btn-refresh-sandbox-files"
            onClick={fetchSandbox}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all duration-200 hover:scale-[1.05] active:scale-[0.95] cursor-pointer"
            title="Refresh Files from Disk"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            hidden
            onClick={handleClearAll}
            className="px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 font-semibold text-[11px] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
            title="Delete all monitored files and directories"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span>Clear Directory</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleRealPathChange} className="flex flex-col md:flex-row md:items-center gap-3 bg-cyan-50/90 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800 rounded-2xl p-4 shadow-sm">
        <div className="shrink-0">
          <div className="font-extrabold text-cyan-800 dark:text-cyan-300 text-xs">DIRECT FILESYSTEM PATH</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">Existing absolute directory; no upload or copy</div>
        </div>
        <input value={targetInput} onChange={e => setTargetInput(e.target.value)} placeholder="C:\\Users\\you\\Documents\\critical-files" className="flex-1 px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-cyan-300 dark:border-cyan-800 rounded-xl font-mono text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500" />
        <button type="submit" className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs shadow-md cursor-pointer">OPEN & MONITOR REAL PATH</button>
      </form>

      {/* Notification Toast */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all shadow-md ${
            statusMessage.type === "error"
              ? "bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
              : statusMessage.type === "info"
                ? "bg-amber-50 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"
                : "bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {statusMessage.type === "error" ? (
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            ) : statusMessage.type === "info" ? (
              <Zap className="w-4 h-4 text-amber-500 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            )}
            <span className="font-semibold">{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Drag & Drop Dropzone */}
      <div
        hidden
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all duration-300 ${
          dragOver
            ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-200 shadow-lg shadow-cyan-500/10 scale-[1.01]"
            : "border-slate-300 dark:border-slate-800 hover:border-cyan-400 dark:hover:border-cyan-600 bg-white/50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
        }`}
      >
        <div className="flex items-center justify-center gap-3">
          <Upload
            className={`w-5 h-5 transition-transform duration-300 ${dragOver ? "text-cyan-500 scale-125 animate-bounce" : "text-slate-400"}`}
          />
          <span className="font-semibold text-xs">
            Drag & drop files from your computer to upload directly into directory:{" "}
            <strong className="text-cyan-600 dark:text-cyan-300 font-mono">
              {selectedDirectory === "ALL" ? "/" : selectedDirectory}
            </strong>
          </span>
        </div>
      </div>

      {/* Directory Folder Selector Pills */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center gap-2 overflow-x-auto shadow-sm">
        <span className="text-slate-500 dark:text-slate-400 font-bold text-[11px] font-mono uppercase tracking-wider flex items-center gap-1 shrink-0 pl-1">
          <FolderTree className="w-3.5 h-3.5 text-indigo-500" />
          Folders:
        </span>

        <button
          onClick={() => setSelectedDirectory("ALL")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
            selectedDirectory === "ALL"
              ? "bg-cyan-500 text-white font-bold shadow-md shadow-cyan-500/30 scale-[1.02]"
              : "bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
          }`}
        >
          <Folder className="w-3.5 h-3.5" />
          <span>All ({files.length})</span>
        </button>

        <button
          onClick={() => setSelectedDirectory("ROOT")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
            selectedDirectory === "ROOT"
              ? "bg-cyan-500 text-white font-bold shadow-md shadow-cyan-500/30 scale-[1.02]"
              : "bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
          }`}
        >
          <Folder className="w-3.5 h-3.5 text-slate-400" />
          <span>Root / ({files.filter((f) => !f.directory).length})</span>
        </button>

        {directories.map((dir) => {
          const count = files.filter((f) => f.directory === dir).length;
          const isSelected = selectedDirectory === dir;
          return (
            <button
              key={dir}
              onClick={() => setSelectedDirectory(dir)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                isSelected
                  ? "bg-indigo-600 text-white font-bold shadow-md shadow-indigo-500/30 scale-[1.02]"
                  : "bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-indigo-300 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-indigo-900/50"
              }`}
            >
              <Folder className="w-3.5 h-3.5 text-indigo-500" />
              <span>
                {dir}/ ({count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Main File Explorer & Live Editor Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* File Explorer Column */}
        <div className="lg:col-span-4 bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 flex flex-col justify-between shadow-md">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] font-mono">
                {selectedDirectory === "ALL"
                  ? "Monitored Target Files"
                  : `${selectedDirectory}/ Files`}{" "}
                ({filteredFiles.length})
              </span>
            </div>

            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {filteredFiles.length === 0 ? (
                <div className="py-12 text-center text-slate-400 dark:text-slate-500">
                  No files found in this directory folder.
                </div>
              ) : (
                filteredFiles.map((file) => {
                  const isSelected =
                    selectedFile?.relativePath === file.relativePath ||
                    selectedFile?.name === file.name;
                  const isDeleted = file.baselineStatus === "DELETED";
                  const displayPath = file.relativePath || file.name;

                  return (
                    <div
                      key={displayPath}
                      onClick={() => handleSelectFile(file)}
                      className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col gap-2 group ${
                        isSelected
                          ? "bg-cyan-50 dark:bg-cyan-950/40 border-cyan-500 text-slate-900 dark:text-slate-100 shadow-md shadow-cyan-500/10 scale-[1.01]"
                          : isDeleted
                            ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60 text-slate-500 dark:text-slate-400 hover:border-rose-400"
                            : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800/90 text-slate-700 dark:text-slate-300 hover:border-cyan-400 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileCode2
                            className={`w-4 h-4 shrink-0 transition-colors ${isSelected ? "text-cyan-600 dark:text-cyan-400" : isDeleted ? "text-rose-500" : "text-slate-400 group-hover:text-cyan-500"}`}
                          />
                          <div className="min-w-0 truncate">
                            <span
                              className={`font-bold text-xs truncate ${isDeleted ? "line-through text-rose-500 dark:text-rose-400" : "text-slate-800 dark:text-slate-200"}`}
                            >
                              {file.name}
                            </span>
                            {file.directory && (
                              <span className="block text-[10px] text-indigo-600 dark:text-indigo-400 font-mono truncate">
                                {file.directory}/
                              </span>
                            )}
                          </div>
                        </div>

                        {getStatusBadge(file.baselineStatus)}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span>
                          {isDeleted ? "Missing on disk" : `${file.size} Bytes`}
                        </span>
                        <span
                          className="truncate max-w-[130px] text-slate-400"
                          title={file.hash || file.baselineHash || ""}
                        >
                          {file.hash
                            ? `${file.hash.substring(0, 10)}...`
                            : `Base: ${file.baselineHash?.substring(0, 8)}...`}
                        </span>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-200 dark:border-slate-800/60 opacity-90 group-hover:opacity-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFile(file);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-300 border border-slate-200 dark:border-slate-800 text-[10px] font-semibold flex items-center gap-1 transition-all duration-200 hover:scale-105 cursor-pointer"
                          title="Delete file"
                        >
                          <Trash2 className="w-3 h-3 text-rose-500" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 font-mono flex justify-between items-center">
            <span>
              Scope: <code className="text-slate-700 dark:text-slate-400">./{targetDir}</code>
            </span>
          </div>
        </div>

        {/* Live File Editor / Baseline Diff View */}
        <div className="lg:col-span-8 bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-md flex flex-col justify-between space-y-4">
          {selectedFile ? (
            <div className="space-y-4 flex-1 flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
                      {selectedFile.relativePath || selectedFile.name}
                    </h2>
                    {getStatusBadge(selectedFile.baselineStatus)}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-1 space-y-0.5">
                    <p>
                      Current Disk SHA-256:{" "}
                      <code className="text-cyan-600 dark:text-cyan-300 font-bold">
                        {selectedFile.hash || "None (Deleted from disk)"}
                      </code>
                    </p>
                    {selectedFile.baselineHash && (
                      <p>
                        Baseline Snapshot SHA-256:{" "}
                        <code className="text-slate-600 dark:text-slate-400">
                          {selectedFile.baselineHash}
                        </code>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex rounded-xl bg-slate-100 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800">
                    <button
                      onClick={() => setViewMode("editor")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
                        viewMode === "editor"
                          ? "bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-300 shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                      }`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Editor</span>
                    </button>
                    <button
                      onClick={() => setViewMode("diff")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
                        viewMode === "diff"
                          ? "bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-300 shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                      }`}
                    >
                      <SplitSquareVertical className="w-3.5 h-3.5" />
                      <span>Compare Baseline</span>
                    </button>
                  </div>

                  <button
                    id="btn-save-sandbox-file"
                    onClick={handleSaveFile}
                    disabled={saving}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all duration-200 shadow-md shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
                  >
                    <Save
                      className={`w-3.5 h-3.5 ${saving ? "animate-spin" : ""}`}
                    />
                    <span>{saving ? "WRITING..." : "SAVE & TRIGGER FIM"}</span>
                  </button>
                </div>
              </div>

              {/* View Modes */}
              {viewMode === "editor" ? (
                <div className="space-y-3 flex-1 flex flex-col">
                  <div className="flex-1 min-h-[360px] relative">
                    <textarea
                      id="sandbox-file-editor"
                      value={editorContent}
                      onChange={(e) => setEditorContent(e.target.value)}
                      placeholder="Enter file contents..."
                      className="w-full h-full min-h-[360px] bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500 resize-none leading-relaxed selection:bg-cyan-500/30 transition-colors duration-200 shadow-inner"
                      spellCheck={false}
                    />
                  </div>

                  {/* Live Hash Calculation Bar */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500 font-mono">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                      <span>Live In-Memory SHA-256:</span>
                      <code className="text-cyan-600 dark:text-cyan-300 font-bold">
                        {liveHash}
                      </code>
                    </div>
                    <div>
                      {selectedFile.baselineHash &&
                      liveHash === selectedFile.baselineHash ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          Matches Baseline
                        </span>
                      ) : selectedFile.baselineHash ? (
                        <span className="text-amber-600 dark:text-amber-400 font-bold">
                          Altered vs Baseline
                        </span>
                      ) : (
                        <span className="text-cyan-600 dark:text-cyan-400 font-bold">
                          New Uncommitted Hash
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Diff View */
                <div className="space-y-3 flex-1 flex flex-col">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 min-h-[340px]">
                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2">
                      <div className="font-bold text-slate-600 dark:text-slate-400 text-xs flex justify-between">
                        <span>Trusted Baseline Snapshot</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {selectedFile.baselineHash ? "Snapshot Active" : "None"}
                        </span>
                      </div>
                      <pre className="font-mono text-[11px] text-slate-600 dark:text-slate-400 overflow-auto max-h-[300px] whitespace-pre-wrap">
                        {selectedFile.content ||
                          "(No baseline snapshot content recorded)"}
                      </pre>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2">
                      <div className="font-bold text-cyan-600 dark:text-cyan-400 text-xs flex justify-between">
                        <span>Current Working Content (Editor)</span>
                        <span className="text-[10px] text-cyan-600 dark:text-cyan-300 font-mono">Live</span>
                      </div>
                      <pre className="font-mono text-[11px] text-cyan-700 dark:text-cyan-200 overflow-auto max-h-[300px] whitespace-pre-wrap">
                        {editorContent || "(Empty content)"}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Metadata */}
              <div className="text-[11px] text-slate-500 font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-3 border-t border-slate-200 dark:border-slate-800">
                <span>
                  Disk target:{" "}
                  <code className="text-slate-700 dark:text-slate-400">
                    {targetDir}/{selectedFile.relativePath || selectedFile.name}
                  </code>
                </span>
                <span>
                  Lines:{" "}
                  <strong className="text-slate-700 dark:text-slate-300">
                    {editorContent.split("\n").length}
                  </strong>{" "}
                  • Characters:{" "}
                  <strong className="text-slate-700 dark:text-slate-300">
                    {editorContent.length}
                  </strong>
                </span>
              </div>
            </div>
          ) : (
            <div className="py-32 text-center text-slate-400 dark:text-slate-500 space-y-4">
              <FolderOpen className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
              <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
                Select or Upload a File to Test FIM
              </p>
              <p className="text-xs max-w-md mx-auto text-slate-500 dark:text-slate-400">
                Configure a real absolute path in Settings, then select an existing file from the explorer to view live diffs and SHA-256 hashes.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs inline-flex items-center gap-2 cursor-pointer shadow-md shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Files From Device</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
