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
  Redo2,
  ArrowLeft,
  LayoutGrid,
  Maximize2,
  CheckSquare,
  Square,
  GripVertical,
  ZoomIn,
  ZoomOut,
  Crop,
  Move,
  Circle,
  PenTool,
  Eye,
  History,
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
  const [targetSizeValue, setTargetSizeValue] = useState("200");
  const [targetSizeUnit, setTargetSizeUnit] = useState<"KB" | "MB">("KB");
  const [customQualityPercent, setCustomQualityPercent] = useState(60);
  const [rotateAngle, setRotateAngle] = useState("90");
  const [password, setPassword] = useState("");
  const [watermarkText, setWatermarkText] = useState("CONFIDENTIAL");
  const [watermarkPosition, setWatermarkPosition] = useState<"cross" | "center">("cross");
  const [pageNumberPosition, setPageNumberPosition] = useState("bottom-center");
  const [ocrLanguage, setOcrLanguage] = useState("English");

  // Organize PDF Full Production State
  const [organizePages, setOrganizePages] = useState<PageOrderConfig[]>([]);
  const [initialSnapshot, setInitialSnapshot] = useState<PageOrderConfig[]>([]);
  const [history, setHistory] = useState<PageOrderConfig[][]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const [loadingPages, setLoadingPages] = useState(false);
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [zoomPage, setZoomPage] = useState<PageOrderConfig | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [showResetModal, setShowResetModal] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Helper to commit new page state to undo/redo history
  const commitState = (newPages: PageOrderConfig[]) => {
    setOrganizePages(newPages);
    setHistory((prev) => {
      const upToCurrent = prev.slice(0, historyIdx + 1);
      return [...upToCurrent, newPages];
    });
    setHistoryIdx((prev) => prev + 1);
  };

  const canUndo = historyIdx > 0;
  const canRedo = historyIdx < history.length - 1;

  const handleUndo = () => {
    if (!canUndo) return;
    const targetIdx = historyIdx - 1;
    const targetState = history[targetIdx];
    if (targetState) {
      setOrganizePages(targetState);
      setHistoryIdx(targetIdx);
      if (zoomPage) {
        const updatedZoom = targetState.find((p) => p.id === zoomPage.id) || null;
        setZoomPage(updatedZoom);
      }
    }
  };

  const handleRedo = () => {
    if (!canRedo) return;
    const targetIdx = historyIdx + 1;
    const targetState = history[targetIdx];
    if (targetState) {
      setOrganizePages(targetState);
      setHistoryIdx(targetIdx);
      if (zoomPage) {
        const updatedZoom = targetState.find((p) => p.id === zoomPage.id) || null;
        setZoomPage(updatedZoom);
      }
    }
  };

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
            if (res.success && Array.isArray(res.thumbnails) && res.thumbnails.length > 0) {
              res.thumbnails.forEach((t: any) => {
                allPages.push({
                  id: `p-${fileIdx}-${t.page_num}-${Math.random().toString(36).substring(2, 7)}`,
                  sourceDocumentId: fileIdx,
                  sourceFileName: currentFile.name,
                  originalPageNumber: t.page_num,
                  original_page: t.page_num,
                  sourceFileIndex: fileIdx,
                  rotation: 0,
                  excluded: false,
                  delete: false,
                  thumbnail: t.thumbnail,
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
                sourceDocumentId: fileIdx,
                sourceFileName: currentFile.name,
                originalPageNumber: i,
                original_page: i,
                sourceFileIndex: fileIdx,
                rotation: 0,
                excluded: false,
                delete: false,
              });
            }
          } catch (cntErr) {
            console.error("Failed to count pages:", cntErr);
          }
        }

        if (isMounted) {
          setOrganizePages(allPages);
          setInitialSnapshot(allPages);
          setHistory([allPages]);
          setHistoryIdx(0);
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
      setInitialSnapshot([]);
      setHistory([]);
      setHistoryIdx(-1);
      setSelectedPageIds([]);
      setZoomPage(null);
    }
  }, [files, tool.id]);

  // Page Operations
  const handleRotatePage = (id: string, delta: number) => {
    const next = organizePages.map((p) =>
      p.id === id ? { ...p, rotation: (p.rotation + delta + 360) % 360 } : p
    );
    commitState(next);
    if (zoomPage && zoomPage.id === id) {
      setZoomPage((prev) => (prev ? { ...prev, rotation: (prev.rotation + delta + 360) % 360 } : null));
    }
  };

  const handleExcludeTogglePage = (id: string) => {
    const next = organizePages.map((p) => {
      if (p.id === id) {
        const isNowExcluded = !(p.excluded || p.delete);
        return { ...p, excluded: isNowExcluded, delete: isNowExcluded };
      }
      return p;
    });
    commitState(next);
    if (zoomPage && zoomPage.id === id) {
      setZoomPage((prev) => (prev ? { ...prev, excluded: !(prev.excluded || prev.delete), delete: !(prev.excluded || prev.delete) } : null));
    }
  };

  const handleDeletePermanentPage = (id: string) => {
    const next = organizePages.filter((p) => p.id !== id);
    commitState(next);
    setSelectedPageIds((prev) => prev.filter((pId) => pId !== id));
    if (zoomPage && zoomPage.id === id) {
      setZoomPage(null);
    }
  };

  const handleDuplicatePage = (id: string) => {
    const idx = organizePages.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const target = organizePages[idx];
    const clone: PageOrderConfig = {
      ...target,
      id: `p-${target.originalPageNumber || target.original_page}-dup-${Math.random().toString(36).substring(2, 7)}`,
      excluded: false,
      delete: false,
    };
    const next = [...organizePages];
    next.splice(idx + 1, 0, clone);
    commitState(next);
  };

  const handleMovePage = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= organizePages.length) return;
    const next = [...organizePages];
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    commitState(next);
  };

  const handleDropCard = (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    const next = [...organizePages];
    const [draggedItem] = next.splice(draggedIndex, 1);
    next.splice(targetIndex, 0, draggedItem);
    commitState(next);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleToggleSelectPage = (id: string) => {
    setSelectedPageIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const activePages = organizePages.filter((p) => !(p.excluded || p.delete));
    if (selectedPageIds.length === activePages.length) {
      setSelectedPageIds([]);
    } else {
      setSelectedPageIds(activePages.map((p) => p.id));
    }
  };

  const handleSelectOddPages = () => {
    const oddIds = organizePages
      .filter((_, idx) => idx % 2 === 0)
      .map((p) => p.id);
    setSelectedPageIds(oddIds);
  };

  const handleSelectEvenPages = () => {
    const evenIds = organizePages
      .filter((_, idx) => idx % 2 === 1)
      .map((p) => p.id);
    setSelectedPageIds(evenIds);
  };

  const handleBatchRotate = (delta: number) => {
    if (selectedPageIds.length === 0) return;
    const next = organizePages.map((p) =>
      selectedPageIds.includes(p.id) ? { ...p, rotation: (p.rotation + delta + 360) % 360 } : p
    );
    commitState(next);
  };

  const handleBatchExclude = (shouldExclude: boolean) => {
    if (selectedPageIds.length === 0) return;
    const next = organizePages.map((p) =>
      selectedPageIds.includes(p.id) ? { ...p, excluded: shouldExclude, delete: shouldExclude } : p
    );
    commitState(next);
    setSelectedPageIds([]);
  };

  const handleBatchDelete = () => {
    if (selectedPageIds.length === 0) return;
    const next = organizePages.filter((p) => !selectedPageIds.includes(p.id));
    commitState(next);
    setSelectedPageIds([]);
  };

  const handleBatchDuplicate = () => {
    if (selectedPageIds.length === 0) return;
    const next: PageOrderConfig[] = [];
    organizePages.forEach((p) => {
      next.push(p);
      if (selectedPageIds.includes(p.id)) {
        next.push({
          ...p,
          id: `p-${p.originalPageNumber || p.original_page}-dup-${Math.random().toString(36).substring(2, 7)}`,
          excluded: false,
          delete: false,
        });
      }
    });
    commitState(next);
    setSelectedPageIds([]);
  };

  const handleRotateAll = (delta: number) => {
    const next = organizePages.map((p) => ({ ...p, rotation: (p.rotation + delta + 360) % 360 }));
    commitState(next);
  };

  const handleConfirmReset = () => {
    if (initialSnapshot.length > 0) {
      setOrganizePages(initialSnapshot);
      setHistory([initialSnapshot]);
      setHistoryIdx(0);
      setSelectedPageIds([]);
      setZoomPage(null);
    }
    setShowResetModal(false);
  };

  // Zoom Modal Navigation
  const handlePrevZoomPage = () => {
    if (!zoomPage) return;
    const curIdx = organizePages.findIndex((p) => p.id === zoomPage.id);
    if (curIdx > 0) {
      setZoomPage(organizePages[curIdx - 1]);
      setZoomScale(1);
    }
  };

  const handleNextZoomPage = () => {
    if (!zoomPage) return;
    const curIdx = organizePages.findIndex((p) => p.id === zoomPage.id);
    if (curIdx < organizePages.length - 1) {
      setZoomPage(organizePages[curIdx + 1]);
      setZoomScale(1);
    }
  };

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (tool.id !== "organize-pdf") return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Undo: Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Redo: Ctrl+Y or Cmd+Shift+Z or Cmd+Y
      else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        e.preventDefault();
        handleRedo();
      }
      // Escape: Close modal or clear selection
      else if (e.key === "Escape") {
        if (showResetModal) {
          setShowResetModal(false);
        } else if (zoomPage) {
          setZoomPage(null);
        } else if (selectedPageIds.length > 0) {
          setSelectedPageIds([]);
        }
      }
      // Delete / Backspace: Exclude selected pages
      else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedPageIds.length > 0 && !zoomPage) {
          e.preventDefault();
          handleBatchExclude(true);
        }
      }
      // Left / Right Arrow in Preview modal
      else if (zoomPage) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          handlePrevZoomPage();
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          handleNextZoomPage();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
  }, [tool.id, historyIdx, history, zoomPage, selectedPageIds, organizePages, showResetModal]);

  // Compute Human-Readable Change Summary Log
  const getChangeSummary = () => {
    if (initialSnapshot.length === 0 || organizePages.length === 0) return [];
    const changes: string[] = [];

    // Rotations
    const rotated = organizePages.filter((p) => p.rotation > 0);
    if (rotated.length > 0) {
      changes.push(`${rotated.length} page${rotated.length > 1 ? "s" : ""} rotated`);
    }

    // Excluded
    const excluded = organizePages.filter((p) => p.excluded || p.delete);
    if (excluded.length > 0) {
      changes.push(`${excluded.length} page${excluded.length > 1 ? "s" : ""} excluded from export`);
    }

    // Inserted from additional documents
    const inserted = organizePages.filter((p) => (p.sourceDocumentId ?? p.sourceFileIndex ?? 0) > 0);
    if (inserted.length > 0) {
      changes.push(`${inserted.length} page${inserted.length > 1 ? "s" : ""} inserted from additional documents`);
    }

    // Duplicated
    const duplicates = organizePages.filter((p) => p.id.includes("-dup-"));
    if (duplicates.length > 0) {
      changes.push(`${duplicates.length} duplicated page${duplicates.length > 1 ? "s" : ""}`);
    }

    // Reordered check
    if (organizePages.length === initialSnapshot.length) {
      const isReordered = organizePages.some((p, i) => p.id !== initialSnapshot[i]?.id);
      if (isReordered) {
        changes.push("Custom page sequence rearranged");
      }
    } else if (organizePages.length !== initialSnapshot.length) {
      changes.push("Page count modified");
    }

    return changes;
  };

  // Visual Crop State
  const [cropX, setCropX] = useState(10);
  const [cropY, setCropY] = useState(10);
  const [cropW, setCropW] = useState(80);
  const [cropH, setCropH] = useState(80);
  const [cropMode, setCropMode] = useState<"free" | "normal">("free");
  const [cropShape, setCropShape] = useState<"rectangle" | "circle" | "lasso">("rectangle");
  const [cropScope, setCropScope] = useState<"all" | "current">("all");
  const [cropCurrentPageIndex, setCropCurrentPageIndex] = useState<number>(0);
  const [cropThumbnails, setCropThumbnails] = useState<Array<{ page_num: number; thumbnail: string }>>([]);
  const [pageCrops, setPageCrops] = useState<Record<number, { x: number; y: number; w: number; h: number; shape?: string }>>({});
  const [lassoPoints, setLassoPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [isDrawingLasso, setIsDrawingLasso] = useState(false);
  const [cropPreset, setCropPreset] = useState<string>("free");
  const [cropPreviewUrl, setCropPreviewUrl] = useState<string | null>(null);
  const [cropLoadingPreview, setCropLoadingPreview] = useState(false);

  const cropContainerRef = useRef<HTMLDivElement>(null);
  const [activeDragHandle, setActiveDragHandle] = useState<string | null>(null);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    initialW: number;
    initialH: number;
  }>({ startX: 0, startY: 0, initialX: 10, initialY: 10, initialW: 80, initialH: 80 });

  useEffect(() => {
    if ((tool.id === "crop-pdf" || tool.id === "crop-image") && files.length > 0 && files[0]) {
      let isMounted = true;
      setCropLoadingPreview(true);

      if (tool.id === "crop-pdf") {
        fetchPdfThumbnails(files[0])
          .then((res) => {
            if (isMounted && res.success && Array.isArray(res.thumbnails) && res.thumbnails.length > 0) {
              setCropThumbnails(res.thumbnails);
              setCropPreviewUrl(res.thumbnails[0].thumbnail);
              setCropCurrentPageIndex(0);
              setPageCrops({});
            }
          })
          .catch((err) => console.warn("Failed to load PDF crop preview:", err))
          .finally(() => {
            if (isMounted) setCropLoadingPreview(false);
          });
      } else {
        setCropThumbnails([]);
        setPageCrops({});
        const reader = new FileReader();
        reader.onload = (e) => {
          if (isMounted && e.target?.result) {
            setCropPreviewUrl(e.target.result as string);
          }
          if (isMounted) setCropLoadingPreview(false);
        };
        reader.readAsDataURL(files[0]);
      }

      return () => {
        isMounted = false;
      };
    } else {
      setCropPreviewUrl(null);
      setCropThumbnails([]);
      setCropCurrentPageIndex(0);
      setPageCrops({});
    }
  }, [files, tool.id]);

  const handleSwitchCropPage = (idx: number) => {
    if (idx < 0 || idx >= cropThumbnails.length) return;
    
    // Save active page coordinates first
    setPageCrops((prev) => ({
      ...prev,
      [cropCurrentPageIndex]: { x: cropX, y: cropY, w: cropW, h: cropH, shape: cropShape },
    }));

    setCropCurrentPageIndex(idx);
    if (cropThumbnails[idx]?.thumbnail) {
      setCropPreviewUrl(cropThumbnails[idx].thumbnail);
    }

    // Load next page crop if customized, else retain current
    if (pageCrops[idx]) {
      const saved = pageCrops[idx];
      setCropX(saved.x);
      setCropY(saved.y);
      setCropW(saved.w);
      setCropH(saved.h);
      if (saved.shape) setCropShape(saved.shape as any);
    }
  };

  const applyCurrentCropToAllPages = () => {
    const updated: Record<number, { x: number; y: number; w: number; h: number; shape?: string }> = {};
    const count = cropThumbnails.length || 1;
    for (let i = 0; i < count; i++) {
      updated[i] = { x: cropX, y: cropY, w: cropW, h: cropH, shape: cropShape };
    }
    setPageCrops(updated);
  };

  const resetCurrentPageCrop = () => {
    setCropX(0);
    setCropY(0);
    setCropW(100);
    setCropH(100);
    setPageCrops((prev) => ({
      ...prev,
      [cropCurrentPageIndex]: { x: 0, y: 0, w: 100, h: 100, shape: "rectangle" },
    }));
  };

  const handleCropMouseDown = (e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!cropContainerRef.current) return;

    const rect = cropContainerRef.current.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;
    const xPct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

    if (cropMode === "free" && cropShape === "lasso" && handle === "new") {
      setIsDrawingLasso(true);
      setLassoPoints([{ x: Math.round(xPct), y: Math.round(yPct) }]);
      setCropX(Math.round(xPct));
      setCropY(Math.round(yPct));
      setCropW(5);
      setCropH(5);
      return;
    }

    if (handle === "new") {
      setLassoPoints([]);
      setCropX(Math.round(xPct));
      setCropY(Math.round(yPct));
      setCropW(5);
      setCropH(5);

      dragStartRef.current = {
        startX: clientX,
        startY: clientY,
        initialX: xPct,
        initialY: yPct,
        initialW: 5,
        initialH: 5,
      };
      setActiveDragHandle("se");
    } else {
      dragStartRef.current = {
        startX: clientX,
        startY: clientY,
        initialX: cropX,
        initialY: cropY,
        initialW: cropW,
        initialH: cropH,
      };
      setActiveDragHandle(handle);
    }
  };

  useEffect(() => {
    if (!activeDragHandle && !isDrawingLasso) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!cropContainerRef.current) return;
      const rect = cropContainerRef.current.getBoundingClientRect();

      if (isDrawingLasso) {
        const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

        setLassoPoints((prev) => {
          const next = [...prev, { x: Math.round(xPct), y: Math.round(yPct) }];
          const xs = next.map((p) => p.x);
          const ys = next.map((p) => p.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);

          const finalX = Math.max(0, minX);
          const finalY = Math.max(0, minY);
          const finalW = Math.max(5, maxX - minX);
          const finalH = Math.max(5, maxY - minY);

          setCropX(finalX);
          setCropY(finalY);
          setCropW(finalW);
          setCropH(finalH);

          setPageCrops((prevP) => ({
            ...prevP,
            [cropCurrentPageIndex]: { x: finalX, y: finalY, w: finalW, h: finalH, shape: "lasso" },
          }));

          return next;
        });
        return;
      }

      const deltaXPct = ((e.clientX - dragStartRef.current.startX) / rect.width) * 100;
      const deltaYPct = ((e.clientY - dragStartRef.current.startY) / rect.height) * 100;

      const { initialX, initialY, initialW, initialH } = dragStartRef.current;

      let newX = cropX;
      let newY = cropY;
      let newW = cropW;
      let newH = cropH;

      if (activeDragHandle === "move") {
        newX = Math.max(0, Math.min(100 - initialW, initialX + deltaXPct));
        newY = Math.max(0, Math.min(100 - initialH, initialY + deltaYPct));
      } else {
        newX = initialX;
        newY = initialY;
        newW = initialW;
        newH = initialH;

        if (activeDragHandle?.includes("e")) {
          newW = Math.max(5, Math.min(100 - initialX, initialW + deltaXPct));
        }
        if (activeDragHandle?.includes("s")) {
          newH = Math.max(5, Math.min(100 - initialY, initialH + deltaYPct));
        }
        if (activeDragHandle?.includes("w")) {
          const maxDelta = initialW - 5;
          const clampedDelta = Math.max(-initialX, Math.min(maxDelta, deltaXPct));
          newX = initialX + clampedDelta;
          newW = initialW - clampedDelta;
        }
        if (activeDragHandle?.includes("n")) {
          const maxDelta = initialH - 5;
          const clampedDelta = Math.max(-initialY, Math.min(maxDelta, deltaYPct));
          newY = initialY + clampedDelta;
          newH = initialH - clampedDelta;
        }
      }

      const rx = Math.round(newX);
      const ry = Math.round(newY);
      const rw = Math.round(newW);
      const rh = Math.round(newH);

      setCropX(rx);
      setCropY(ry);
      setCropW(rw);
      setCropH(rh);

      setPageCrops((prevP) => ({
        ...prevP,
        [cropCurrentPageIndex]: { x: rx, y: ry, w: rw, h: rh, shape: cropShape },
      }));
    };

    const handleMouseUp = () => {
      setActiveDragHandle(null);
      setIsDrawingLasso(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [activeDragHandle, isDrawingLasso, cropCurrentPageIndex, cropShape]);

  const applyCropPreset = (preset: string) => {
    setCropPreset(preset);
    let x = 0, y = 0, w = 100, h = 100;
    if (preset === "margins_10") { x = 10; y = 10; w = 80; h = 80; }
    else if (preset === "margins_20") { x = 20; y = 20; w = 60; h = 60; }
    else if (preset === "square") { x = 15; y = 15; w = 70; h = 70; }
    else if (preset === "a4") { x = 15; y = 10; w = 70; h = 80; }
    else if (preset === "landscape") { x = 5; y = 25; w = 90; h = 50; }

    setCropX(x);
    setCropY(y);
    setCropW(w);
    setCropH(h);
    setPageCrops((prev) => ({
      ...prev,
      [cropCurrentPageIndex]: { x, y, w, h, shape: "rectangle" },
    }));
  };

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
        clientRes = await clientAddPageNumbers(files[0], pageNumberPosition);
      } else if (tool.id === "add-watermark" && files[0]) {
        clientRes = await clientAddWatermark(files[0], watermarkText || "CONFIDENTIAL", watermarkPosition);
      } else if (tool.id === "crop-pdf" && files[0]) {
        clientRes = await clientCropPdf(files[0], { x: cropX, y: cropY, w: cropW, h: cropH }, pageCrops);
      } else if ((tool.id === "jpg-to-pdf" || tool.id === "scan-to-pdf") && files.length > 0) {
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
      const isCustom = compressLevel === "custom_target" || compressLevel === "custom_percent";
      formData.append("level", isCustom ? "custom" : compressLevel);
      if (compressLevel === "custom_target") {
        const val = parseFloat(targetSizeValue) || 200;
        const kb = targetSizeUnit === "MB" ? Math.round(val * 1024) : Math.round(val);
        formData.append("target_size_kb", String(kb));
      } else if (compressLevel === "custom_percent") {
        formData.append("quality_percent", String(customQualityPercent));
      }
    } else if (tool.id === "rotate-pdf") {
      formData.append("angle", rotateAngle);
    } else if (tool.id === "unlock-pdf" || tool.id === "protect-pdf") {
      formData.append("password", password);
    } else if (tool.id === "add-watermark") {
      formData.append("text", watermarkText);
      formData.append("rotation", watermarkPosition === "center" ? "0" : "45");
    } else if (tool.id === "add-page-numbers") {
      formData.append("position", pageNumberPosition);
    } else if (tool.id === "ocr-pdf" || tool.id === "indian-language-documents" || tool.id === "image-to-text") {
      formData.append("language", ocrLanguage);
    } else if (tool.id === "crop-pdf") {
      formData.append("crop_x", String(cropX));
      formData.append("crop_y", String(cropY));
      formData.append("crop_w", String(cropW));
      formData.append("crop_h", String(cropH));
      formData.append("crop_scope", cropScope);
      formData.append("current_page", String(cropCurrentPageIndex + 1));
      formData.append("page_crops_json", JSON.stringify(pageCrops));
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
            <div className="p-5 sm:p-7 bg-slate-50/95 rounded-3xl border border-slate-200 space-y-6 shadow-xs">
              {/* Top Header & Production Action Bar */}
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-200/90 pb-5">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                      <LayoutGrid className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-base font-extrabold text-slate-900">
                        Visual PDF Page Organizer
                      </h4>
                      <p className="text-xs text-slate-500 font-medium">
                        Drag pages to rearrange sequence • Rotate, duplicate, exclude, or merge documents
                      </p>
                    </div>
                  </div>

                  {/* Dynamic Page Counter Pills */}
                  <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px] font-bold">
                    <span className="bg-slate-200/80 text-slate-700 px-2.5 py-1 rounded-lg">
                      Original: {initialSnapshot.length} pages
                    </span>
                    <span className="bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-lg">
                      Export Total: {organizePages.filter((p) => !(p.excluded || p.delete)).length} pages
                    </span>
                    {organizePages.filter((p) => p.excluded || p.delete).length > 0 && (
                      <span className="bg-rose-100 text-rose-800 px-2.5 py-1 rounded-lg">
                        Excluded: {organizePages.filter((p) => p.excluded || p.delete).length} page(s)
                      </span>
                    )}
                    {selectedPageIds.length > 0 && (
                      <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-lg">
                        Selected: {selectedPageIds.length} page(s)
                      </span>
                    )}
                  </div>
                </div>

                {/* Production Control Toolbar: Undo/Redo, Selection, Rotate, Add PDF, Reset */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Undo / Redo Group */}
                  <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-xs">
                    <button
                      type="button"
                      onClick={handleUndo}
                      disabled={!canUndo}
                      className="p-2 text-slate-600 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-600 rounded-lg hover:bg-slate-50 transition cursor-pointer"
                      title="Undo (Ctrl+Z)"
                    >
                      <Undo2 className="w-4 h-4" />
                    </button>
                    <div className="h-4 w-px bg-slate-200" />
                    <button
                      type="button"
                      onClick={handleRedo}
                      disabled={!canRedo}
                      className="p-2 text-slate-600 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-600 rounded-lg hover:bg-slate-50 transition cursor-pointer"
                      title="Redo (Ctrl+Y)"
                    >
                      <Redo2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Selection Dropdown / Buttons */}
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    {selectedPageIds.length > 0 && selectedPageIds.length === organizePages.filter((p) => !(p.excluded || p.delete)).length ? (
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
                    onClick={handleSelectOddPages}
                    className="px-2.5 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 transition hidden sm:inline-flex shadow-xs cursor-pointer"
                  >
                    Select Odd
                  </button>

                  <button
                    type="button"
                    onClick={handleSelectEvenPages}
                    className="px-2.5 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 transition hidden sm:inline-flex shadow-xs cursor-pointer"
                  >
                    Select Even
                  </button>

                  {/* Global Rotate 90° */}
                  <button
                    type="button"
                    onClick={() => handleRotateAll(90)}
                    className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Rotate All 90°</span>
                  </button>

                  {/* Insert Another PDF Button */}
                  <button
                    type="button"
                    onClick={openFilePicker}
                    className="px-3.5 py-2 bg-gradient-to-r from-indigo-50 to-violet-50 hover:from-indigo-100 hover:to-violet-100 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Insert Another PDF</span>
                  </button>

                  {/* Reset Changes Button */}
                  <button
                    type="button"
                    onClick={() => setShowResetModal(true)}
                    className="px-3 py-2 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                    title="Reset to original document"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              {/* Batch Actions Toolbar (Visible when pages are selected) */}
              {selectedPageIds.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 text-white rounded-2xl shadow-lg shadow-indigo-500/20 animate-in fade-in">
                  <div className="flex items-center gap-2 text-xs font-bold pl-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>{selectedPageIds.length} page(s) selected</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleBatchRotate(90)}
                      className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Rotate 90°</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleBatchRotate(180)}
                      className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Rotate 180°</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleBatchDuplicate}
                      className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Duplicate</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleBatchExclude(true)}
                      className="px-3 py-1.5 bg-amber-500/90 hover:bg-amber-600 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Exclude</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleBatchExclude(false)}
                      className="px-3 py-1.5 bg-emerald-500/90 hover:bg-emerald-600 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Include</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleBatchDelete}
                      className="px-3 py-1.5 bg-rose-500/90 hover:bg-rose-600 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedPageIds([])}
                      className="p-1.5 hover:bg-white/20 rounded-xl transition cursor-pointer"
                      title="Clear Selection"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Changes Summary Box */}
              <div className="px-4 py-3 bg-white rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-slate-700 uppercase tracking-wider text-[10px]">
                    Modifications Log:
                  </span>
                  {getChangeSummary().length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5 text-indigo-700 font-semibold">
                      {getChangeSummary().map((item, cIdx) => (
                        <span key={cIdx} className="bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400 font-medium italic">No changes yet — document in original order</span>
                  )}
                </div>
              </div>

              {/* Page Thumbnails Grid */}
              {loadingPages ? (
                <div className="py-20 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-800">Processing visual PDF page structure...</p>
                  <p className="text-xs text-slate-400">Rendering high-resolution vector page thumbnails</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {organizePages.map((page, idx) => {
                    const isExcluded = Boolean(page.excluded || page.delete);
                    const isSelected = selectedPageIds.includes(page.id);
                    const isBeingDragged = draggedIndex === idx;
                    const isDragTarget = dragOverIndex === idx;

                    return (
                      <div
                        key={page.id}
                        draggable={true}
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
                        className={`relative bg-white rounded-2xl border transition-all duration-200 flex flex-col items-center justify-between p-3 group select-none shadow-xs ${
                          isBeingDragged
                            ? "opacity-30 scale-95 border-indigo-400 border-dashed"
                            : isDragTarget
                            ? "border-indigo-600 ring-2 ring-indigo-500/30 scale-105 shadow-xl shadow-indigo-500/20"
                            : isSelected
                            ? "border-indigo-600 ring-2 ring-indigo-600/20 bg-indigo-50/10"
                            : isExcluded
                            ? "border-rose-300 bg-rose-50/30 opacity-60"
                            : "border-slate-200 hover:border-indigo-400 hover:shadow-md hover:shadow-indigo-500/10"
                        }`}
                      >
                        {/* Top Card Bar: Checkbox, Position Badge, Zoom */}
                        <div className="w-full flex items-center justify-between text-[11px] font-bold mb-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleSelectPage(page.id)}
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
                            {page.rotation > 0 && !isExcluded && (
                              <span className="bg-indigo-50 text-indigo-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded border border-indigo-100">
                                ↻ {page.rotation}°
                              </span>
                            )}
                            {isExcluded && (
                              <span className="bg-rose-100 text-rose-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded border border-rose-200">
                                Excluded
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setZoomPage(page);
                                setZoomScale(1);
                              }}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition cursor-pointer"
                              title="Zoom & Inspect Page"
                            >
                              <ZoomIn className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Visual PDF Page Preview Sheet */}
                        <div
                          className="w-full aspect-[3/4] bg-white border border-slate-200 rounded-xl flex items-center justify-center p-1.5 shadow-inner transition-transform duration-300 relative overflow-hidden cursor-grab active:cursor-grabbing"
                          style={{ transform: `rotate(${page.rotation}deg)` }}
                        >
                          {page.thumbnail ? (
                            <img
                              src={page.thumbnail}
                              alt={`Page ${page.originalPageNumber || page.original_page}`}
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
                                Page {page.originalPageNumber || page.original_page}
                              </div>
                              <div className="space-y-1.5 opacity-30">
                                <div className="h-1 bg-slate-300 rounded-full w-full" />
                              </div>
                            </div>
                          )}

                          {/* Excluded Watermark Overlay */}
                          {isExcluded && (
                            <div className="absolute inset-0 bg-rose-500/20 backdrop-blur-[1px] flex items-center justify-center">
                              <span className="text-xs font-extrabold text-rose-700 bg-white/95 px-2.5 py-1 rounded-lg shadow-sm border border-rose-200">
                                Excluded from PDF
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Multi-Document Origin Tag if multiple files */}
                        {files.length > 1 && (
                          <div className="w-full text-center text-[9px] text-slate-400 truncate mt-1">
                            {page.sourceFileName || `Doc ${(page.sourceDocumentId ?? page.sourceFileIndex ?? 0) + 1}`} • Orig p.{page.originalPageNumber || page.original_page}
                          </div>
                        )}

                        {/* Bottom Quick Action Toolbar */}
                        <div className="w-full pt-2 mt-2 border-t border-slate-100 flex items-center justify-between gap-0.5">
                          {/* Rotate CCW */}
                          <button
                            type="button"
                            onClick={() => handleRotatePage(page.id, -90)}
                            className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                            title="Rotate 90° Left"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>

                          {/* Rotate CW */}
                          <button
                            type="button"
                            onClick={() => handleRotatePage(page.id, 90)}
                            className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                            title="Rotate 90° Right"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>

                          {/* Duplicate */}
                          <button
                            type="button"
                            onClick={() => handleDuplicatePage(page.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                            title="Duplicate Page"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {/* Move Left */}
                          <button
                            type="button"
                            onClick={() => handleMovePage(idx, -1)}
                            disabled={idx === 0}
                            className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-20 transition cursor-pointer"
                            title="Move Page Earlier"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </button>

                          {/* Move Right */}
                          <button
                            type="button"
                            onClick={() => handleMovePage(idx, 1)}
                            disabled={idx === organizePages.length - 1}
                            className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-20 transition cursor-pointer"
                            title="Move Page Later"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>

                          {/* Exclude / Include Toggle */}
                          <button
                            type="button"
                            onClick={() => handleExcludeTogglePage(page.id)}
                            className={`p-1 rounded-lg transition cursor-pointer ${
                              isExcluded
                                ? "text-emerald-600 hover:bg-emerald-50"
                                : "text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                            }`}
                            title={isExcluded ? "Include Page" : "Exclude Page"}
                          >
                            {isExcluded ? <Undo2 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>

                          {/* Delete Page */}
                          <button
                            type="button"
                            onClick={() => handleDeletePermanentPage(page.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Delete Page"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Reset Confirmation Modal */}
          {showResetModal && (
            <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                  <History className="w-6 h-6" />
                </div>
                <div className="text-center space-y-1.5">
                  <h4 className="text-base font-extrabold text-slate-900">Reset All Changes?</h4>
                  <p className="text-xs text-slate-500">
                    This will restore the original document page order, clear all rotations, and reset exclusions.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmReset}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-500/20 transition cursor-pointer"
                  >
                    Reset Everything
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Full-Screen Page Zoom & Inspect Modal */}
          {zoomPage && (
            <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl relative border border-slate-100">
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                      #{organizePages.findIndex((p) => p.id === zoomPage.id) + 1}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Page {zoomPage.originalPageNumber || zoomPage.original_page} Inspection
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {zoomPage.sourceFileName || "Main Document"} • Rotation: {zoomPage.rotation}° {zoomPage.excluded || zoomPage.delete ? "• (Excluded)" : ""}
                      </p>
                    </div>
                  </div>

                  {/* Zoom Controls */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-slate-100 rounded-xl p-0.5 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setZoomScale((s) => Math.max(0.75, s - 0.25))}
                        className="p-1.5 hover:bg-white rounded-lg transition"
                        title="Zoom Out"
                      >
                        <ZoomOut className="w-3.5 h-3.5 text-slate-600" />
                      </button>
                      <span className="px-2 font-mono text-[11px] text-slate-700">{Math.round(zoomScale * 100)}%</span>
                      <button
                        type="button"
                        onClick={() => setZoomScale((s) => Math.min(2.5, s + 0.25))}
                        className="p-1.5 hover:bg-white rounded-lg transition"
                        title="Zoom In"
                      >
                        <ZoomIn className="w-3.5 h-3.5 text-slate-600" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setZoomPage(null)}
                      className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* High-Resolution Enlarged Preview with Navigation Arrows */}
                <div className="relative w-full aspect-[3/4] max-h-[55vh] bg-slate-100 rounded-2xl flex items-center justify-center p-3 overflow-hidden border border-slate-200 group">
                  {/* Previous Page Arrow */}
                  <button
                    type="button"
                    onClick={handlePrevZoomPage}
                    disabled={organizePages.findIndex((p) => p.id === zoomPage.id) === 0}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-white/90 hover:bg-white text-slate-700 rounded-full shadow-md disabled:opacity-20 transition z-10 cursor-pointer"
                    title="Previous Page (ArrowLeft)"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  {/* Image Display */}
                  {zoomPage.thumbnail ? (
                    <div className="overflow-auto max-h-full max-w-full flex items-center justify-center">
                      <img
                        src={zoomPage.thumbnail}
                        alt={`Page ${zoomPage.originalPageNumber || zoomPage.original_page}`}
                        className="object-contain rounded-lg shadow transition-transform duration-300"
                        style={{
                          transform: `rotate(${zoomPage.rotation}deg) scale(${zoomScale})`,
                          maxHeight: "50vh",
                        }}
                      />
                    </div>
                  ) : (
                    <div className="text-slate-400 font-bold text-sm">
                      Page {zoomPage.originalPageNumber || zoomPage.original_page} (Preview not available)
                    </div>
                  )}

                  {/* Next Page Arrow */}
                  <button
                    type="button"
                    onClick={handleNextZoomPage}
                    disabled={organizePages.findIndex((p) => p.id === zoomPage.id) === organizePages.length - 1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white/90 hover:bg-white text-slate-700 rounded-full shadow-md disabled:opacity-20 transition z-10 cursor-pointer"
                    title="Next Page (ArrowRight)"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Modal Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
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
                      onClick={() => handleExcludeTogglePage(zoomPage.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                        zoomPage.excluded || zoomPage.delete
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                      }`}
                    >
                      {zoomPage.excluded || zoomPage.delete ? <Check className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{zoomPage.excluded || zoomPage.delete ? "Include in PDF" : "Exclude from PDF"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeletePermanentPage(zoomPage.id)}
                      className="px-3 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
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
            "resize-image", "crop-image", "convert-image", "add-page-numbers", "redact-pdf"
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

              {/* Compress PDF with Custom Typed Target Size */}
              {tool.id === "compress-pdf" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">Compression Mode</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { id: "low", label: "Low", desc: "Highest quality (~20%)" },
                        { id: "medium", label: "Medium", desc: "Balanced (~50%)" },
                        { id: "high", label: "High", desc: "Smallest size (~80%)" },
                        { id: "custom_target", label: "Exact Size", desc: "Type target KB/MB" },
                      ].map((lvl) => (
                        <button
                          type="button"
                          key={lvl.id}
                          onClick={() => setCompressLevel(lvl.id)}
                          className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
                            compressLevel === lvl.id
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20 ring-2 ring-indigo-600/30"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
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

                  {/* Custom Target Size Input Area */}
                  {compressLevel === "custom_target" && (
                    <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3 animate-in fade-in">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <span>Enter Desired Target File Size</span>
                          <span className="text-[10px] text-slate-400 font-normal">(We'll optimize the PDF to match)</span>
                        </label>

                        {/* Unit Toggle: KB / MB */}
                        <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 text-xs font-bold w-fit">
                          <button
                            type="button"
                            onClick={() => setTargetSizeUnit("KB")}
                            className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                              targetSizeUnit === "KB" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            KB
                          </button>
                          <button
                            type="button"
                            onClick={() => setTargetSizeUnit("MB")}
                            className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                              targetSizeUnit === "MB" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            MB
                          </button>
                        </div>
                      </div>

                      {/* Unrestricted Number Input Box & Quick Select Chips */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={targetSizeValue}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (/^[0-9]*\.?[0-9]*$/.test(val)) {
                                setTargetSizeValue(val);
                              }
                            }}
                            placeholder={targetSizeUnit === "KB" ? "e.g. 200" : "e.g. 5"}
                            className="w-full pl-4 pr-14 py-3 bg-white border border-indigo-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 rounded-xl text-sm font-bold text-slate-900 outline-hidden"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-600">
                            {targetSizeUnit}
                          </span>
                        </div>

                        {/* Quick Presets */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {(targetSizeUnit === "KB" ? ["50", "100", "200", "500"] : ["0.5", "1.0", "2.0", "5.0"]).map((val) => (
                            <button
                              type="button"
                              key={val}
                              onClick={() => setTargetSizeValue(val)}
                              className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                                targetSizeValue === val
                                  ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              {val} {targetSizeUnit}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Dynamic Reduction Calculation Preview */}
                      {files[0] && (
                        <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-indigo-100/60 font-medium">
                          <span>Original size: <strong className="text-slate-800">{formatFileSize(files[0].size)}</strong></span>
                          <span>
                            Target size: <strong className="text-indigo-700">{targetSizeValue} {targetSizeUnit}</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  )}
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
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Watermark Text</label>
                    <input
                      type="text"
                      value={watermarkText}
                      onChange={(e) => setWatermarkText(e.target.value)}
                      placeholder="e.g. CONFIDENTIAL, DRAFT, DO NOT COPY"
                      className="w-full p-3 bg-white border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Watermark Orientation</label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setWatermarkPosition("cross")}
                        className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
                          watermarkPosition === "cross"
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20 ring-2 ring-indigo-600/30"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="text-xs font-bold uppercase">Cross (Diagonal)</div>
                        <div className={`text-[10px] mt-0.5 ${watermarkPosition === "cross" ? "text-indigo-200" : "text-slate-400"}`}>
                          Diagonal 45° across page
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setWatermarkPosition("center")}
                        className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
                          watermarkPosition === "center"
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20 ring-2 ring-indigo-600/30"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="text-xs font-bold uppercase">Center (Horizontal)</div>
                        <div className={`text-[10px] mt-0.5 ${watermarkPosition === "center" ? "text-indigo-200" : "text-slate-400"}`}>
                          Horizontal 0° in middle
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Add Page Numbers */}
              {tool.id === "add-page-numbers" && (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-700">Page Number Position</label>
                  
                  {/* Visual 6-position Page Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "top-left", label: "Top Left" },
                      { id: "top-center", label: "Top Center" },
                      { id: "top-right", label: "Top Right" },
                      { id: "bottom-left", label: "Bottom Left" },
                      { id: "bottom-center", label: "Bottom Center" },
                      { id: "bottom-right", label: "Bottom Right" },
                    ].map((pos) => (
                      <button
                        type="button"
                        key={pos.id}
                        onClick={() => setPageNumberPosition(pos.id)}
                        className={`p-2.5 rounded-xl border text-center transition cursor-pointer text-xs font-bold ${
                          pageNumberPosition === pos.id
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>

                  {/* Accessible Select Dropdown */}
                  <select
                    value={pageNumberPosition}
                    onChange={(e) => setPageNumberPosition(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-hidden"
                  >
                    <option value="bottom-center">Bottom Center (Recommended)</option>
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="top-center">Top Center</option>
                    <option value="top-right">Top Right</option>
                    <option value="top-left">Top Left</option>
                  </select>
                </div>
              )}

              {/* Visual Mouse-Based Crop PDF / Crop Image Editor */}
              {(tool.id === "crop-pdf" || tool.id === "crop-image") && (
                <div className="space-y-4">
                  {/* Mode Switcher: Free Mode vs Normal Mode */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Crop className="w-4 h-4 text-indigo-600" />
                        <span>Interactive Page Crop Tool</span>
                      </label>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {cropMode === "free"
                          ? "Free Mode: Click & drag mouse to cut or adjust handles freely."
                          : "Normal Mode: Choose standard aspect ratio presets & margins."}
                      </p>
                    </div>

                    <div className="flex items-center bg-slate-100 p-1 rounded-xl w-fit">
                      <button
                        type="button"
                        onClick={() => {
                          setCropMode("free");
                          setCropPreset("free");
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                          cropMode === "free"
                            ? "bg-white text-indigo-700 shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <Move className="w-3.5 h-3.5" />
                        Free Mode
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setCropMode("normal");
                          if (cropPreset === "free") applyCropPreset("margins_10");
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                          cropMode === "normal"
                            ? "bg-white text-indigo-700 shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        Normal Mode
                      </button>
                    </div>

                    {/* Free Mode Shape Selector (Freehand Lasso / Circle / Rectangle) */}
                    {cropMode === "free" && (
                      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl animate-in fade-in">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
                          <span>Free Mode Tool:</span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              setCropShape("lasso");
                              setLassoPoints([]);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                              cropShape === "lasso"
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                            }`}
                          >
                            <PenTool className="w-3.5 h-3.5" />
                            <span>Draw / Circle (Lasso)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setCropShape("circle");
                              setLassoPoints([]);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                              cropShape === "circle"
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                            }`}
                          >
                            <Circle className="w-3.5 h-3.5" />
                            <span>Circle / Oval</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setCropShape("rectangle");
                              setLassoPoints([]);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                              cropShape === "rectangle"
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                            }`}
                          >
                            <Square className="w-3.5 h-3.5" />
                            <span>Rectangle Box</span>
                          </button>

                          {lassoPoints.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setLassoPoints([])}
                              className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-red-600 hover:bg-red-50 transition cursor-pointer"
                            >
                              Clear Path
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Normal Mode Aspect Ratio / Margin Presets */}
                  {cropMode === "normal" && (
                    <div className="space-y-2 animate-in fade-in">
                      <label className="block text-xs font-bold text-slate-700">Preset Ratios & Margins</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { id: "full", label: "Full Page", desc: "Reset (100%)" },
                          { id: "margins_10", label: "10% Margins", desc: "Trim edges" },
                          { id: "margins_20", label: "20% Margins", desc: "Trim borders" },
                          { id: "a4", label: "A4 / Letter", desc: "1:1.41 Portrait" },
                          { id: "square", label: "Square", desc: "1:1 Ratio" },
                          { id: "landscape", label: "Landscape", desc: "16:9 Widescreen" },
                        ].map((preset) => (
                          <button
                            type="button"
                            key={preset.id}
                            onClick={() => applyCropPreset(preset.id)}
                            className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                              cropPreset === preset.id
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            <div className="text-xs font-bold">{preset.label}</div>
                            <div className={`text-[10px] mt-0.5 ${cropPreset === preset.id ? "text-indigo-200" : "text-slate-400"}`}>
                              {preset.desc}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Crop Scope (Apply to All Pages vs Current Page) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-700">Apply Crop To:</label>
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                        {cropScope === "all" ? `All ${cropThumbnails.length || ""} Pages Selected` : `Page ${cropCurrentPageIndex + 1} Only`}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setCropScope("all")}
                        className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
                          cropScope === "all"
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20 ring-2 ring-indigo-600/30"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="text-xs font-bold uppercase flex items-center justify-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" />
                          <span>All Pages ({cropThumbnails.length || "1+"})</span>
                        </div>
                        <div className={`text-[10px] mt-0.5 ${cropScope === "all" ? "text-indigo-200" : "text-slate-400"}`}>
                          Crop every page in PDF
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCropScope("current")}
                        className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
                          cropScope === "current"
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20 ring-2 ring-indigo-600/30"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="text-xs font-bold uppercase flex items-center justify-center gap-1.5">
                          <LayoutGrid className="w-3.5 h-3.5" />
                          <span>Current Page ({cropCurrentPageIndex + 1})</span>
                        </div>
                        <div className={`text-[10px] mt-0.5 ${cropScope === "current" ? "text-indigo-200" : "text-slate-400"}`}>
                          Only crop page {cropCurrentPageIndex + 1}
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Multi-Page Carousel Navigator with Per-Page Sync Actions */}
                  {cropThumbnails.length > 1 && (
                    <div className="p-3.5 bg-slate-100/90 rounded-2xl border border-slate-200 space-y-3 animate-in fade-in">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">
                            Editing Page {cropCurrentPageIndex + 1} of {cropThumbnails.length}
                          </span>
                          {pageCrops[cropCurrentPageIndex] ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-md">
                              ✂️ Custom Crop
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-bold rounded-md">
                              Default
                            </span>
                          )}
                        </div>

                        {/* Page-Specific Action Buttons */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={applyCurrentCropToAllPages}
                            className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
                            title="Copy this page's crop box to every page in the PDF"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy to All Pages</span>
                          </button>

                          <button
                            type="button"
                            onClick={resetCurrentPageCrop}
                            className="px-2 py-1 bg-white hover:bg-slate-200 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer"
                            title="Reset this page to 100% full page"
                          >
                            Reset Page
                          </button>

                          <div className="flex items-center gap-1 ml-1">
                            <button
                              type="button"
                              disabled={cropCurrentPageIndex === 0}
                              onClick={() => handleSwitchCropPage(cropCurrentPageIndex - 1)}
                              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold disabled:opacity-40 hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed transition"
                            >
                              ← Prev
                            </button>
                            <button
                              type="button"
                              disabled={cropCurrentPageIndex === cropThumbnails.length - 1}
                              onClick={() => handleSwitchCropPage(cropCurrentPageIndex + 1)}
                              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold disabled:opacity-40 hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed transition"
                            >
                              Next →
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Interactive Thumbnail Carousel Strip */}
                      <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 pt-1 scrollbar-thin">
                        {cropThumbnails.map((t, idx) => {
                          const isCustomized = !!pageCrops[idx];
                          const isActive = cropCurrentPageIndex === idx;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleSwitchCropPage(idx)}
                              className={`shrink-0 relative rounded-xl border overflow-hidden transition cursor-pointer group ${
                                isActive
                                  ? "ring-3 ring-indigo-600 border-indigo-600 shadow-md scale-105"
                                  : "border-slate-300 opacity-75 hover:opacity-100 bg-white"
                              }`}
                            >
                              <img src={t.thumbnail} alt={`Page ${t.page_num}`} className="w-14 h-20 object-contain bg-white" />
                              {isCustomized && (
                                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white shadow-xs" title="Custom crop set for this page" />
                              )}
                              <span className={`absolute bottom-0 inset-x-0 text-[10px] font-bold text-center py-0.5 ${
                                isActive ? "bg-indigo-600 text-white" : isCustomized ? "bg-emerald-700 text-white" : "bg-slate-900/85 text-white"
                              }`}>
                                Page {t.page_num}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Interactive Visual Mouse Crop Canvas */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">Visual Page Crop Preview</span>
                      <span>
                        {cropShape === "lasso"
                          ? "Click & drag anywhere on the page to circle or draw your crop path"
                          : "Use mouse to drag handles or move the crop box"}
                      </span>
                    </div>

                    <div
                      ref={cropContainerRef}
                      onMouseDown={(e) => {
                        if (cropMode === "free") {
                          handleCropMouseDown(e, "new");
                        }
                      }}
                      className="relative w-full max-w-lg mx-auto bg-slate-900/90 rounded-2xl overflow-hidden shadow-inner border border-slate-300 select-none flex items-center justify-center min-h-[380px] max-h-[500px] cursor-crosshair group"
                    >
                      {cropLoadingPreview ? (
                        <div className="flex flex-col items-center justify-center p-8 text-white/70 space-y-2">
                          <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
                          <span className="text-xs font-semibold">Generating document preview...</span>
                        </div>
                      ) : cropPreviewUrl ? (
                        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                          {/* Page Image */}
                          <img
                            src={cropPreviewUrl}
                            alt="PDF Crop Page Preview"
                            className="max-h-[460px] w-auto object-contain pointer-events-none"
                          />

                          {/* Freehand Lasso SVG Path Overlay */}
                          {cropShape === "lasso" && lassoPoints.length > 1 && (
                            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                              <polygon
                                points={lassoPoints.map((p) => `${(p.x / 100) * (cropContainerRef.current?.clientWidth || 500)},${(p.y / 100) * (cropContainerRef.current?.clientHeight || 500)}`).join(" ")}
                                fill="rgba(99, 102, 241, 0.25)"
                                stroke="#6366f1"
                                strokeWidth="3"
                                strokeDasharray="5 5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}

                          {/* Active Crop Box with Shadow Mask */}
                          <div
                            style={{
                              left: `${cropX}%`,
                              top: `${cropY}%`,
                              width: `${cropW}%`,
                              height: `${cropH}%`,
                              borderRadius: cropShape === "circle" ? "9999px" : "4px",
                              boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.65)",
                            }}
                            className={`absolute border-2 ${
                              cropShape === "lasso" ? "border-indigo-400 border-dashed opacity-70" : "border-indigo-500"
                            } pointer-events-auto transition-[border-radius]`}
                          >
                            {/* Rule of Thirds Grid (for Rectangle) */}
                            {cropShape === "rectangle" && (
                              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                                <div className="border-r border-b border-white/60 border-dashed" />
                                <div className="border-r border-b border-white/60 border-dashed" />
                                <div className="border-b border-white/60 border-dashed" />
                                <div className="border-r border-b border-white/60 border-dashed" />
                                <div className="border-r border-b border-white/60 border-dashed" />
                                <div className="border-b border-white/60 border-dashed" />
                                <div className="border-r border-white/60 border-dashed" />
                                <div className="border-r border-white/60 border-dashed" />
                                <div />
                              </div>
                            )}

                            {/* Center Drag to Move Area */}
                            <div
                              onMouseDown={(e) => handleCropMouseDown(e, "move")}
                              className="absolute inset-3 flex items-center justify-center cursor-move group/move"
                            >
                              <div className="bg-indigo-600/90 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-md flex items-center gap-1 opacity-90 group-hover/move:scale-105 transition-transform pointer-events-none">
                                {cropShape === "circle" ? <Circle className="w-3 h-3" /> : cropShape === "lasso" ? <PenTool className="w-3 h-3" /> : <Move className="w-3 h-3" />}
                                <span>{cropW}% × {cropH}%</span>
                              </div>
                            </div>

                            {/* 8 Interactive Corner & Edge Resize Handles */}
                            <div
                              onMouseDown={(e) => handleCropMouseDown(e, "nw")}
                              className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-full shadow-md cursor-nw-resize hover:scale-125 transition-transform"
                            />
                            <div
                              onMouseDown={(e) => handleCropMouseDown(e, "n")}
                              className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-full shadow-md cursor-n-resize hover:scale-125 transition-transform"
                            />
                            <div
                              onMouseDown={(e) => handleCropMouseDown(e, "ne")}
                              className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-full shadow-md cursor-ne-resize hover:scale-125 transition-transform"
                            />
                            <div
                              onMouseDown={(e) => handleCropMouseDown(e, "e")}
                              className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-full shadow-md cursor-e-resize hover:scale-125 transition-transform"
                            />
                            <div
                              onMouseDown={(e) => handleCropMouseDown(e, "se")}
                              className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-full shadow-md cursor-se-resize hover:scale-125 transition-transform"
                            />
                            <div
                              onMouseDown={(e) => handleCropMouseDown(e, "s")}
                              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-full shadow-md cursor-s-resize hover:scale-125 transition-transform"
                            />
                            <div
                              onMouseDown={(e) => handleCropMouseDown(e, "sw")}
                              className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-full shadow-md cursor-sw-resize hover:scale-125 transition-transform"
                            />
                            <div
                              onMouseDown={(e) => handleCropMouseDown(e, "w")}
                              className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-full shadow-md cursor-w-resize hover:scale-125 transition-transform"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-center p-8 text-white/70 space-y-2">
                          <FileText className="w-10 h-10 mx-auto text-indigo-400 opacity-80" />
                          <p className="text-xs font-bold">Document Loaded</p>
                          <p className="text-[11px] text-white/50">Crop area: {cropW}% width × {cropH}% height</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Manual Coordinates & Fine Tuning */}
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Exact Crop Coordinates (%)</span>
                      <button
                        type="button"
                        onClick={() => applyCropPreset("full")}
                        className="text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer"
                      >
                        Reset to Full
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Left (X)</label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="90"
                            value={cropX}
                            onChange={(e) => setCropX(Math.max(0, Math.min(90, Number(e.target.value) || 0)))}
                            className="w-full pl-3 pr-7 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">%</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Top (Y)</label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="90"
                            value={cropY}
                            onChange={(e) => setCropY(Math.max(0, Math.min(90, Number(e.target.value) || 0)))}
                            className="w-full pl-3 pr-7 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">%</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Width</label>
                        <div className="relative">
                          <input
                            type="number"
                            min="10"
                            max="100"
                            value={cropW}
                            onChange={(e) => setCropW(Math.max(10, Math.min(100 - cropX, Number(e.target.value) || 10)))}
                            className="w-full pl-3 pr-7 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">%</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Height</label>
                        <div className="relative">
                          <input
                            type="number"
                            min="10"
                            max="100"
                            value={cropH}
                            onChange={(e) => setCropH(Math.max(10, Math.min(100 - cropY, Number(e.target.value) || 10)))}
                            className="w-full pl-3 pr-7 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">%</span>
                        </div>
                      </div>
                    </div>
                  </div>
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

            {/* Extracted Text Preview (only for Image to Text) */}
            {result.extracted_text && tool.id === "image-to-text" && (
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
