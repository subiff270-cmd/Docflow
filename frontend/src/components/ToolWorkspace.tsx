"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { ToolItem } from "../lib/toolsData";
import { useAuth } from "../context/AuthContext";
import { processToolApi, getDownloadUrl } from "../lib/api";
import ToolIcon from "./ToolIcon";
import {
  UploadCloud,
  FileText,
  File,
  X,
  Download,
  AlertCircle,
  CheckCircle2,
  Lock,
  RotateCw,
  Sliders,
  Sparkles,
  ArrowRight,
  Globe,
  RefreshCw,
  ShieldCheck,
  Zap,
  Trash2,
  Smartphone,
  ChevronRight,
  Check,
  Crown
} from "lucide-react";

interface ToolWorkspaceProps {
  tool: ToolItem;
}

export default function ToolWorkspace({ tool }: ToolWorkspaceProps) {
  const { user, profile, openAuthModal, refreshProfile } = useAuth();

  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tool Specific Options
  const [splitMode, setSplitMode] = useState("ranges");
  const [ranges, setRanges] = useState("1-2");
  const [everyN, setEveryN] = useState(1);
  const [pagesToRemove, setPagesToRemove] = useState("1");

  const [compressLevel, setCompressLevel] = useState("medium");
  const [rotateAngle, setRotateAngle] = useState("90");
  const [password, setPassword] = useState("");
  const [watermarkText, setWatermarkText] = useState("CONFIDENTIAL");
  const [ocrLanguage, setOcrLanguage] = useState("English");

  const [cropX, setCropX] = useState(10);
  const [cropY, setCropY] = useState(10);
  const [cropW, setCropW] = useState(80);
  const [cropH, setCropH] = useState(80);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleFilesSelect = (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return;
    if (tool.multiple) {
      setFiles((prev) => [...prev, ...selectedFiles]);
    } else {
      setFiles(selectedFiles.slice(0, 1));
    }
    setError(null);
    setResult(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFilesSelect(Array.from(e.target.files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFilesSelect(Array.from(e.dataTransfer.files));
    }
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const resetAll = () => {
    setFiles([]);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0 && tool.endpoint !== "html-to-pdf") {
      setError("Please select at least one file to process.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    if (files.length > 0) {
      formData.append("file", files[0]);
    }

    // Append options depending on tool
    if (tool.id === "split-pdf") {
      formData.append("split_mode", splitMode);
      formData.append("ranges", ranges);
      formData.append("every_n", String(everyN));
    } else if (tool.id === "remove-pages") {
      formData.append("pages", pagesToRemove);
    } else if (tool.id === "extract-pages") {
      formData.append("ranges", ranges);
    } else if (tool.id === "compress-pdf") {
      formData.append("level", compressLevel);
    } else if (tool.id === "rotate-pdf") {
      formData.append("angle", rotateAngle);
    } else if (tool.id === "unlock-pdf" || tool.id === "protect-pdf") {
      formData.append("password", password);
    } else if (tool.id === "add-watermark") {
      formData.append("text", watermarkText);
    } else if (tool.id === "ocr-pdf" || tool.id === "indian-language-documents" || tool.id === "image-to-text") {
      formData.append("language", ocrLanguage);
    } else if (tool.id === "crop-pdf") {
      formData.append("crop_x", String(cropX));
      formData.append("crop_y", String(cropY));
      formData.append("crop_w", String(cropW));
      formData.append("crop_h", String(cropH));
    }

    try {
      const data = await processToolApi(tool.endpoint, formData, user?.uid);
      setResult(data);
      if (refreshProfile) refreshProfile();
    } catch (err: any) {
      let msg = typeof err === "string" ? err : err.message || "Unable to process this file. Please check file format and try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const languages = [
    "English", "Hindi", "Tamil", "Telugu", "Kannada", "Malayalam",
    "Bengali", "Marathi", "Gujarati", "Punjabi", "Urdu"
  ];

  const getAcceptedBadge = () => {
    if (tool.accept.includes(".pdf")) return "PDF";
    if (tool.accept.includes(".docx")) return "DOCX";
    if (tool.accept.includes(".xlsx")) return "XLSX";
    if (tool.accept.includes(".pptx")) return "PPTX";
    if (tool.accept.includes(".jpg") || tool.accept.includes("image")) return "IMAGE";
    return tool.accept.replace(/\./g, "").toUpperCase();
  };

  const isPro = profile?.plan === "PRO";
  const usedCount = profile?.period_usage ?? 0;
  const maxQuota = profile?.max_quota ?? 10;
  const isLimitReached = !isPro && usedCount >= maxQuota;

  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-10 px-4 sm:px-6">
      {/* 1. Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-6">
        <Link href="/" className="hover:text-indigo-600 transition">Home</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="capitalize">{tool.category.toLowerCase()}</span>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-800 font-semibold">{tool.name}</span>
      </nav>

      {/* 2. Tool Hero Section with Ambient Glow */}
      <div className="relative text-center mb-8 sm:mb-10">
        {/* Subtle Ambient Radial Glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 sm:w-96 h-40 rounded-full pointer-events-none -z-10"
          style={{
            background: "radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.06) 50%, transparent 80%)",
            filter: "blur(40px)",
          }}
          aria-hidden="true"
        />

        <div className="flex flex-col items-center gap-3">
          {/* Dynamic Tool Icon Component */}
          <ToolIcon toolId={tool.id} />

          <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-[11px] font-extrabold px-3.5 py-1 rounded-full uppercase tracking-wider border border-indigo-100/60">
            <Sparkles className="w-3 h-3" />
            {tool.category}
          </span>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
            {tool.name}
          </h1>

          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto leading-relaxed">
            {tool.description}
          </p>
        </div>
      </div>

      {/* 3. Usage Quota Indicator (Real Account Data) */}
      <div className="mb-6 bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
            {isPro ? <Crown className="w-4 h-4 text-amber-500" /> : <Zap className="w-4 h-4 text-indigo-600" />}
          </div>
          <div>
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <span>{isPro ? "DocFlow Pro Plan" : "Free Plan"}</span>
              {isPro && (
                <span className="bg-amber-400 text-slate-950 font-extrabold text-[9px] px-2 py-0.5 rounded-full uppercase">
                  UNLIMITED
                </span>
              )}
            </div>
            <p className="text-slate-500 text-[11px]">
              {isPro
                ? "Unlimited conversions • Up to 500 MB per file"
                : `${usedCount} / ${maxQuota} free conversions used • 25 MB max file size`}
            </p>
          </div>
        </div>

        {!isPro && (
          <div className="flex items-center gap-3">
            {/* Progress bar */}
            <div className="hidden md:block w-28 bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, (usedCount / maxQuota) * 100)}%` }}
              />
            </div>
            <Link
              href="/pricing"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1"
            >
              <span>Upgrade to Pro</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>

      {/* 4. Quota Limit Reached Alert Banner */}
      {isLimitReached && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>You&apos;ve reached your free monthly conversion limit ({maxQuota} files). Upgrade to DocFlow Pro for unlimited high-speed access.</span>
          </div>
          <Link
            href="/pricing"
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs text-center shrink-0 transition"
          >
            Upgrade for ₹99/mo
          </Link>
        </div>
      )}

      {/* 5. Main Workspace Container */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-8 shadow-xl shadow-slate-100/50 relative overflow-hidden">
        {/* Special Notice for AI & Translation modular features */}
        {(tool.id === "ai-pdf-summarizer" || tool.id === "translate-pdf") && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs sm:text-sm flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <strong>Modular Demo:</strong> External AI provider configuration is required in server settings for full automated batch execution.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Upload Area (Shown when no files are chosen or when in multi-file mode) */}
          {files.length === 0 ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer group ${
                isDragging
                  ? "border-indigo-600 bg-indigo-50/60 shadow-lg shadow-indigo-500/10"
                  : "border-slate-200 hover:border-indigo-500/80 bg-slate-50/40 hover:bg-indigo-50/20"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={tool.accept}
                multiple={tool.multiple}
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Upload Icon */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-md shadow-indigo-500/10">
                <UploadCloud className="w-8 h-8 sm:w-10 sm:h-10" />
              </div>

              <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition">
                Drop your file here
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
                or click to browse from your device
              </p>

              {/* Format & Size Badges */}
              <div className="flex items-center justify-center gap-2 mt-4">
                <span className="bg-slate-100 text-slate-600 text-[10px] font-extrabold px-2.5 py-1 rounded-lg uppercase">
                  {getAcceptedBadge()}
                </span>
                <span className="bg-slate-100 text-slate-600 text-[10px] font-extrabold px-2.5 py-1 rounded-lg uppercase">
                  MAX {isPro ? "500 MB" : "25 MB"}
                </span>
              </div>
            </div>
          ) : (
            /* File Selected State: Premium File Queue Card */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                  {tool.multiple ? `Selected Files (${files.length})` : "Selected File"}
                </h4>
                <button
                  type="button"
                  onClick={resetAll}
                  className="text-xs font-bold text-slate-400 hover:text-red-600 flex items-center gap-1 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear All
                </button>
              </div>

              <div className="space-y-2.5">
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 bg-slate-50/80 hover:bg-slate-50 rounded-2xl border border-slate-200/80 transition"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      {tool.multiple ? (
                        <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                      )}
                      <div className="overflow-hidden">
                        <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {f.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                          <span>{formatFileSize(f.size)}</span>
                          <span>•</span>
                          <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> Ready to process
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add More Files Button (for multi-file tools) */}
              {tool.multiple && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 border-2 border-dashed border-slate-200 hover:border-indigo-500 rounded-xl text-xs font-bold text-slate-600 hover:text-indigo-600 transition flex items-center justify-center gap-1.5"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={tool.accept}
                    multiple={tool.multiple}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <span>+ Add another file</span>
                </button>
              )}
            </div>
          )}

          {/* 6. Tool-Specific Options */}
          {files.length > 0 && [
            "split-pdf", "remove-pages", "extract-pages", "compress-pdf",
            "rotate-pdf", "unlock-pdf", "protect-pdf", "add-watermark",
            "ocr-pdf", "indian-language-documents", "image-to-text", "crop-pdf"
          ].includes(tool.id) && (
            <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-4">
              <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-indigo-600" />
                Tool Configuration
              </h4>

              {/* Split PDF */}
              {tool.id === "split-pdf" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Split Mode</label>
                    <select
                      value={splitMode}
                      onChange={(e) => setSplitMode(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                    >
                      <option value="ranges">Page Ranges (e.g. 1-2, 5-8)</option>
                      <option value="individual">Extract Every Single Page</option>
                      <option value="every_n">Split Every N Pages</option>
                    </select>
                  </div>
                  {splitMode === "ranges" && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Page Ranges</label>
                      <input
                        type="text"
                        value={ranges}
                        onChange={(e) => setRanges(e.target.value)}
                        placeholder="1-2, 5, 8-10"
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                      />
                    </div>
                  )}
                  {splitMode === "every_n" && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Every N Pages</label>
                      <input
                        type="number"
                        min="1"
                        value={everyN}
                        onChange={(e) => setEveryN(Number(e.target.value))}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Remove Pages */}
              {tool.id === "remove-pages" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pages to Remove (comma separated)</label>
                  <input
                    type="text"
                    value={pagesToRemove}
                    onChange={(e) => setPagesToRemove(e.target.value)}
                    placeholder="e.g. 1, 3, 5"
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>
              )}

              {/* Extract Pages */}
              {tool.id === "extract-pages" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Page Range to Extract</label>
                  <input
                    type="text"
                    value={ranges}
                    onChange={(e) => setRanges(e.target.value)}
                    placeholder="e.g. 2, 5, 8-12"
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>
              )}

              {/* Compress PDF */}
              {tool.id === "compress-pdf" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Compression Level</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: "low", label: "Low", desc: "Highest quality" },
                      { id: "medium", label: "Medium", desc: "Balanced" },
                      { id: "high", label: "High", desc: "Smallest size" },
                    ].map((lvl) => (
                      <button
                        type="button"
                        key={lvl.id}
                        onClick={() => setCompressLevel(lvl.id)}
                        className={`p-3 rounded-xl border text-center transition ${
                          compressLevel === lvl.id
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <div className="text-xs font-bold uppercase">{lvl.label}</div>
                        <div className={`text-[10px] mt-0.5 ${compressLevel === lvl.id ? "text-indigo-200" : "text-slate-400"}`}>
                          {lvl.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Rotate PDF */}
              {tool.id === "rotate-pdf" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Rotation Angle</label>
                  <div className="grid grid-cols-3 gap-3">
                    {["90", "180", "270"].map((ang) => (
                      <button
                        type="button"
                        key={ang}
                        onClick={() => setRotateAngle(ang)}
                        className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          rotateAngle === ang
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        {ang}° Clockwise
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Protect / Unlock */}
              {(tool.id === "unlock-pdf" || tool.id === "protect-pdf") && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-indigo-600" />
                    {tool.id === "unlock-pdf" ? "Enter PDF Password" : "Create PDF Password"}
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>
              )}

              {/* Watermark */}
              {tool.id === "add-watermark" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Watermark Text</label>
                  <input
                    type="text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>
              )}

              {/* OCR & Indian Languages */}
              {(tool.id === "ocr-pdf" || tool.id === "indian-language-documents" || tool.id === "image-to-text") && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-indigo-600" />
                    Document Language
                  </label>
                  <select
                    value={ocrLanguage}
                    onChange={(e) => setOcrLanguage(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    {languages.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* 7. Error Banner */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-xs font-bold hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* 8. Process Button & Real Loading State */}
          <button
            type="submit"
            disabled={loading || files.length === 0}
            className={`w-full py-4 text-white font-bold rounded-2xl text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg transition-all duration-300 ${
              loading || files.length === 0
                ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
                : "bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 hover:from-indigo-500 hover:via-violet-500 hover:to-indigo-600 shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5"
            }`}
          >
            {loading ? (
              <div className="flex items-center gap-2.5">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Processing {tool.name}...</span>
              </div>
            ) : (
              <>
                <span>Process {tool.name}</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* 9. Processing State Visual Indicator */}
        {loading && (
          <div className="mt-6 p-6 bg-indigo-50/70 border border-indigo-100 rounded-2xl text-center space-y-3 animate-in">
            <p className="text-xs font-extrabold text-indigo-700 uppercase tracking-widest">
              DOCFLOW CLOUD ENGINE ACTIVE
            </p>
            <div className="flex items-center justify-center gap-4 text-xs font-semibold text-slate-600">
              <span className="flex items-center gap-1 text-emerald-600 font-bold">
                <Check className="w-3.5 h-3.5" /> File Uploaded
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-indigo-600 font-bold animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Converting Document
              </span>
              <span>•</span>
              <span className="text-slate-400">Ready to Download</span>
            </div>
          </div>
        )}

        {/* 10. Success State Screen */}
        {result && (
          <div className="mt-8 p-6 sm:p-8 bg-emerald-50/90 border border-emerald-200 rounded-3xl space-y-5 animate-in">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-md shadow-emerald-500/10 shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base sm:text-lg font-bold text-slate-900">Conversion Successful!</h4>
                <p className="text-xs text-slate-600">Your processed file is ready for secure instant download.</p>
              </div>
            </div>

            {/* Reduction indicator for compress */}
            {result.reduction_percentage !== undefined && (
              <div className="p-3.5 bg-white rounded-2xl border border-emerald-200/80 text-xs font-semibold text-slate-700 flex justify-around">
                <div>Original: {(result.original_size / 1024).toFixed(1)} KB</div>
                <div>Compressed: {(result.compressed_size / 1024).toFixed(1)} KB</div>
                <div className="text-emerald-700 font-extrabold">Reduction: -{result.reduction_percentage}%</div>
              </div>
            )}

            {/* OCR Extracted Text Preview */}
            {result.extracted_text && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Extracted Text</span>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 max-h-48 overflow-y-auto font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {result.extracted_text}
                </div>
              </div>
            )}

            {/* Download and Reset Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              {result.download_key && (
                <a
                  href={getDownloadUrl(result.download_key)}
                  download={result.filename}
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 transition-all hover:-translate-y-0.5"
                >
                  <Download className="w-5 h-5" />
                  Download {result.filename || "Output File"}
                </a>
              )}
              <button
                type="button"
                onClick={resetAll}
                className="w-full sm:w-auto px-6 py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold rounded-2xl text-sm transition"
              >
                Process Another File
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 11. Subtle Trust Strip */}
      <div className="mt-8 pt-6 border-t border-slate-200/60 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 font-medium">
          <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>256-bit SSL Encrypted</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 font-medium">
          <Zap className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>High-Speed Engine</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 font-medium">
          <Trash2 className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>Auto-Purge in 30 Min</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 font-medium">
          <Smartphone className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>Cross-Device Ready</span>
        </div>
      </div>
    </div>
  );
}
