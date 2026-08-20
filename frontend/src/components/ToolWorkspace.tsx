"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ToolItem } from "../lib/toolsData";
import { useAuth } from "../context/AuthContext";
import { processToolApi, getDownloadUrl, fetchPdfThumbnails } from "../lib/api";
import {
  clientMergePdf,
  clientSplitPdf,
  clientRemovePages,
  clientExtractPages,
  clientRotatePdf,
  clientAddPageNumbers,
  clientAddWatermark,
  clientCropPdf,
  clientImageToPdf,
  clientResizeImage,
  clientCropImage,
  clientConvertImage,
  clientOrganizePdf,
  getPdfPageCount,
  PageOrderConfig
} from "../lib/clientProcessors";
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
  RotateCcw,
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
  FileCheck2,
  Copy,
  Undo2,
  ArrowLeft,
  LayoutGrid,
  Maximize2,
  CheckSquare,
  Square,
  GripVertical,
  ZoomIn,
  Eye
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

  // Organize PDF State
  const [organizePages, setOrganizePages] = useState<PageOrderConfig[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [zoomPage, setZoomPage] = useState<PageOrderConfig | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [thumbnailSize, setThumbnailSize] = useState<"sm" | "md" | "lg">("md");

  useEffect(() => {
    if (tool.id === "organize-pdf" && files.length > 0) {
      let isMounted = true;
      setLoadingPages(true);

      const loadAllFilesPages = async () => {
        const allPages: PageOrderConfig[] = [];

        for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
          const currentFile = files[fileIdx];
          try {
            // Try fetching high-res server thumbnails
            const res = await fetchPdfThumbnails(currentFile);
            if (res.success && Array.isArray(res.thumbnails)) {
              res.thumbnails.forEach((t: any) => {
                allPages.push({
                  id: `p-${fileIdx}-${t.page_num}-${Math.random().toString(36).substring(2, 7)}`,
                  original_page: t.page_num,
                  rotation: 0,
                  delete: false,
                  thumbnail: t.thumbnail,
                  sourceFileIndex: fileIdx,
                  sourceFileName: currentFile.name,
                });
              });
              continue;
            }
          } catch (e) {
            console.warn("Thumbnail fetch failed, falling back to page count:", e);
          }

          // Fallback to client-side page count
          try {
            const count = await getPdfPageCount(currentFile);
            for (let i = 1; i <= count; i++) {
              allPages.push({
                id: `p-${fileIdx}-${i}-${Math.random().toString(36).substring(2, 7)}`,
                original_page: i,
                rotation: 0,
                delete: false,
                sourceFileIndex: fileIdx,
                sourceFileName: currentFile.name,
              });
            }
          } catch (cntErr) {
            console.error("Failed to count pages:", cntErr);
          }
        }

        if (isMounted) {
          setOrganizePages(allPages);
          setSelectedPageIds([]);
          setLoadingPages(false);
        }
      };

      loadAllFilesPages();

      return () => {
        isMounted = false;
      };
    } else {
      setOrganizePages([]);
      setSelectedPageIds([]);
      setZoomPage(null);
    }
  }, [files, tool.id]);

  const handleRotatePage = (id: string, delta: number) => {
    setOrganizePages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, rotation: (p.rotation + delta + 360) % 360 } : p))
    );
  };

  const handleDeleteTogglePage = (id: string) => {
    setOrganizePages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, delete: !p.delete } : p))
    );
  };

  const handleDuplicatePage = (id: string) => {
    setOrganizePages((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx === -1) return prev;
      const target = prev[idx];
      const clone: PageOrderConfig = {
        ...target,
        id: `p-${target.original_page}-dup-${Math.random().toString(36).substring(2, 7)}`,
        delete: false,
      };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
  };

  const handleMovePage = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= organizePages.length) return;
    setOrganizePages((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIdx];
      next[targetIdx] = temp;
      return next;
    });
  };

  const handleDropCard = (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    setOrganizePages((prev) => {
      const next = [...prev];
      const [draggedItem] = next.splice(draggedIndex, 1);
      next.splice(targetIndex, 0, draggedItem);
      return next;
    });
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleToggleSelectPage = (id: string) => {
    setSelectedPageIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const activePages = organizePages.filter((p) => !p.delete);
    if (selectedPageIds.length === activePages.length) {
      setSelectedPageIds([]);
    } else {
      setSelectedPageIds(activePages.map((p) => p.id));
    }
  };

  const handleBatchRotate = (delta: number) => {
    if (selectedPageIds.length === 0) return;
    setOrganizePages((prev) =>
      prev.map((p) =>
        selectedPageIds.includes(p.id) ? { ...p, rotation: (p.rotation + delta + 360) % 360 } : p
      )
    );
  };

  const handleBatchDelete = (shouldDelete: boolean) => {
    if (selectedPageIds.length === 0) return;
    setOrganizePages((prev) =>
      prev.map((p) => (selectedPageIds.includes(p.id) ? { ...p, delete: shouldDelete } : p))
    );
    if (shouldDelete) {
      setSelectedPageIds([]);
    }
  };

  const handleRotateAll = (delta: number) => {
    setOrganizePages((prev) =>
      prev.map((p) => ({ ...p, rotation: (p.rotation + delta + 360) % 360 }))
    );
  };

  const handleResetOrganize = () => {
    if (files.length === 0) return;
    setLoadingPages(true);
    fetchPdfThumbnails(files[0])
      .then((res) => {
        if (res.success && Array.isArray(res.thumbnails)) {
          const initial: PageOrderConfig[] = res.thumbnails.map((t: any) => ({
            id: `p-0-${t.page_num}-${Math.random().toString(36).substring(2, 7)}`,
            original_page: t.page_num,
            rotation: 0,
            delete: false,
            thumbnail: t.thumbnail,
            sourceFileIndex: 0,
            sourceFileName: files[0].name,
          }));
          setOrganizePages(initial);
          setSelectedPageIds([]);
        }
      })
      .finally(() => setLoadingPages(false));
  };

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
    if (!result) return;
    setDownloading(true);

    try {
      // 1. Direct Client-Side Processed Blob Download
      if (result.blobUrl) {
        const link = document.createElement("a");
        link.href = result.blobUrl;
        link.download = result.filename || "converted_document";
        document.body.appendChild(link);
        link.click();
        link.remove();
        if (refreshProfile) await refreshProfile();
        return;
      }

      // 2. Server-side generated download key
      if (result.download_key) {
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

        if (refreshProfile) {
          await refreshProfile();
        }
      }
    } catch (err) {
      if (result.download_key) {
        window.open(getDownloadUrl(result.download_key), "_blank");
        if (refreshProfile) setTimeout(refreshProfile, 1000);
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

    // =========================================================================
    // PURE CLIENT-SIDE INSTANT BROWSER PROCESSING (100% Real-Time in Browser)
    // =========================================================================
    try {
      let clientRes: any = null;

      if (tool.id === "merge-pdf" && files.length > 0) {
        clientRes = await clientMergePdf(files);
      } else if (tool.id === "remove-pages" && files[0]) {
        clientRes = await clientRemovePages(files[0], pagesToRemove);
      } else if (tool.id === "extract-pages" && files[0]) {
        clientRes = await clientExtractPages(files[0], ranges);
      } else if (tool.id === "rotate-pdf" && files[0]) {
        clientRes = await clientRotatePdf(files[0], Number(rotateAngle) || 90);
      } else if (tool.id === "add-page-numbers" && files[0]) {
        clientRes = await clientAddPageNumbers(files[0], "bottom-center");
      } else if (tool.id === "add-watermark" && files[0]) {
        clientRes = await clientAddWatermark(files[0], watermarkText || "CONFIDENTIAL");
      } else if (tool.id === "crop-pdf" && files[0]) {
        clientRes = await clientCropPdf(files[0], { x: cropX, y: cropY, w: cropW, h: cropH });
      } else if (tool.id === "jpg-to-pdf" && files.length > 0) {
        clientRes = await clientImageToPdf(files);
      } else if (tool.id === "resize-image" && files[0]) {
        clientRes = await clientResizeImage(files[0], { percentage: 50 });
      } else if (tool.id === "crop-image" && files[0]) {
        clientRes = await clientCropImage(files[0], { x: cropX, y: cropY, w: cropW, h: cropH });
      } else if (tool.id === "convert-image" && files[0]) {
        clientRes = await clientConvertImage(files[0], "webp");
      } else if (tool.id === "organize-pdf" && files.length > 0 && organizePages.length > 0) {
        clientRes = await clientOrganizePdf(files, organizePages);
      }

      if (clientRes) {
        const blobUrl = URL.createObjectURL(clientRes.blob);
        setResult({
          success: true,
          blobUrl,
          filename: clientRes.filename,
          size: clientRes.size,
          clientSide: true
        });
        setLoading(false);
        return;
      }
    } catch (clientErr) {
      console.warn("Client-side processor encountered an issue, falling back to server engine:", clientErr);
    }

    // =========================================================================
    // SERVER-SIDE PROCESSING ENGINE FALLBACK
    // =========================================================================
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
    } else if (tool.id === "organize-pdf") {
      formData.append("page_orders_json", JSON.stringify(organizePages));
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
              {tool.id !== "organize-pdf" && (
                <button
                  type="button"
                  onClick={openFilePicker}
                  className="w-full py-3.5 border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/30 hover:bg-indigo-50/60 rounded-2xl text-xs sm:text-sm font-bold text-indigo-700 hover:text-indigo-800 transition flex items-center justify-center gap-2 shadow-xs group"
                >
                  <PlusCircle className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
                  <span>Add More Files</span>
                </button>
              )}
            </div>
          )}

          {/* 6. Organize PDF Visual Interactive Page Manager Canvas */}
          {files.length > 0 && tool.id === "organize-pdf" && (
            <div className="p-5 sm:p-6 bg-slate-50/95 rounded-3xl border border-slate-200/90 space-y-5 shadow-xs">
              {/* Header & Controls */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="w-5 h-5 text-indigo-600" />
                    <h4 className="text-sm sm:text-base font-extrabold text-slate-900">
                      Visual Page Organizer Canvas
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {loadingPages
                      ? "Rendering high-resolution document pages..."
                      : `Drag pages to reorder • ${organizePages.filter((p) => !p.delete).length} of ${organizePages.length} pages will be exported`}
                  </p>
                </div>

                {/* Global Quick Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    {selectedPageIds.length > 0 && selectedPageIds.length === organizePages.filter(p => !p.delete).length ? (
                      <>
                        <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Deselect All</span>
                      </>
                    ) : (
                      <>
                        <Square className="w-3.5 h-3.5 text-slate-400" />
                        <span>Select All</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRotateAll(90)}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Rotate All 90°</span>
                  </button>

                  <button
                    type="button"
                    onClick={openFilePicker}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-700 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Insert Another PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetOrganize}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              {/* Batch Actions Toolbar (Visible when pages are selected) */}
              {selectedPageIds.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-indigo-600 text-white rounded-2xl shadow-md animate-in fade-in">
                  <div className="flex items-center gap-2 text-xs font-bold pl-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>{selectedPageIds.length} pages selected</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleBatchRotate(90)}
                      className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Rotate 90°</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleBatchRotate(180)}
                      className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Rotate 180°</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleBatchDelete(true)}
                      className="px-2.5 py-1 bg-rose-500/80 hover:bg-rose-600 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Exclude Selected</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedPageIds([])}
                      className="p-1 hover:bg-white/20 rounded-lg transition"
                      title="Clear Selection"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {loadingPages ? (
                <div className="py-16 text-center space-y-3">
                  <RefreshCw className="w-7 h-7 animate-spin text-indigo-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">Rendering visual PDF page thumbnails...</p>
                  <p className="text-[11px] text-slate-400">Processing page graphics and high-resolution previews</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {organizePages.map((page, idx) => {
                    const isDeleted = Boolean(page.delete);
                    const isSelected = selectedPageIds.includes(page.id);
                    const isBeingDragged = draggedIndex === idx;
                    const isDragTarget = dragOverIndex === idx;

                    return (
                      <div
                        key={page.id}
                        draggable={!isDeleted}
                        onDragStart={() => setDraggedIndex(idx)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverIndex(idx);
                        }}
                        onDragLeave={() => setDragOverIndex(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleDropCard(idx);
                        }}
                        className={`relative bg-white rounded-2xl border transition-all duration-200 flex flex-col items-center justify-between p-3 group shadow-xs select-none ${
                          isBeingDragged
                            ? "opacity-40 scale-95 border-indigo-400 border-dashed"
                            : isDragTarget
                            ? "border-indigo-600 ring-2 ring-indigo-500/30 scale-105 shadow-lg shadow-indigo-500/15"
                            : isSelected
                            ? "border-indigo-600 ring-2 ring-indigo-600/20 bg-indigo-50/10"
                            : isDeleted
                            ? "border-rose-300 bg-rose-50/40 opacity-60"
                            : "border-slate-200 hover:border-indigo-400 hover:shadow-md hover:shadow-indigo-500/10"
                        }`}
                      >
                        {/* Top Card Bar: Checkbox, Position Badge, Zoom */}
                        <div className="w-full flex items-center justify-between text-[11px] font-bold mb-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleSelectPage(page.id)}
                              disabled={isDeleted}
                              className="text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-indigo-600" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-300 group-hover:text-slate-400" />
                              )}
                            </button>
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px]">
                              #{idx + 1}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {page.rotation > 0 && !isDeleted && (
                              <span className="bg-indigo-50 text-indigo-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded">
                                ↻ {page.rotation}°
                              </span>
                            )}
                            {isDeleted && (
                              <span className="bg-rose-100 text-rose-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded">
                                Excluded
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setZoomPage(page)}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition cursor-pointer"
                              title="Zoom & Inspect Page"
                            >
                              <ZoomIn className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Visual PDF Page Preview Card */}
                        <div
                          className="w-full aspect-[3/4] bg-white border border-slate-200 rounded-xl flex items-center justify-center p-1.5 shadow-inner transition-transform duration-300 relative overflow-hidden cursor-grab active:cursor-grabbing"
                          style={{ transform: `rotate(${page.rotation}deg)` }}
                        >
                          {page.thumbnail ? (
                            <img
                              src={page.thumbnail}
                              alt={`Page ${page.original_page}`}
                              className="w-full h-full object-contain pointer-events-none rounded-lg"
                            />
                          ) : (
                            /* Fallback Simulated Lines */
                            <div className="w-full h-full flex flex-col justify-between p-2">
                              <div className="space-y-1.5 opacity-40">
                                <div className="h-1.5 bg-indigo-400 rounded-full w-2/3" />
                                <div className="h-1 bg-slate-300 rounded-full w-full" />
                                <div className="h-1 bg-slate-300 rounded-full w-5/6" />
                              </div>
                              <div className="text-center font-extrabold text-slate-500 text-xs">
                                Page {page.original_page}
                              </div>
                              <div className="space-y-1.5 opacity-30">
                                <div className="h-1 bg-slate-300 rounded-full w-full" />
                              </div>
                            </div>
                          )}

                          {/* Deleted Watermark Overlay */}
                          {isDeleted && (
                            <div className="absolute inset-0 bg-rose-500/20 backdrop-blur-[1px] flex items-center justify-center">
                              <span className="text-xs font-extrabold text-rose-700 bg-white/95 px-2.5 py-1 rounded-lg shadow-sm border border-rose-200">
                                Excluded
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Multi-Document Origin Tag if multiple files */}
                        {files.length > 1 && (
                          <div className="w-full text-center text-[9px] text-slate-400 truncate mt-1">
                            {page.sourceFileName || `Doc ${page.sourceFileIndex || 1}`}
                          </div>
                        )}

                        {/* Bottom Quick Action Toolbar */}
                        <div className="w-full pt-2 mt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                          {/* Rotate CCW */}
                          <button
                            type="button"
                            onClick={() => handleRotatePage(page.id, -90)}
                            disabled={isDeleted}
                            className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 transition cursor-pointer"
                            title="Rotate 90° Left"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>

                          {/* Rotate CW */}
                          <button
                            type="button"
                            onClick={() => handleRotatePage(page.id, 90)}
                            disabled={isDeleted}
                            className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 transition cursor-pointer"
                            title="Rotate 90° Right"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>

                          {/* Duplicate */}
                          <button
                            type="button"
                            onClick={() => handleDuplicatePage(page.id)}
                            disabled={isDeleted}
                            className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 transition cursor-pointer"
                            title="Duplicate Page"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {/* Move Left */}
                          <button
                            type="button"
                            onClick={() => handleMovePage(idx, -1)}
                            disabled={idx === 0 || isDeleted}
                            className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-20 transition cursor-pointer"
                            title="Move Page Earlier"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </button>

                          {/* Move Right */}
                          <button
                            type="button"
                            onClick={() => handleMovePage(idx, 1)}
                            disabled={idx === organizePages.length - 1 || isDeleted}
                            className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-20 transition cursor-pointer"
                            title="Move Page Later"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete / Restore Toggle */}
                          <button
                            type="button"
                            onClick={() => handleDeleteTogglePage(page.id)}
                            className={`p-1 rounded-lg transition cursor-pointer ${
                              isDeleted
                                ? "text-emerald-600 hover:bg-emerald-50"
                                : "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            }`}
                            title={isDeleted ? "Restore Page" : "Exclude Page"}
                          >
                            {isDeleted ? <Undo2 className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Full-Screen Page Zoom & Inspect Modal */}
          {zoomPage && (
            <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl relative border border-slate-100">
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Eye className="w-5 h-5 text-indigo-600" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Page {zoomPage.original_page} Inspection
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {zoomPage.sourceFileName || "Document Page"} • Rotation: {zoomPage.rotation}°
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setZoomPage(null)}
                    className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* High-Resolution Enlarged Preview */}
                <div className="w-full aspect-[3/4] max-h-[55vh] bg-slate-100 rounded-2xl flex items-center justify-center p-3 overflow-hidden border border-slate-200">
                  {zoomPage.thumbnail ? (
                    <img
                      src={zoomPage.thumbnail}
                      alt={`Page ${zoomPage.original_page}`}
                      className="max-h-full max-w-full object-contain rounded-lg shadow transition-transform duration-300"
                      style={{ transform: `rotate(${zoomPage.rotation}deg)` }}
                    />
                  ) : (
                    <div className="text-slate-400 font-bold text-sm">
                      Page {zoomPage.original_page} (Preview not available)
                    </div>
                  )}
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-between gap-2 pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRotatePage(zoomPage.id, -90)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1 transition cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Rotate Left</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRotatePage(zoomPage.id, 90)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1 transition cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Rotate Right</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteTogglePage(zoomPage.id);
                        setZoomPage(null);
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                        zoomPage.delete
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                      }`}
                    >
                      {zoomPage.delete ? <Undo2 className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                      <span>{zoomPage.delete ? "Restore Page" : "Exclude Page"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setZoomPage(null)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 6. Tool-Specific Options */}
          {files.length > 0 && [
            "split-pdf", "remove-pages", "extract-pages", "compress-pdf",
            "rotate-pdf", "unlock-pdf", "protect-pdf", "add-watermark",
            "ocr-pdf", "indian-language-documents", "image-to-text", "crop-pdf",
            "translate-pdf", "ai-pdf-summarizer", "resize-image", "crop-image",
            "convert-image", "add-page-numbers", "redact-pdf"
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

              {/* Add Page Numbers */}
              {tool.id === "add-page-numbers" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Page Number Position</label>
                  <select
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                    defaultValue="bottom-center"
                  >
                    <option value="bottom-center">Bottom Center (Recommended)</option>
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="top-right">Top Right</option>
                  </select>
                </div>
              )}

              {/* Redact PDF */}
              {tool.id === "redact-pdf" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Text to Permanently Redact</label>
                  <input
                    type="text"
                    placeholder="Enter sensitive word or phrase (e.g. Confidential, SSN, Account Number)"
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                    defaultValue="CONFIDENTIAL"
                  />
                </div>
              )}

              {/* Translate PDF */}
              {tool.id === "translate-pdf" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-indigo-600" />
                    Target Language
                  </label>
                  <select
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                    defaultValue="Spanish"
                  >
                    <option value="Spanish">Spanish (Español)</option>
                    <option value="French">French (Français)</option>
                    <option value="German">German (Deutsch)</option>
                    <option value="Hindi">Hindi (हिन्दी)</option>
                    <option value="Tamil">Tamil (தமிழ்)</option>
                    <option value="Telugu">Telugu (తెలుగు)</option>
                    <option value="Italian">Italian (Italiano)</option>
                    <option value="Portuguese">Portuguese (Português)</option>
                    <option value="Russian">Russian (Русский)</option>
                    <option value="Chinese">Chinese (中文)</option>
                    <option value="Japanese">Japanese (日本語)</option>
                    <option value="Arabic">Arabic (العربية)</option>
                  </select>
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

              {/* Convert Image Format */}
              {tool.id === "convert-image" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Target Format</label>
                  <select
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                    defaultValue="png"
                  >
                    <option value="png">PNG (Lossless with Alpha)</option>
                    <option value="jpg">JPG / JPEG (Compact Web Image)</option>
                    <option value="webp">WEBP (Next-Gen High Compression)</option>
                    <option value="bmp">BMP (Bitmap)</option>
                    <option value="tiff">TIFF (High Resolution)</option>
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
                  <span>{tool.id === "organize-pdf" ? "Save & Download Organized PDF" : `Process ${tool.name}`}</span>
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
              {(result.download_key || result.blobUrl) && (
                <button
                  type="button"
                  onClick={handleDownloadFile}
                  disabled={downloading}
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 transition-all hover:-translate-y-0.5 disabled:opacity-80 cursor-pointer"
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
                className="w-full py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold rounded-2xl text-sm transition flex items-center justify-center gap-2 cursor-pointer"
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
