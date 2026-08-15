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
  Crown,
  PlusCircle,
  Plus,
  FileCheck2
} from "lucide-react";

interface ToolWorkspaceProps {
  tool: ToolItem;
}

export default function ToolWorkspace({ tool }: ToolWorkspaceProps) {
  const { user, profile, openAuthModal, refreshProfile } = useAuth();

  const [files, setFiles] = useState<File[]>([]);
  const [proModalFile, setProModalFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
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

  const isPro = profile?.plan === "PRO" || profile?.plan === "PRO_MONTHLY" || profile?.plan === "PRO_YEARLY";

  const handleFilesSelect = (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return;

    // Instant popup if any file exceeds 25 MB on free plan
    if (!isPro) {
      const oversized = selectedFiles.find((f) => f.size > 25 * 1024 * 1024);
      if (oversized) {
        setProModalFile(oversized);
        const valid = selectedFiles.filter((f) => f.size <= 25 * 1024 * 1024);
        if (valid.length > 0) {
          setFiles((prev) => [...prev, ...valid]);
        }
        return;
      }
    }

    setFiles((prev) => [...prev, ...selectedFiles]);
    setError(null);
    setResult(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFilesSelect(Array.from(e.target.files));
      // Reset input value so same files can be re-added if desired
      e.target.value = "";
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

  const openFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleDownloadFile = async () => {
    if (!result?.download_key) return;
    setDownloading(true);
    try {
      const url = getDownloadUrl(result.download_key);
      const res = await fetch(url);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = result.filename || "converted_document";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);

      // Instant refresh to immediately increment the usage quota in the UI
      if (refreshProfile) {
        await refreshProfile();
      }
    } catch (err) {
      window.open(getDownloadUrl(result.download_key), "_blank");
      if (refreshProfile) {
        setTimeout(refreshProfile, 1000);
      }
    } finally {
      setDownloading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasOversized) {
      setError("One or more selected files exceed the 25 MB Free limit. Please upgrade to Pro for files up to 500 MB.");
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

  const usedCount = profile?.period_usage ?? 0;
  const maxQuota = profile?.max_quota ?? 10;
  const isLimitReached = !isPro && usedCount >= maxQuota;
  const oversizedFiles = !isPro ? files.filter((f) => f.size > 25 * 1024 * 1024) : [];
  const hasOversized = oversizedFiles.length > 0;
  const removeOversizedFiles = () => setFiles((prev) => prev.filter((f) => f.size <= 25 * 1024 * 1024));

  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-10 px-4 sm:px-6">
      {/* Hidden File Input for Triggering Browsers */}
      <input
        ref={fileInputRef}
        type="file"
        accept={tool.accept}
        multiple={true}
        onChange={handleFileChange}
        className="hidden"
      />

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
                : `${usedCount} / ${maxQuota} free conversions used today • 25 MB max file size (Resets daily)`}
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
            <span>You&apos;ve reached your free daily conversion limit ({maxQuota} conversions today). Upgrade to DocFlow Pro for unlimited access or wait for tomorrow&apos;s reset.</span>
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
          {/* Upload Area (Shown when no files are chosen) */}
          {files.length === 0 ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={openFilePicker}
              className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer group ${
                isDragging
                  ? "border-indigo-600 bg-indigo-50/60 shadow-lg shadow-indigo-500/10"
                  : "border-slate-200 hover:border-indigo-500/80 bg-slate-50/40 hover:bg-indigo-50/20"
              }`}
            >
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
            /* File Selected State: File Queue Card with Add More Files Action */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                  Selected Files ({files.length})
                </h4>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={openFilePicker}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add More Files
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={resetAll}
                    className="text-xs font-bold text-slate-400 hover:text-red-600 flex items-center gap-1 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear All
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {files.map((f, i) => {
                  const isFileOversized = !isPro && f.size > 25 * 1024 * 1024;
                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition ${
                        isFileOversized
                          ? "bg-amber-50/60 border-amber-300"
                          : "bg-slate-50/80 hover:bg-slate-50 border-slate-200/80"
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span
                          className={`w-7 h-7 rounded-lg font-mono text-xs font-bold flex items-center justify-center shrink-0 ${
                            isFileOversized
                              ? "bg-amber-200 text-amber-900"
                              : "bg-indigo-100 text-indigo-700"
                          }`}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="overflow-hidden">
                          <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {f.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                            <span className={isFileOversized ? "text-amber-800 font-bold" : ""}>
                              {formatFileSize(f.size)}
                            </span>
                            <span>•</span>
                            {isFileOversized ? (
                              <span className="text-amber-700 font-extrabold flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Exceeds 25 MB Free limit
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                                <Check className="w-3 h-3" /> Ready to process
                              </span>
                            )}
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
                  );
                })}
              </div>

              {/* Prominent Add More Files Banner */}
              <button
                type="button"
                onClick={openFilePicker}
                className="w-full py-3.5 border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/30 hover:bg-indigo-50/60 rounded-2xl text-xs sm:text-sm font-bold text-indigo-700 hover:text-indigo-800 transition flex items-center justify-center gap-2 shadow-xs group"
              >
                <PlusCircle className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
                <span>Add More Files</span>
              </button>
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

          {/* Large File Detected (> 25 MB) Pro Upgrade Card */}
          {hasOversized && (
            <div className="p-5 bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-violet-500/10 border border-amber-300 rounded-3xl space-y-3 animate-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-950 font-extrabold text-sm">
                  <Crown className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>Large File Detected ({formatFileSize(oversizedFiles[0]?.size)})</span>
                </div>
                <span className="bg-amber-100 text-amber-900 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full uppercase border border-amber-200">
                  PRO FEATURE
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Free accounts can process files up to <strong>25 MB</strong>. Upgrade to <strong>DocFlow Pro</strong> to process large files up to <strong>500 MB</strong> with priority cloud conversion speed.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                <Link
                  href="/pricing"
                  className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/25 transition"
                >
                  <Crown className="w-3.5 h-3.5" />
                  <span>Upgrade to Pro — ₹99/mo</span>
                </Link>
                <button
                  type="button"
                  onClick={removeOversizedFiles}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 hover:underline"
                >
                  Remove large file
                </button>
              </div>
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

          {/* 8. Process Button & Real Loading State / Upgrade Action */}
          {hasOversized ? (
            <Link
              href="/pricing"
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold rounded-2xl text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all hover:-translate-y-0.5"
            >
              <Crown className="w-5 h-5" />
              <span>Upgrade to Pro to Process Files Over 25 MB</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          ) : (
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
          )}
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

            {/* Ready Output File Card */}
            <div className="p-4 bg-white rounded-2xl border border-emerald-200/80 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs sm:text-sm font-bold text-slate-900 truncate" title={result.filename}>
                    {result.filename || "Converted Document"}
                  </p>
                  <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Ready to download
                  </p>
                </div>
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

            {/* Balanced Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {result.download_key && (
                <button
                  type="button"
                  onClick={handleDownloadFile}
                  disabled={downloading}
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 transition-all hover:-translate-y-0.5 disabled:opacity-80"
                >
                  {downloading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Downloading File...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      <span>Download File</span>
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={resetAll}
                className="w-full py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold rounded-2xl text-sm transition flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4 text-slate-400" />
                <span>Convert Another File</span>
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

      {/* 12. Instant Pro Upgrade Modal when a file > 25 MB is dropped or selected */}
      {proModalFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 sm:p-8 space-y-6 relative overflow-hidden animate-in zoom-in-95">
            {/* Close button */}
            <button
              type="button"
              onClick={() => setProModalFile(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header with Crown Icon */}
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20">
                <Crown className="w-8 h-8" />
              </div>
              <span className="inline-block bg-amber-100 text-amber-900 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                25 MB LIMIT REACHED
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                Upgrade to DocFlow Pro
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                The file <strong className="text-slate-900 break-all">{proModalFile.name}</strong> is <strong>{formatFileSize(proModalFile.size)}</strong>, which exceeds the <strong>25 MB Free plan limit</strong>.
              </p>
            </div>

            {/* Plan Comparison Card */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-slate-500">
                <span>Free Plan Limit:</span>
                <span className="font-bold text-slate-700">25 MB per file</span>
              </div>
              <div className="flex items-center justify-between font-bold text-indigo-950">
                <span className="flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-amber-500" />
                  DocFlow Pro:
                </span>
                <span className="text-emerald-600 font-extrabold text-sm">Up to 500 MB</span>
              </div>
              <div className="text-[11px] text-slate-500 space-y-1 pt-1 border-t border-slate-200/60">
                <div className="flex items-center gap-1.5 text-slate-700">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Unlimited conversions with zero wait time</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Priority high-speed cloud processing</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-1">
              <Link
                href="/pricing"
                className="w-full py-4 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-700 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all hover:-translate-y-0.5"
              >
                <Crown className="w-4 h-4" />
                <span>Upgrade to Pro — ₹99/month</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                type="button"
                onClick={() => setProModalFile(null)}
                className="w-full py-3 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 font-bold rounded-2xl text-xs transition"
              >
                Choose a smaller file (&lt; 25 MB)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
