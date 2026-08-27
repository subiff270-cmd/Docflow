"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ToolItem } from "../lib/toolsData";
import { useAuth } from "../context/AuthContext";
import { processToolApi, getDownloadUrl, fetchPdfThumbnails, searchPdfMatches } from "../lib/api";
import {
  clientMergePdf,
  clientSplitPdf,
  clientRemovePages,
  clientExtractPages,
  clientRotatePdf,
  clientAddPageNumbers,
  clientAddWatermark,
  clientCropPdf,
  clientSignPdf,
  PlacedSignField,
  clientRedactPdf,
  RedactBox,
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
  Edit3,
  Type,
  Image as ImageIcon,
  Calendar,
  User,
  Award,
  Palette,
  Layers,
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

  // =========================================================================
  // ADVANCED SIGN PDF STUDIO STATE & PLACEMENT ENGINE (iLovePDF Style)
  // =========================================================================
  const [sigSigningMode, setSigSigningMode] = useState<"simple" | "digital">("simple");
  const [isSigConfigModalOpen, setIsSigConfigModalOpen] = useState<boolean>(false);
  const [sigFullName, setSigFullName] = useState<string>(
    profile?.display_name || user?.displayName || (user?.email ? user.email.split("@")[0] : "Your Name")
  );
  const [sigInitials, setSigInitials] = useState<string>(
    (profile?.display_name || user?.displayName || "Your Name")
      .split(" ")
      .map((w: string) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "YN"
  );
  const [sigModalTab, setSigModalTab] = useState<"signature" | "initials" | "stamp">("signature");
  const [sigCreationMode, setSigCreationMode] = useState<"type" | "draw" | "upload">("type");
  const [sigColor, setSigColor] = useState<string>("#0f172a");
  const [sigSelectedFontIndex, setSigSelectedFontIndex] = useState<number>(0);
  const [sigDataUrl, setSigDataUrl] = useState<string | null>(null);
  const [drawnSigDataUrl, setDrawnSigDataUrl] = useState<string | null>(null);
  const [sigPenStyle, setSigPenStyle] = useState<"fountain" | "ballpoint" | "brush">("fountain");
  const [sigPenThickness, setSigPenThickness] = useState<number>(2.5);
  const [sigStrokes, setSigStrokes] = useState<Array<{
    points: Array<{ x: number; y: number; time: number; pressure?: number }>;
    color: string;
    style: "fountain" | "ballpoint" | "brush";
    thickness: number;
  }>>([]);
  const [sigRedoStack, setSigRedoStack] = useState<Array<{
    points: Array<{ x: number; y: number; time: number; pressure?: number }>;
    color: string;
    style: "fountain" | "ballpoint" | "brush";
    thickness: number;
  }>>([]);
  const currentStrokePointsRef = useRef<Array<{ x: number; y: number; time: number; pressure?: number }>>([]);

  const [initialsDataUrl, setInitialsDataUrl] = useState<string | null>(null);
  const [companyStampDataUrl, setCompanyStampDataUrl] = useState<string | null>(null);

  const [placedFields, setPlacedFields] = useState<PlacedSignField[]>([]);
  const [activePlacedFieldId, setActivePlacedFieldId] = useState<string | null>(null);

  const [sigPageNum, setSigPageNum] = useState<number>(1);
  const [sigThumbnails, setSigThumbnails] = useState<Array<{ page_num: number; thumbnail: string }>>([]);
  const [sigPreviewUrl, setSigPreviewUrl] = useState<string | null>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const sigContainerRef = useRef<HTMLDivElement>(null);
  const [isDrawingSig, setIsDrawingSig] = useState(false);

  const [activeFieldDragHandle, setActiveFieldDragHandle] = useState<string | null>(null);
  const fieldDragStartRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    initialW: number;
    initialH: number;
    fieldId: string;
  }>({ startX: 0, startY: 0, initialX: 0, initialY: 0, initialW: 0, initialH: 0, fieldId: "" });

  // =========================================================================
  // ADVANCED REDACT PDF STUDIO STATE & ENGINE
  // =========================================================================
  const [redactSearchText, setRedactSearchText] = useState<string>("");
  const [redactBoxes, setRedactBoxes] = useState<RedactBox[]>([]);
  const [activeRedactBoxId, setActiveRedactBoxId] = useState<string | null>(null);
  const [redactColor, setRedactColor] = useState<string>("#000000");
  const [redactLabelText, setRedactLabelText] = useState<string>("[REDACTED]");
  const [redactWipeMetadata, setRedactWipeMetadata] = useState<boolean>(true);
  const [redactPageNum, setRedactPageNum] = useState<number>(1);
  const [redactThumbnails, setRedactThumbnails] = useState<Array<{ page_num: number; thumbnail: string }>>([]);
  const [redactPreviewUrl, setRedactPreviewUrl] = useState<string | null>(null);
  const redactContainerRef = useRef<HTMLDivElement>(null);
  const [activeRedactDragHandle, setActiveRedactDragHandle] = useState<string | null>(null);
  const redactDragStartRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    initialW: number;
    initialH: number;
    boxId: string;
  }>({ startX: 0, startY: 0, initialX: 0, initialY: 0, initialW: 0, initialH: 0, boxId: "" });

  const signatureFonts = [
    { id: "dancing-script", name: "1. Dancing Script (Classic Cursive)", style: "'Dancing Script', cursive", size: 66 },
    { id: "caveat", name: "2. Modern Caveat (Natural Flow)", style: "'Caveat', cursive", size: 70 },
    { id: "great-vibes", name: "3. Great Vibes (Calligraphy)", style: "'Great Vibes', cursive", size: 64 },
    { id: "alex-brush", name: "4. Alex Brush (Elegance)", style: "'Alex Brush', cursive", size: 72 },
    { id: "allura", name: "5. Allura (Royal Script)", style: "'Allura', cursive", size: 74 },
    { id: "sacramento", name: "6. Sacramento (Monoline)", style: "'Sacramento', cursive", size: 62 },
    { id: "pacifico", name: "7. Pacifico (Bold Casual)", style: "'Pacifico', cursive", size: 56 },
    { id: "satisfy", name: "8. Satisfy (Classic Flow)", style: "'Satisfy', cursive", size: 60 },
    { id: "marck-script", name: "9. Marck Script (Vintage)", style: "'Marck Script', cursive", size: 60 },
    { id: "homemade-apple", name: "10. Handwritten Apple", style: "'Homemade Apple', cursive", size: 48 },
  ];

  const generateSignatureImage = (text: string, fontIndex: number, color: string): string => {
    if (typeof window === "undefined") return "";
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 180;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    const fontObj = signatureFonts[fontIndex % signatureFonts.length] || signatureFonts[0];
    ctx.font = `italic ${fontObj.size}px ${fontObj.style}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text || "Signature", canvas.width / 2, canvas.height / 2);
    return canvas.toDataURL("image/png");
  };

  const applyPlacementPreset = (preset: "bottom-right" | "bottom-left" | "bottom-center" | "top-right" | "top-left" | "center") => {
    let x = 60, y = 78;
    if (preset === "bottom-right") { x = 60; y = 78; }
    else if (preset === "bottom-left") { x = 8; y = 78; }
    else if (preset === "bottom-center") { x = 34; y = 78; }
    else if (preset === "top-right") { x = 60; y = 12; }
    else if (preset === "top-left") { x = 8; y = 12; }
    else if (preset === "center") { x = 34; y = 45; }

    const activeSig = sigDataUrl || generateSignatureImage(sigFullName, sigSelectedFontIndex, sigColor);

    if (activePlacedFieldId) {
      setPlacedFields((prev) =>
        prev.map((f) => (f.id === activePlacedFieldId ? { ...f, x, y, page: sigPageNum } : f))
      );
    } else {
      addPlacedField("signature");
      setTimeout(() => {
        setPlacedFields((prev) =>
          prev.map((f, i) => (i === prev.length - 1 ? { ...f, x, y } : f))
        );
      }, 50);
    }
  };

  const copySignaturesToAllPages = () => {
    const currentFields = placedFields.filter((f) => f.page === sigPageNum);
    if (currentFields.length === 0) return;

    const newFields: PlacedSignField[] = [];
    sigThumbnails.forEach((t) => {
      currentFields.forEach((cf) => {
        newFields.push({
          ...cf,
          id: `field-${t.page_num}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          page: t.page_num,
        });
      });
    });
    setPlacedFields(newFields);
  };

  const copySignaturesToLastPage = () => {
    if (sigThumbnails.length === 0) return;
    const lastPageNum = sigThumbnails[sigThumbnails.length - 1].page_num;
    const currentFields = placedFields.filter((f) => f.page === sigPageNum);
    if (currentFields.length === 0) return;

    const newFields = placedFields.filter((f) => f.page !== lastPageNum);
    currentFields.forEach((cf) => {
      newFields.push({
        ...cf,
        id: `field-last-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        page: lastPageNum,
      });
    });
    setPlacedFields(newFields);
    handleSwitchSigPage(lastPageNum);
  };

  // Initialize default signatures
  useEffect(() => {
    if (typeof window !== "undefined") {
      const defaultSig = generateSignatureImage(sigFullName, sigSelectedFontIndex, sigColor);
      setSigDataUrl(defaultSig);
      const defaultInit = generateSignatureImage(sigInitials, sigSelectedFontIndex, sigColor);
      setInitialsDataUrl(defaultInit);
    }
  }, []);

  useEffect(() => {
    if (tool.id === "sign-pdf" && files.length > 0 && files[0]) {
      let isMounted = true;
      fetchPdfThumbnails(files[0])
        .then((res) => {
          if (isMounted && res.success && Array.isArray(res.thumbnails) && res.thumbnails.length > 0) {
            setSigThumbnails(res.thumbnails);
            setSigPreviewUrl(res.thumbnails[0].thumbnail);
            setSigPageNum(1);
            // Default 1 signature placed if none
            const initialSig = generateSignatureImage(sigFullName, sigSelectedFontIndex, sigColor);
            setPlacedFields([
              {
                id: "sig-1",
                type: "signature",
                page: 1,
                x: 50,
                y: 68,
                w: 32,
                h: 12,
                dataUrl: initialSig,
              },
            ]);
          }
        })
        .catch((err) => console.warn("Failed to load PDF sign preview:", err));
      return () => { isMounted = false; };
    } else if (tool.id === "sign-pdf") {
      setSigThumbnails([]);
      setSigPreviewUrl(null);
      setSigPageNum(1);
      setPlacedFields([]);
    }
  }, [files, tool.id]);

  useEffect(() => {
    if (tool.id === "redact-pdf" && files.length > 0 && files[0]) {
      let isMounted = true;
      fetchPdfThumbnails(files[0])
        .then((res) => {
          if (isMounted && res.success && Array.isArray(res.thumbnails) && res.thumbnails.length > 0) {
            setRedactThumbnails(res.thumbnails);
            setRedactPreviewUrl(res.thumbnails[0].thumbnail);
            setRedactPageNum(1);
            setRedactBoxes([
              {
                id: "redact-1",
                page: 1,
                x: 20,
                y: 30,
                w: 50,
                h: 6,
                label: "[REDACTED]",
              },
            ]);
          }
        })
        .catch((err) => console.warn("Failed to load PDF redact preview:", err));
      return () => { isMounted = false; };
    } else if (tool.id === "redact-pdf") {
      setRedactThumbnails([]);
      setRedactPreviewUrl(null);
      setRedactPageNum(1);
      setRedactBoxes([]);
    }
  }, [files, tool.id]);

  const handleSwitchSigPage = (pageNum: number) => {
    setSigPageNum(pageNum);
    const targetThumb = sigThumbnails.find((t) => t.page_num === pageNum);
    if (targetThumb) {
      setSigPreviewUrl(targetThumb.thumbnail);
    }
  };

  const handleSwitchRedactPage = (pageNum: number) => {
    setRedactPageNum(pageNum);
    const targetThumb = redactThumbnails.find((t) => t.page_num === pageNum);
    if (targetThumb) {
      setRedactPreviewUrl(targetThumb.thumbnail);
    }
  };

  const addRedactBox = (preset?: "custom" | "line" | "box") => {
    const id = `redact-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const newBox: RedactBox = {
      id,
      page: redactPageNum,
      x: preset === "line" ? 15 : 25,
      y: preset === "line" ? 40 : 35,
      w: preset === "line" ? 70 : 40,
      h: preset === "line" ? 5 : 12,
      label: redactLabelText || undefined,
    };
    setRedactBoxes((prev) => [...prev, newBox]);
    setActiveRedactBoxId(id);
  };

  const deleteRedactBox = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRedactBoxes((prev) => prev.filter((b) => b.id !== id));
    if (activeRedactBoxId === id) setActiveRedactBoxId(null);
  };

  const duplicateRedactBox = (box: RedactBox, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newBox: RedactBox = {
      ...box,
      id: `redact-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      x: Math.min(75, box.x + 4),
      y: Math.min(80, box.y + 4),
    };
    setRedactBoxes((prev) => [...prev, newBox]);
    setActiveRedactBoxId(newBox.id);
  };

  const handleRedactBoxMouseDown = (e: React.MouseEvent, box: RedactBox, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveRedactBoxId(box.id);
    setActiveRedactDragHandle(handle);
    redactDragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: box.x,
      initialY: box.y,
      initialW: box.w,
      initialH: box.h,
      boxId: box.id,
    };
  };

  useEffect(() => {
    if (!activeRedactDragHandle) return;

    const handleMouseMove = (e: MouseEvent) => {
      const { startX, startY, initialX, initialY, initialW, initialH, boxId } = redactDragStartRef.current;
      const container = redactContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const deltaXPct = ((e.clientX - startX) / rect.width) * 100;
      const deltaYPct = ((e.clientY - startY) / rect.height) * 100;

      setRedactBoxes((prev) =>
        prev.map((b) => {
          if (b.id !== boxId) return b;
          if (activeRedactDragHandle === "move") {
            const newX = Math.max(0, Math.min(100 - b.w, Math.round(initialX + deltaXPct)));
            const newY = Math.max(0, Math.min(100 - b.h, Math.round(initialY + deltaYPct)));
            return { ...b, x: newX, y: newY };
          } else if (activeRedactDragHandle === "se") {
            const newW = Math.max(6, Math.min(100 - b.x, Math.round(initialW + deltaXPct)));
            const newH = Math.max(3, Math.min(100 - b.y, Math.round(initialH + deltaYPct)));
            return { ...b, w: newW, h: newH };
          }
          return b;
        })
      );
    };

    const handleMouseUp = () => {
      setActiveRedactDragHandle(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [activeRedactDragHandle]);

  const [isSearchingRedactMatches, setIsSearchingRedactMatches] = useState<boolean>(false);
  const [redactSearchMatchMsg, setRedactSearchMatchMsg] = useState<string | null>(null);

  const handleSearchAndRedactMatches = async (textToSearch?: string) => {
    const query = textToSearch !== undefined ? textToSearch : redactSearchText;
    if (!query || !query.trim() || files.length === 0 || !files[0]) return;

    setIsSearchingRedactMatches(true);
    setRedactSearchMatchMsg(null);
    try {
      const res = await searchPdfMatches(files[0], query);
      if (res && res.success && Array.isArray(res.matches)) {
        if (res.matches.length > 0) {
          setRedactBoxes((prev) => {
            const existingIds = new Set(prev.map((b) => b.id));
            const newBoxes: RedactBox[] = res.matches.map((m: any) => ({
              id: m.id || `redact-match-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              page: m.page,
              x: m.x,
              y: m.y,
              w: m.w,
              h: m.h,
              label: redactLabelText || undefined,
            }));
            const filteredNew = newBoxes.filter((b) => !existingIds.has(b.id));
            return [...prev, ...filteredNew];
          });
          const pagesCount = new Set(res.matches.map((m: any) => m.page)).size;
          setRedactSearchMatchMsg(`✓ Found & placed ${res.matches.length} redaction box(es) across ${pagesCount} page(s) for "${query}"!`);
        } else {
          setRedactSearchMatchMsg(`No occurrences of "${query}" found in document.`);
        }
      } else {
        setRedactSearchMatchMsg(`No occurrences of "${query}" found in document.`);
      }
    } catch (err) {
      console.warn("Search text error:", err);
    } finally {
      setIsSearchingRedactMatches(false);
    }
  };

  const addPlacedField = (type: "signature" | "initials" | "name" | "date" | "text" | "stamp") => {
    const id = `field-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    let w = 26;
    let h = 10;
    let dataUrl: string | undefined = undefined;
    let content: string | undefined = undefined;

    if (type === "signature") {
      w = 32;
      h = 12;
      dataUrl = sigDataUrl || generateSignatureImage(sigFullName, sigSelectedFontIndex, sigColor);
    } else if (type === "initials") {
      w = 18;
      h = 10;
      dataUrl = initialsDataUrl || generateSignatureImage(sigInitials, sigSelectedFontIndex, sigColor);
    } else if (type === "stamp") {
      w = 24;
      h = 24;
      dataUrl = companyStampDataUrl || undefined;
    } else if (type === "name") {
      w = 24;
      h = 7;
      content = sigFullName || profile?.display_name || user?.displayName || "Your Name";
    } else if (type === "date") {
      w = 22;
      h = 7;
      content = new Date().toLocaleDateString("en-GB");
    } else if (type === "text") {
      w = 26;
      h = 7;
      content = "Enter Text";
    }

    const newField: PlacedSignField = {
      id,
      type,
      page: sigPageNum,
      x: 35,
      y: 40 + (placedFields.filter((f) => f.page === sigPageNum).length * 8) % 40,
      w,
      h,
      dataUrl,
      content,
      color: sigColor,
    };

    setPlacedFields((prev) => [...prev, newField]);
    setActivePlacedFieldId(id);
  };

  const deletePlacedField = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setPlacedFields((prev) => prev.filter((f) => f.id !== id));
    if (activePlacedFieldId === id) {
      setActivePlacedFieldId(null);
    }
  };

  const duplicatePlacedField = (field: PlacedSignField, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newField: PlacedSignField = {
      ...field,
      id: `field-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      x: Math.min(70, field.x + 5),
      y: Math.min(80, field.y + 5),
    };
    setPlacedFields((prev) => [...prev, newField]);
    setActivePlacedFieldId(newField.id);
  };

  const changeFieldSize = (fieldId: string, scaleFactor: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPlacedFields((prev) =>
      prev.map((f) => {
        if (f.id !== fieldId) return f;
        const newW = Math.max(8, Math.min(85, Math.round(f.w * scaleFactor)));
        const newH = Math.max(4, Math.min(55, Math.round(f.h * scaleFactor)));
        const currentFontSize = f.fontSize || 14;
        const newFontSize = Math.max(8, Math.min(48, Math.round(currentFontSize * scaleFactor)));
        return {
          ...f,
          w: newW,
          h: newH,
          fontSize: newFontSize,
        };
      })
    );
  };

  const setFieldExactFontSize = (fieldId: string, fontSize: number) => {
    setPlacedFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, fontSize } : f))
    );
  };

  const setFieldColor = (fieldId: string, color: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPlacedFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, color } : f))
    );
  };

  const handleFieldMouseDown = (e: React.MouseEvent, field: PlacedSignField, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActivePlacedFieldId(field.id);

    fieldDragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: field.x,
      initialY: field.y,
      initialW: field.w,
      initialH: field.h,
      fieldId: field.id,
    };
    setActiveFieldDragHandle(handle);
  };

  useEffect(() => {
    if (!activeFieldDragHandle) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!sigContainerRef.current) return;
      const rect = sigContainerRef.current.getBoundingClientRect();
      const deltaXPct = ((e.clientX - fieldDragStartRef.current.startX) / rect.width) * 100;
      const deltaYPct = ((e.clientY - fieldDragStartRef.current.startY) / rect.height) * 100;
      const { initialX, initialY, initialW, initialH, fieldId } = fieldDragStartRef.current;

      setPlacedFields((prev) =>
        prev.map((f) => {
          if (f.id !== fieldId) return f;

          if (activeFieldDragHandle === "move") {
            const newX = Math.max(0, Math.min(100 - initialW, initialX + deltaXPct));
            const newY = Math.max(0, Math.min(100 - initialH, initialY + deltaYPct));
            return { ...f, x: Math.round(newX), y: Math.round(newY) };
          } else if (activeFieldDragHandle === "se") {
            const newW = Math.max(8, Math.min(100 - initialX, initialW + deltaXPct));
            const newH = Math.max(4, Math.min(100 - initialY, initialH + deltaYPct));
            return { ...f, w: Math.round(newW), h: Math.round(newH) };
          }
          return f;
        })
      );
    };

    const handleMouseUp = () => {
      setActiveFieldDragHandle(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [activeFieldDragHandle]);

  // Advanced Authentic Ink Drawing Engine: Fountain Pen (Chisel Nib), Ballpoint (Spline), Brush (Taper)
  const renderSignatureStrokes = (
    canvas: HTMLCanvasElement,
    strokeList: Array<{
      points: Array<{ x: number; y: number; time: number; pressure?: number }>;
      color: string;
      style: "fountain" | "ballpoint" | "brush";
      thickness: number;
    }>
  ) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    strokeList.forEach((stroke) => {
      const pts = stroke.points;
      if (pts.length === 0) return;

      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, Math.max(1, stroke.thickness / 2), 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      if (stroke.style === "fountain") {
        // Authentic Chisel Nib Calligraphy ribbon rendering (42-degree angle)
        const angle = (42 * Math.PI) / 180;
        const baseW = stroke.thickness;

        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i];
          const p2 = pts[i + 1];
          const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          const dt = Math.max(8, p2.time - p1.time);
          const velocity = dist / dt;
          const speedScale = Math.max(0.55, Math.min(1.45, 1.25 - velocity * 0.2));
          const w = Math.max(1.5, baseW * speedScale);

          const dx = Math.cos(angle) * (w / 2);
          const dy = -Math.sin(angle) * (w / 2);

          ctx.beginPath();
          ctx.moveTo(p1.x - dx, p1.y - dy);
          ctx.lineTo(p1.x + dx, p1.y + dy);
          ctx.lineTo(p2.x + dx, p2.y + dy);
          ctx.lineTo(p2.x - dx, p2.y - dy);
          ctx.closePath();
          ctx.fill();

          // Round junction cap
          ctx.beginPath();
          ctx.arc(p2.x, p2.y, w / 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (stroke.style === "ballpoint") {
        // Ultra-Smooth Rollerball spline
        ctx.lineWidth = stroke.thickness;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const midX = (pts[i].x + pts[i + 1].x) / 2;
          const midY = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
      } else {
        // Signature Brush: Organic pressure & start/end tapering
        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i];
          const p2 = pts[i + 1];
          const progress = i / Math.max(1, pts.length - 1);
          const taper = Math.sin(progress * Math.PI);
          const pressure = p2.pressure ?? 0.5;
          const width = Math.max(1, stroke.thickness * (0.35 + 0.7 * pressure + 0.45 * taper));

          ctx.lineWidth = width;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    });
  };

  const handleUpdatePenStyle = (style: "fountain" | "ballpoint" | "brush") => {
    setSigPenStyle(style);
    const updated = sigStrokes.map((s) => ({ ...s, style }));
    setSigStrokes(updated);
    const canvas = sigCanvasRef.current;
    if (canvas && updated.length > 0) {
      renderSignatureStrokes(canvas, updated);
      const trimmed = cropCanvasWhitespace(canvas);
      setDrawnSigDataUrl(trimmed);
      setSigDataUrl(trimmed);
      if (activePlacedFieldId) {
        setPlacedFields((prev) =>
          prev.map((f) => (f.id === activePlacedFieldId ? { ...f, dataUrl: trimmed } : f))
        );
      }
    }
  };

  const handleUpdatePenThickness = (thickness: number) => {
    setSigPenThickness(thickness);
    const updated = sigStrokes.map((s) => ({ ...s, thickness: thickness * 2 }));
    setSigStrokes(updated);
    const canvas = sigCanvasRef.current;
    if (canvas && updated.length > 0) {
      renderSignatureStrokes(canvas, updated);
      const trimmed = cropCanvasWhitespace(canvas);
      setDrawnSigDataUrl(trimmed);
      setSigDataUrl(trimmed);
      if (activePlacedFieldId) {
        setPlacedFields((prev) =>
          prev.map((f) => (f.id === activePlacedFieldId ? { ...f, dataUrl: trimmed } : f))
        );
      }
    }
  };

  const handleUpdateInkColor = (color: string) => {
    setSigColor(color);
    const updated = sigStrokes.map((s) => ({ ...s, color }));
    setSigStrokes(updated);
    const canvas = sigCanvasRef.current;
    if (canvas && updated.length > 0) {
      renderSignatureStrokes(canvas, updated);
      const trimmed = cropCanvasWhitespace(canvas);
      setDrawnSigDataUrl(trimmed);
      setSigDataUrl(trimmed);
      if (activePlacedFieldId) {
        setPlacedFields((prev) =>
          prev.map((f) => (f.id === activePlacedFieldId ? { ...f, dataUrl: trimmed, color } : f))
        );
      }
    } else {
      const newSig = generateSignatureImage(sigFullName, sigSelectedFontIndex, color);
      const newInit = generateSignatureImage(sigInitials, sigSelectedFontIndex, color);
      setSigDataUrl(newSig);
      setInitialsDataUrl(newInit);
      if (activePlacedFieldId) {
        setPlacedFields((prev) =>
          prev.map((f) => (f.id === activePlacedFieldId ? { ...f, dataUrl: newSig, color } : f))
        );
      }
    }
  };

  const cropCanvasWhitespace = (canvas: HTMLCanvasElement): string => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas.toDataURL("image/png");

    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    let minX = w, minY = h, maxX = 0, maxY = 0;
    let hasPixels = false;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const alpha = data[(y * w + x) * 4 + 3];
        if (alpha > 10) {
          hasPixels = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!hasPixels) return canvas.toDataURL("image/png");

    const padding = 16;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(w, maxX + padding);
    maxY = Math.min(h, maxY + padding);

    const cropW = Math.max(60, maxX - minX);
    const cropH = Math.max(25, maxY - minY);

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const cropCtx = cropCanvas.getContext("2d");
    if (!cropCtx) return canvas.toDataURL("image/png");

    cropCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
    return cropCanvas.toDataURL("image/png");
  };

  const startDrawingSig = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement> | React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const pressure = "pressure" in e && e.pressure ? e.pressure : 0.5;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const point = {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
      time: Date.now(),
      pressure,
    };

    setIsDrawingSig(true);
    currentStrokePointsRef.current = [point];
  };

  const drawSig = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement> | React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingSig) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const pressure = "pressure" in e && e.pressure ? e.pressure : 0.5;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const point = {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
      time: Date.now(),
      pressure,
    };

    currentStrokePointsRef.current.push(point);

    const tempStroke = {
      points: currentStrokePointsRef.current,
      color: sigColor,
      style: sigPenStyle,
      thickness: sigPenThickness * 2,
    };

    renderSignatureStrokes(canvas, [...sigStrokes, tempStroke]);
  };

  const stopDrawingSig = () => {
    if (!isDrawingSig) return;
    setIsDrawingSig(false);
    const canvas = sigCanvasRef.current;
    if (!canvas || currentStrokePointsRef.current.length === 0) return;

    const newStroke = {
      points: [...currentStrokePointsRef.current],
      color: sigColor,
      style: sigPenStyle,
      thickness: sigPenThickness * 2,
    };

    const nextStrokes = [...sigStrokes, newStroke];
    setSigStrokes(nextStrokes);
    setSigRedoStack([]);
    currentStrokePointsRef.current = [];

    renderSignatureStrokes(canvas, nextStrokes);
    const trimmedData = cropCanvasWhitespace(canvas);
    setDrawnSigDataUrl(trimmedData);
    setSigDataUrl(trimmedData);
    if (activePlacedFieldId) {
      setPlacedFields((prev) =>
        prev.map((f) => (f.id === activePlacedFieldId ? { ...f, dataUrl: trimmedData, color: sigColor } : f))
      );
    }
  };

  const undoSignatureStroke = () => {
    if (sigStrokes.length === 0) return;
    const last = sigStrokes[sigStrokes.length - 1];
    const nextStrokes = sigStrokes.slice(0, -1);
    setSigStrokes(nextStrokes);
    setSigRedoStack((prev) => [...prev, last]);

    const canvas = sigCanvasRef.current;
    if (canvas) {
      renderSignatureStrokes(canvas, nextStrokes);
      if (nextStrokes.length > 0) {
        const trimmedData = cropCanvasWhitespace(canvas);
        setDrawnSigDataUrl(trimmedData);
        setSigDataUrl(trimmedData);
        if (activePlacedFieldId) {
          setPlacedFields((prev) =>
            prev.map((f) => (f.id === activePlacedFieldId ? { ...f, dataUrl: trimmedData, color: sigColor } : f))
          );
        }
      } else {
        setDrawnSigDataUrl(null);
        const typedSig = generateSignatureImage(sigFullName, sigSelectedFontIndex, sigColor);
        setSigDataUrl(typedSig);
        if (activePlacedFieldId) {
          setPlacedFields((prev) =>
            prev.map((f) => (f.id === activePlacedFieldId ? { ...f, dataUrl: typedSig, color: sigColor } : f))
          );
        }
      }
    }
  };

  const redoSignatureStroke = () => {
    if (sigRedoStack.length === 0) return;
    const restored = sigRedoStack[sigRedoStack.length - 1];
    const nextRedo = sigRedoStack.slice(0, -1);
    const nextStrokes = [...sigStrokes, restored];
    setSigStrokes(nextStrokes);
    setSigRedoStack(nextRedo);

    const canvas = sigCanvasRef.current;
    if (canvas) {
      renderSignatureStrokes(canvas, nextStrokes);
      const trimmedData = cropCanvasWhitespace(canvas);
      setDrawnSigDataUrl(trimmedData);
      setSigDataUrl(trimmedData);
      if (activePlacedFieldId) {
        setPlacedFields((prev) =>
          prev.map((f) => (f.id === activePlacedFieldId ? { ...f, dataUrl: trimmedData, color: sigColor } : f))
        );
      }
    }
  };

  const clearSigCanvas = () => {
    const canvas = sigCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setSigStrokes([]);
    setSigRedoStack([]);
    setDrawnSigDataUrl(null);
    const typedSig = generateSignatureImage(sigFullName, sigSelectedFontIndex, sigColor);
    setSigDataUrl(typedSig);
    if (activePlacedFieldId) {
      setPlacedFields((prev) =>
        prev.map((f) => (f.id === activePlacedFieldId ? { ...f, dataUrl: typedSig, color: sigColor } : f))
      );
    }
  };

  const applySignatureModalConfig = () => {
    let newSig = sigDataUrl;
    let newInit = initialsDataUrl;

    if (sigCreationMode === "type") {
      newSig = generateSignatureImage(sigFullName, sigSelectedFontIndex, sigColor);
      newInit = generateSignatureImage(sigInitials, sigSelectedFontIndex, sigColor);
    } else if (sigCreationMode === "draw") {
      const canvas = sigCanvasRef.current;
      if (canvas) {
        newSig = canvas.toDataURL("image/png");
      }
    }

    setSigDataUrl(newSig);
    setInitialsDataUrl(newInit);

    // Update only currently active placed signature and initials field if selected
    if (activePlacedFieldId) {
      setPlacedFields((prev) =>
        prev.map((f) => {
          if (f.id === activePlacedFieldId && f.type === "signature" && newSig) {
            return { ...f, dataUrl: newSig, color: sigColor };
          }
          if (f.id === activePlacedFieldId && f.type === "initials" && newInit) {
            return { ...f, dataUrl: newInit, color: sigColor };
          }
          if (f.id === activePlacedFieldId && f.type === "name") {
            return { ...f, content: sigFullName, color: sigColor };
          }
          return f;
        })
      );
    }

    setIsSigConfigModalOpen(false);
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
      } else if (tool.id === "sign-pdf" && files[0]) {
        const fieldsToProcess = placedFields.length > 0 ? placedFields : [{
          id: "default-sig",
          type: "signature" as const,
          page: sigPageNum,
          x: 35,
          y: 75,
          w: 28,
          h: 12,
          dataUrl: sigDataUrl || generateSignatureImage(sigFullName, sigSelectedFontIndex, sigColor)
        }];
        clientRes = await clientSignPdf(files[0], fieldsToProcess, sigDataUrl || undefined);
      } else if (tool.id === "redact-pdf" && files[0]) {
        clientRes = await clientRedactPdf(files[0], redactBoxes, redactColor, redactWipeMetadata);
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
    } else if (tool.id === "redact-pdf") {
      formData.append("search_text", redactSearchText);
      formData.append("redact_rects_json", JSON.stringify(redactBoxes));
      formData.append("color", redactColor);
      formData.append("wipe_metadata", String(redactWipeMetadata));
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
    } else if (tool.id === "sign-pdf") {
      const fieldsToProcess = placedFields.length > 0 ? placedFields : [{
        id: "default-sig",
        type: "signature" as const,
        page: sigPageNum,
        x: 35,
        y: 75,
        w: 28,
        h: 12,
        dataUrl: sigDataUrl || generateSignatureImage(sigFullName, sigSelectedFontIndex, sigColor)
      }];
      formData.append("placed_fields_json", JSON.stringify(fieldsToProcess));
      formData.append("page", String(sigPageNum));
    } else if (tool.id === "compare-pdf") {
      if (files.length < 2) {
        setError("Please upload 2 PDF files to compare differences (Document 1: Original and Document 2: Modified).");
        setLoading(false);
        return;
      }
      formData.append("file_a", files[0]);
      formData.append("file_b", files[1]);
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
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 flex-wrap">
                            {tool.id === "compare-pdf" && (
                              <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md uppercase tracking-wider ${
                                i === 0 ? "bg-indigo-100 text-indigo-800 border border-indigo-200" : "bg-purple-100 text-purple-800 border border-purple-200"
                              }`}>
                                {i === 0 ? "📄 Document 1 (Original)" : "📄 Document 2 (Modified)"}
                              </span>
                            )}
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
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        title="Remove file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Compare PDF 2nd File Upload Callout */}
              {tool.id === "compare-pdf" && files.length === 1 && (
                <div
                  onClick={openFilePicker}
                  className="p-4 bg-indigo-50/70 hover:bg-indigo-50 border-2 border-dashed border-indigo-300 hover:border-indigo-500 rounded-2xl cursor-pointer transition flex items-center justify-between gap-3 text-indigo-900 shadow-2xs group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-purple-500/20">
                      02
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-extrabold text-slate-900 group-hover:text-indigo-600 transition">
                        Upload Document 2 (Modified / Revised PDF)
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Select the second PDF to compare differences side-by-side
                      </p>
                    </div>
                  </div>
                  <span className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-xs rounded-xl shadow-xs shrink-0">
                    + Choose File 2
                  </span>
                </div>
              )}

              {/* Prominent Add More Files Banner */}
              {tool.id !== "organize-pdf" && tool.id !== "compare-pdf" && (
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
            "resize-image", "crop-image", "convert-image", "add-page-numbers", "redact-pdf", "sign-pdf"
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

              {/* Full-Featured Sign PDF Studio (10 Signature Fonts & Advanced Placement Options) */}
              {tool.id === "sign-pdf" && (
                <div className="space-y-5 animate-in fade-in">
                  {/* Top Signing Options Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <Edit3 className="w-4 h-4 text-indigo-600" />
                        <span>Sign PDF Studio</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Type your name to choose from 10 signature styles, or draw/upload, then place anywhere on the document.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSigSigningMode("simple")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                          sigSigningMode === "simple"
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                            : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <PenTool className="w-3.5 h-3.5" />
                        <span>Simple Signature</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSigSigningMode("digital")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                          sigSigningMode === "digital"
                            ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/20"
                            : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <Award className="w-3.5 h-3.5 text-amber-500" />
                        <span>Digital Signature</span>
                        <Crown className="w-3 h-3 text-amber-400 fill-amber-400" />
                      </button>
                    </div>
                  </div>

                  {/* Section 1: Signature Generator (Type Name, Draw Pad, and 10 Font Styles) */}
                  <div className="p-4 bg-gradient-to-br from-slate-50 to-indigo-50/30 rounded-2xl border border-indigo-100/80 shadow-xs space-y-3.5">
                    {/* Top Mode Selector Tabs + Ink Color Picker */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Creation Mode Tabs */}
                      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setSigCreationMode("type")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                            sigCreationMode === "type"
                              ? "bg-white text-indigo-700 shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          <Type className="w-3.5 h-3.5" />
                          <span>Type Name</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSigCreationMode("draw")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                            sigCreationMode === "draw"
                              ? "bg-white text-indigo-700 shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          <PenTool className="w-3.5 h-3.5" />
                          <span>Draw Pad</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSigCreationMode("upload")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                            sigCreationMode === "upload"
                              ? "bg-white text-indigo-700 shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>Upload</span>
                        </button>
                      </div>

                      {/* Ink Color Selector */}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-500">Ink Color:</span>
                        {[
                          { hex: "#0f172a", label: "Ink Black" },
                          { hex: "#1e3a8a", label: "Navy Blue" },
                          { hex: "#2563eb", label: "Royal Blue" },
                          { hex: "#dc2626", label: "Classic Red" },
                          { hex: "#16a34a", label: "Forest Green" },
                        ].map((c) => (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => handleUpdateInkColor(c.hex)}
                            className={`w-4 h-4 rounded-full transition cursor-pointer ${
                              sigColor === c.hex
                                ? "ring-2 ring-indigo-600 ring-offset-1 scale-110"
                                : "opacity-75 hover:opacity-100"
                            }`}
                            style={{ backgroundColor: c.hex }}
                            title={c.label}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Mode 1: Type Name Inputs */}
                    {sigCreationMode === "type" && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 animate-in fade-in">
                        <div className="sm:col-span-2 relative">
                          <input
                            type="text"
                            value={sigFullName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSigFullName(val);
                              const newSig = generateSignatureImage(val, sigSelectedFontIndex, sigColor);
                              setSigDataUrl(newSig);
                              setPlacedFields((prev) =>
                                prev.map((f) => (f.type === "signature" ? { ...f, dataUrl: newSig } : f.type === "name" ? { ...f, content: val } : f))
                              );
                            }}
                            placeholder="Type your full name (e.g. John Doe)..."
                            className="w-full pl-3 pr-24 py-2.5 bg-white border-2 border-indigo-200 focus:border-indigo-600 rounded-xl text-sm font-bold text-slate-900 outline-hidden shadow-xs"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-indigo-600">
                            Live Preview
                          </span>
                        </div>

                        <div>
                          <input
                            type="text"
                            value={sigInitials}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSigInitials(val);
                              const newInit = generateSignatureImage(val, sigSelectedFontIndex, sigColor);
                              setInitialsDataUrl(newInit);
                              setPlacedFields((prev) =>
                                prev.map((f) => (f.type === "initials" ? { ...f, dataUrl: newInit } : f))
                              );
                            }}
                            placeholder="Initials (e.g. SM)"
                            className="w-full px-3 py-2.5 bg-white border border-slate-200 focus:border-indigo-600 rounded-xl text-sm font-bold text-slate-900 outline-hidden"
                          />
                        </div>
                      </div>
                    )}

                    {/* Mode 2: Interactive High-Precision Calligraphy Draw Pad */}
                    {sigCreationMode === "draw" && (
                      <div className="space-y-2.5 animate-in fade-in">
                        {/* Top Toolbar: Pen Style + Thickness + Undo / Redo / Clear */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          {/* Pen Style Presets */}
                          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                            {[
                              { id: "fountain", label: "🖋️ Fountain Pen" },
                              { id: "ballpoint", label: "🖊️ Ballpoint" },
                              { id: "brush", label: "🖌️ Brush" },
                            ].map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => handleUpdatePenStyle(p.id as any)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                                  sigPenStyle === p.id
                                    ? "bg-indigo-600 text-white shadow-2xs"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                }`}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>

                          {/* Thickness Presets */}
                          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                            <span className="text-[10px] font-bold text-slate-400 px-1">Width:</span>
                            {[
                              { val: 1.5, label: "Fine" },
                              { val: 2.5, label: "Med" },
                              { val: 4, label: "Thick" },
                            ].map((t) => (
                              <button
                                key={t.val}
                                type="button"
                                onClick={() => handleUpdatePenThickness(t.val)}
                                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition cursor-pointer ${
                                  sigPenThickness === t.val
                                    ? "bg-indigo-100 text-indigo-700 font-extrabold"
                                    : "text-slate-500 hover:text-slate-800"
                                }`}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>

                          {/* Action Buttons: Undo, Redo, Clear */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={undoSignatureStroke}
                              disabled={sigStrokes.length === 0}
                              className="px-2 py-1 bg-white text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold disabled:opacity-35 disabled:cursor-not-allowed hover:bg-slate-50 transition cursor-pointer shadow-2xs"
                              title="Undo last stroke (Ctrl+Z)"
                            >
                              ↩ Undo
                            </button>

                            <button
                              type="button"
                              onClick={redoSignatureStroke}
                              disabled={sigRedoStack.length === 0}
                              className="px-2 py-1 bg-white text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold disabled:opacity-35 disabled:cursor-not-allowed hover:bg-slate-50 transition cursor-pointer shadow-2xs"
                              title="Redo stroke"
                            >
                              ↪ Redo
                            </button>

                            <button
                              type="button"
                              onClick={clearSigCanvas}
                              className="px-2.5 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer border border-transparent hover:border-red-200"
                            >
                              🗑️ Clear
                            </button>
                          </div>
                        </div>

                        {/* Interactive Smooth Canvas with Baseline Guide */}
                        <div className="relative w-full h-36 bg-white rounded-2xl border-2 border-dashed border-indigo-300 overflow-hidden touch-none cursor-crosshair shadow-inner flex items-center justify-center">
                          {/* Subtle Signature Baseline */}
                          <div className="absolute left-8 right-8 bottom-7 border-b border-dashed border-indigo-200/80 pointer-events-none flex justify-between">
                            <span className="text-[9px] font-bold text-indigo-300 -translate-y-3">Sign on line ✕</span>
                          </div>

                          <canvas
                            ref={sigCanvasRef}
                            width={800}
                            height={180}
                            onPointerDown={startDrawingSig}
                            onPointerMove={drawSig}
                            onPointerUp={stopDrawingSig}
                            onPointerLeave={stopDrawingSig}
                            className="w-full h-full relative z-10"
                          />

                          {!drawnSigDataUrl && !isDrawingSig && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 text-xs font-semibold">
                              ✍️ Draw your signature here using mouse, trackpad, or stylus
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Mode 3: Image Upload */}
                    {sigCreationMode === "upload" && (
                      <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center bg-white relative cursor-pointer animate-in fade-in">
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/webp"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                if (ev.target?.result) {
                                  const data = ev.target.result as string;
                                  setDrawnSigDataUrl(data);
                                  setSigDataUrl(data);
                                  setPlacedFields((prev) =>
                                    prev.map((f) => (f.type === "signature" ? { ...f, dataUrl: data } : f))
                                  );
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <UploadCloud className="w-6 h-6 mx-auto text-indigo-500 mb-1" />
                        <p className="text-xs font-bold text-slate-700">Upload signature file (PNG/JPG)</p>
                        <p className="text-[10px] text-slate-400">Transparent PNG recommended</p>
                      </div>
                    )}

                    {/* 10 Signature Fonts Showcase Grid (Works for both Drawing and Typing!) */}
                    <div className="space-y-1.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-700 block">
                          Change Signature Style Anytime (Click any font or your drawing):
                        </span>
                        <div className="flex items-center gap-1.5">
                          <label className="text-[10px] font-bold text-slate-500">Signer Name:</label>
                          <input
                            type="text"
                            value={sigFullName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSigFullName(val);
                              const newSig = generateSignatureImage(val, sigSelectedFontIndex, sigColor);
                              if (!drawnSigDataUrl || sigDataUrl !== drawnSigDataUrl) {
                                setSigDataUrl(newSig);
                                setPlacedFields((prev) =>
                                  prev.map((f) => (f.type === "signature" ? { ...f, dataUrl: newSig } : f.type === "name" ? { ...f, content: val } : f))
                                );
                              }
                            }}
                            placeholder="Type Name..."
                            className="px-2.5 py-1 bg-white border border-indigo-200 focus:border-indigo-600 rounded-lg text-xs font-bold text-slate-800 outline-hidden w-32 sm:w-40 shadow-2xs"
                          />
                          {drawnSigDataUrl && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 whitespace-nowrap">
                              ✓ Drawing Saved
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 max-h-56 overflow-y-auto p-1 scrollbar-thin">
                        {/* If user has drawn a signature, show the "My Hand Drawing" card as well! */}
                        {drawnSigDataUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setSigDataUrl(drawnSigDataUrl);
                              if (activePlacedFieldId) {
                                setPlacedFields((prev) =>
                                  prev.map((field) =>
                                    field.id === activePlacedFieldId ? { ...field, dataUrl: drawnSigDataUrl } : field
                                  )
                                );
                              }
                            }}
                            className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col justify-between h-20 group ${
                              sigDataUrl === drawnSigDataUrl
                                ? "bg-white border-indigo-600 ring-2 ring-indigo-600/30 shadow-md scale-102"
                                : "bg-white/80 border-slate-200 hover:border-indigo-300 hover:bg-white"
                            }`}
                          >
                            <div className="h-10 w-full flex items-center justify-center">
                              <img src={drawnSigDataUrl} alt="My Drawing" className="max-h-9 w-auto object-contain" />
                            </div>
                            <span className={`text-[10px] font-bold block truncate mt-0.5 ${sigDataUrl === drawnSigDataUrl ? "text-indigo-700" : "text-slate-500"}`}>
                              ✍️ My Hand Drawing
                            </span>
                          </button>
                        )}

                        {/* All 10 Signature Fonts */}
                        {signatureFonts.map((f, idx) => {
                          const isSelected = sigSelectedFontIndex === idx && sigDataUrl !== drawnSigDataUrl;
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => {
                                setSigSelectedFontIndex(idx);
                                const newSig = generateSignatureImage(sigFullName, idx, sigColor);
                                const newInit = generateSignatureImage(sigInitials, idx, sigColor);
                                setSigDataUrl(newSig);
                                setInitialsDataUrl(newInit);
                                if (activePlacedFieldId) {
                                  setPlacedFields((prev) =>
                                    prev.map((field) =>
                                      field.id === activePlacedFieldId
                                        ? { ...field, dataUrl: field.type === "initials" ? newInit : newSig, color: sigColor }
                                        : field
                                    )
                                  );
                                }
                              }}
                              className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col justify-between h-20 group ${
                                isSelected
                                  ? "bg-white border-indigo-600 ring-2 ring-indigo-600/30 shadow-md scale-102"
                                  : "bg-white/80 border-slate-200 hover:border-indigo-300 hover:bg-white"
                              }`}
                            >
                              <div
                                className="text-base truncate px-1"
                                style={{
                                  fontFamily: f.style,
                                  color: isSelected ? sigColor : "#334155",
                                }}
                              >
                                {sigFullName || "Signature"}
                              </div>
                              <span className={`text-[10px] font-semibold block truncate mt-1 ${isSelected ? "text-indigo-700 font-bold" : "text-slate-400"}`}>
                                {f.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Where to Place & Multi-Page Presets */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Move className="w-3.5 h-3.5 text-indigo-600" />
                        <span>2. Where & How to Place Signature:</span>
                      </span>

                      {/* Multi-Page Placement Actions */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => applyPlacementPreset("bottom-right")}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold transition cursor-pointer shadow-xs"
                          title="Place signature on the current viewing page"
                        >
                          ✍️ Place on Page {sigPageNum}
                        </button>
                        <button
                          type="button"
                          onClick={copySignaturesToLastPage}
                          className="px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold transition cursor-pointer shadow-2xs"
                          title="Place signature on the last page of document"
                        >
                          📜 Sign Last Page (Contracts)
                        </button>
                        <button
                          type="button"
                          onClick={copySignaturesToAllPages}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition cursor-pointer shadow-xs"
                          title="Stamp this signature onto every page in PDF"
                        >
                          📑 Sign ALL {sigThumbnails.length || ""} Pages
                        </button>
                      </div>
                    </div>

                    {/* Quick Position Presets Buttons */}
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5">
                      {[
                        { id: "bottom-right", label: "Bottom-Right (Standard Sign)" },
                        { id: "bottom-left", label: "Bottom-Left" },
                        { id: "bottom-center", label: "Bottom-Center" },
                        { id: "top-right", label: "Top-Right" },
                        { id: "top-left", label: "Top-Left" },
                        { id: "center", label: "Center Page" },
                      ].map((pos) => (
                        <button
                          key={pos.id}
                          type="button"
                          onClick={() => applyPlacementPreset(pos.id as any)}
                          className="px-2 py-1.5 bg-white hover:bg-indigo-600 hover:text-white text-slate-700 border border-slate-200 rounded-xl text-[10px] font-bold transition cursor-pointer text-center truncate shadow-2xs"
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Section 3: Interactive Visual Studio (Thumbnails + Canvas + Palette) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Left Sidebar: Multi-Page Thumbnails */}
                    {sigThumbnails.length > 0 && (
                      <div className="lg:col-span-2 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto max-h-[520px] p-2 bg-slate-50 rounded-2xl border border-slate-200 scrollbar-thin">
                        <div className="hidden lg:flex items-center justify-between px-1 mb-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            Pages ({sigThumbnails.length})
                          </span>
                          <span className="text-[9px] text-slate-400">Click to switch</span>
                        </div>
                        {sigThumbnails.map((t) => {
                          const pageFieldsCount = placedFields.filter((f) => f.page === t.page_num).length;
                          const isActive = sigPageNum === t.page_num;
                          return (
                            <button
                              key={t.page_num}
                              type="button"
                              onClick={() => handleSwitchSigPage(t.page_num)}
                              className={`shrink-0 relative rounded-xl border transition cursor-pointer p-1 group text-left ${
                                isActive
                                  ? "border-indigo-600 ring-3 ring-indigo-600/30 bg-white shadow-md scale-102"
                                  : pageFieldsCount > 0
                                  ? "border-emerald-300 bg-emerald-50/40 hover:border-emerald-400"
                                  : "border-slate-200 hover:border-slate-300 bg-white opacity-80 hover:opacity-100"
                              }`}
                            >
                              <div className="w-16 h-22 lg:w-full lg:h-28 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center relative">
                                <img src={t.thumbnail} alt={`Page ${t.page_num}`} className="w-full h-full object-contain pointer-events-none" />
                                {pageFieldsCount > 0 && (
                                  <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[9px] font-bold shadow-xs flex items-center gap-0.5">
                                    ✓ {pageFieldsCount}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center justify-between text-[10px] font-bold mt-1 px-0.5">
                                <span className={isActive ? "text-indigo-600 font-extrabold" : pageFieldsCount > 0 ? "text-emerald-700" : "text-slate-700"}>
                                  Page {t.page_num}
                                </span>
                                {isActive && (
                                  <span className="text-[9px] text-indigo-600 font-bold">Active</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Center Document Placement Canvas */}
                    <div className={`${sigThumbnails.length > 0 ? "lg:col-span-6" : "lg:col-span-8"} space-y-2.5`}>
                      {/* Ultra-Clean Document Navigation Toolbar */}
                      <div className="flex items-center justify-between px-3 py-2 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xs gap-2">
                        {/* Left: Compact Page Stepper */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={sigPageNum <= 1}
                            onClick={() => handleSwitchSigPage(sigPageNum - 1)}
                            className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                            title="Previous Page"
                          >
                            ←
                          </button>

                          <div className="flex items-center gap-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800">
                            <span>Page</span>
                            <select
                              value={sigPageNum}
                              onChange={(e) => handleSwitchSigPage(Number(e.target.value))}
                              className="bg-transparent font-bold text-indigo-600 outline-hidden cursor-pointer"
                            >
                              {sigThumbnails.map((t) => (
                                <option key={t.page_num} value={t.page_num}>
                                  {t.page_num}
                                </option>
                              ))}
                            </select>
                            <span className="text-slate-400 font-normal">/ {sigThumbnails.length || 1}</span>
                          </div>

                          <button
                            type="button"
                            disabled={sigPageNum >= sigThumbnails.length}
                            onClick={() => handleSwitchSigPage(sigPageNum + 1)}
                            className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                            title="Next Page"
                          >
                            →
                          </button>
                        </div>

                        {/* Right: Page Status & Clear Button */}
                        <div className="flex items-center gap-2">
                          {placedFields.filter((f) => f.page === sigPageNum).length > 0 ? (
                            <div className="flex items-center gap-1.5">
                              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                ✓ {placedFields.filter((f) => f.page === sigPageNum).length} Placed
                              </span>
                              <button
                                type="button"
                                onClick={() => setPlacedFields((prev) => prev.filter((f) => f.page !== sigPageNum))}
                                className="px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer border border-transparent hover:border-red-200 flex items-center gap-1"
                                title="Remove fields from this page"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Clear</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                              No signatures on this page
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        ref={sigContainerRef}
                        className="relative w-full bg-slate-900/90 rounded-2xl overflow-hidden shadow-inner border border-slate-300 select-none flex items-center justify-center min-h-[420px] max-h-[520px]"
                      >
                        {sigPreviewUrl ? (
                          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                            {/* Document Page Image */}
                            <img
                              src={sigPreviewUrl}
                              alt={`Sign Page ${sigPageNum}`}
                              className="max-h-[480px] w-auto object-contain pointer-events-none"
                            />

                            {/* Render All Placed Fields for Current Page */}
                            {placedFields
                              .filter((f) => f.page === sigPageNum)
                              .map((field) => {
                                const isSelected = activePlacedFieldId === field.id;
                                return (
                                  <div
                                    key={field.id}
                                    style={{
                                      left: `${field.x}%`,
                                      top: `${field.y}%`,
                                      width: `${field.w}%`,
                                      height: `${field.h}%`,
                                    }}
                                    onMouseDown={(e) => handleFieldMouseDown(e, field, "move")}
                                    className={`absolute rounded-md cursor-move pointer-events-auto select-none flex items-center justify-center transition-shadow group/placed ${
                                      isSelected
                                        ? "border-2 border-indigo-600 bg-indigo-50/80 shadow-lg ring-2 ring-indigo-500/20"
                                        : "border border-indigo-400/80 bg-white/70 hover:border-indigo-600 hover:bg-indigo-50/50"
                                    }`}
                                  >
                                    {/* Action Buttons Top Header (Size Controls + Duplicate + Delete) */}
                                    {isSelected && (
                                      <div className="absolute -top-8 left-0 flex items-center gap-1 bg-slate-900 text-white rounded-lg px-2 py-1 text-[10px] font-bold shadow-xl z-30 pointer-events-auto whitespace-nowrap">
                                        <button
                                          type="button"
                                          onClick={(e) => changeFieldSize(field.id, 0.85, e)}
                                          className="hover:text-indigo-300 px-1 py-0.5 rounded-sm hover:bg-slate-800 cursor-pointer font-bold"
                                          title="Shrink Size (A-)"
                                        >
                                          A-
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => changeFieldSize(field.id, 1.2, e)}
                                          className="hover:text-indigo-300 px-1 py-0.5 rounded-sm hover:bg-slate-800 cursor-pointer font-bold"
                                          title="Enlarge Size (A+)"
                                        >
                                          A+
                                        </button>
                                        <div className="h-3 w-px bg-slate-700 mx-0.5" />
                                        <button
                                          type="button"
                                          onClick={(e) => duplicatePlacedField(field, e)}
                                          className="hover:text-indigo-300 p-0.5 cursor-pointer"
                                          title="Duplicate field"
                                        >
                                          <Copy className="w-3 h-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => deletePlacedField(field.id, e)}
                                          className="hover:text-red-400 p-0.5 cursor-pointer ml-0.5"
                                          title="Remove field"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )}

                                    {/* Field Content Rendering with Dynamic Font Size */}
                                    {field.dataUrl ? (
                                      <img
                                        src={field.dataUrl}
                                        alt={field.type}
                                        className="w-full h-full object-contain p-1 pointer-events-none"
                                      />
                                    ) : (
                                      <input
                                        type="text"
                                        value={field.content || ""}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setPlacedFields((prev) =>
                                            prev.map((f) => (f.id === field.id ? { ...f, content: val } : f))
                                          );
                                        }}
                                        style={{
                                          color: field.color || "#0f172a",
                                          fontSize: field.fontSize ? `${field.fontSize}px` : "12px",
                                        }}
                                        className="w-full h-full text-center bg-transparent font-bold outline-hidden px-1 border-none"
                                      />
                                    )}

                                    {/* Resize Corner Handle */}
                                    {isSelected && (
                                      <div
                                        onMouseDown={(e) => handleFieldMouseDown(e, field, "se")}
                                        className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-indigo-600 border-2 border-white rounded-full shadow-md cursor-se-resize hover:scale-125 transition-transform"
                                        title="Drag corner to resize"
                                      />
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        ) : (
                          <div className="text-center p-8 text-white/70 space-y-2">
                            <FileText className="w-10 h-10 mx-auto text-indigo-400 opacity-80" />
                            <p className="text-xs font-bold">Document Loaded</p>
                            <p className="text-[11px] text-white/50">{placedFields.length} field(s) placed</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Sidebar: Required & Optional Fields Palette + Selected Field Customizer */}
                    <div className={`${sigThumbnails.length > 0 ? "lg:col-span-4" : "lg:col-span-4"} space-y-3.5`}>
                      {/* Active Selected Field Properties Editor */}
                      {activePlacedFieldId && placedFields.some((f) => f.id === activePlacedFieldId) && (
                        <div className="p-3.5 bg-indigo-50/80 rounded-2xl border-2 border-indigo-200 shadow-xs space-y-3 animate-in fade-in">
                          {(() => {
                            const field = placedFields.find((f) => f.id === activePlacedFieldId)!;
                            return (
                              <>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-indigo-900 capitalize flex items-center gap-1.5">
                                    <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Resize & Edit {field.type}</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => deletePlacedField(field.id)}
                                    className="text-[10px] font-bold text-red-600 hover:bg-red-100 px-1.5 py-0.5 rounded cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                </div>

                                {/* Text content edit if applicable */}
                                {!field.dataUrl && (
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Text Content:</label>
                                    <input
                                      type="text"
                                      value={field.content || ""}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setPlacedFields((prev) =>
                                          prev.map((f) => (f.id === field.id ? { ...f, content: val } : f))
                                        );
                                      }}
                                      className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-slate-800 outline-hidden"
                                    />
                                  </div>
                                )}

                                {/* Size / Scale Presets */}
                                <div className="space-y-1">
                                  <label className="block text-[10px] font-bold text-slate-600">Quick Size Presets:</label>
                                  <div className="grid grid-cols-4 gap-1">
                                    {[
                                      { label: "Small", scale: 0.75 },
                                      { label: "Normal", scale: 1.0 },
                                      { label: "Large", scale: 1.35 },
                                      { label: "XL", scale: 1.75 },
                                    ].map((s) => (
                                      <button
                                        key={s.label}
                                        type="button"
                                        onClick={() => {
                                          // Set preset dimensions based on base type
                                          let baseW = field.type === "signature" ? 32 : field.type === "initials" ? 18 : 24;
                                          let baseH = field.type === "signature" ? 12 : field.type === "initials" ? 10 : 7;
                                          let baseFont = 14;
                                          setPlacedFields((prev) =>
                                            prev.map((f) =>
                                              f.id === field.id
                                                ? {
                                                    ...f,
                                                    w: Math.round(baseW * s.scale),
                                                    h: Math.round(baseH * s.scale),
                                                    fontSize: Math.round(baseFont * s.scale),
                                                  }
                                                : f
                                            )
                                          );
                                        }}
                                        className="px-2 py-1 bg-white hover:bg-indigo-600 hover:text-white text-slate-700 border border-indigo-200 rounded-lg text-[10px] font-bold transition cursor-pointer text-center"
                                      >
                                        {s.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {/* Direct Font Size / Scale Stepper */}
                                <div className="flex items-center justify-between text-xs pt-1 border-t border-indigo-100">
                                  <span className="text-[11px] font-bold text-slate-700">Adjust Size:</span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={(e) => changeFieldSize(field.id, 0.85, e)}
                                      className="px-2.5 py-1 bg-white text-indigo-700 border border-indigo-200 rounded-lg text-xs font-extrabold hover:bg-indigo-50 transition cursor-pointer shadow-2xs"
                                    >
                                      - A Smaller
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => changeFieldSize(field.id, 1.2, e)}
                                      className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-extrabold hover:bg-indigo-700 transition cursor-pointer shadow-xs"
                                    >
                                      + A Bigger
                                    </button>
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}

                      {/* Required Fields Section */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Required Fields
                        </span>

                        {/* Signature Field Card */}
                        <div className="p-3 bg-white rounded-2xl border-2 border-indigo-100 hover:border-indigo-300 shadow-xs space-y-2 transition">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                              <span className="w-5 h-5 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                <PenTool className="w-3 h-3" />
                              </span>
                              <span>Signature ({sigFullName})</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setSigModalTab("signature");
                                setIsSigConfigModalOpen(true);
                              }}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                              title="Customize Signature Details"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div
                            onClick={() => addPlacedField("signature")}
                            className="p-2 bg-slate-50 hover:bg-indigo-50/50 rounded-xl border border-dashed border-slate-300 hover:border-indigo-400 transition cursor-pointer flex items-center justify-center min-h-[54px] group"
                            title="Click to place signature on page"
                          >
                            {sigDataUrl ? (
                              <img src={sigDataUrl} alt="Signature Preview" className="max-h-12 w-auto object-contain" />
                            ) : (
                              <span className="text-xs font-bold text-slate-400 group-hover:text-indigo-600">
                                + Place Signature
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Optional Fields Section */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Optional Fields (Click + Add then resize)
                        </span>

                        {/* Initials Card */}
                        <div className="p-2.5 bg-white rounded-2xl border border-slate-200 hover:border-indigo-200 shadow-xs space-y-1.5 transition">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                              <span className="w-5 h-5 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-[10px]">
                                AC
                              </span>
                              <span>Initials ({sigInitials})</span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setSigModalTab("initials");
                                  setIsSigConfigModalOpen(true);
                                }}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                title="Customize Initials"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => addPlacedField("initials")}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 font-bold text-[11px] rounded-lg transition cursor-pointer"
                              >
                                + Add
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Name Field Card */}
                        <div className="p-2.5 bg-white rounded-2xl border border-slate-200 hover:border-indigo-200 shadow-xs flex items-center justify-between transition">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                            <span className="w-5 h-5 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                              <User className="w-3 h-3" />
                            </span>
                            <span>Name ({sigFullName})</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => addPlacedField("name")}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 font-bold text-[11px] rounded-lg transition cursor-pointer"
                          >
                            + Add
                          </button>
                        </div>

                        {/* Date Field Card */}
                        <div className="p-2.5 bg-white rounded-2xl border border-slate-200 hover:border-indigo-200 shadow-xs flex items-center justify-between transition">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                            <span className="w-5 h-5 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                              <Calendar className="w-3 h-3" />
                            </span>
                            <span>Date ({new Date().toLocaleDateString("en-GB")})</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => addPlacedField("date")}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 font-bold text-[11px] rounded-lg transition cursor-pointer"
                          >
                            + Add
                          </button>
                        </div>

                        {/* Custom Text Field Card */}
                        <div className="p-2.5 bg-white rounded-2xl border border-slate-200 hover:border-indigo-200 shadow-xs flex items-center justify-between transition">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                            <span className="w-5 h-5 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                              <Type className="w-3 h-3" />
                            </span>
                            <span>Custom Text</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => addPlacedField("text")}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 font-bold text-[11px] rounded-lg transition cursor-pointer"
                          >
                            + Add
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* "Set Your Signature Details" Modal Dialog */}
                  {isSigConfigModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
                      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95">
                        {/* Modal Header */}
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-900">Set your signature details</h4>
                          <button
                            type="button"
                            onClick={() => setIsSigConfigModalOpen(false)}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Full Name & Initials Inputs */}
                        <div className="p-4 space-y-4">
                          <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-2">
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">Full name:</label>
                              <input
                                type="text"
                                value={sigFullName}
                                onChange={(e) => setSigFullName(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-hidden"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">Initials:</label>
                              <input
                                type="text"
                                value={sigInitials}
                                onChange={(e) => setSigInitials(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-hidden"
                              />
                            </div>
                          </div>

                          {/* Signature vs Initials vs Company Stamp Tabs */}
                          <div className="flex items-center border-b border-slate-200 gap-4 text-xs font-bold">
                            <button
                              type="button"
                              onClick={() => setSigModalTab("signature")}
                              className={`pb-2 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                                sigModalTab === "signature"
                                  ? "border-red-600 text-red-600"
                                  : "border-transparent text-slate-500 hover:text-slate-900"
                              }`}
                            >
                              <PenTool className="w-3.5 h-3.5" />
                              <span>Signature</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setSigModalTab("initials")}
                              className={`pb-2 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                                sigModalTab === "initials"
                                  ? "border-red-600 text-red-600"
                                  : "border-transparent text-slate-500 hover:text-slate-900"
                              }`}
                            >
                              <span>AC Initials</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setSigModalTab("stamp")}
                              className={`pb-2 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                                sigModalTab === "stamp"
                                  ? "border-red-600 text-red-600"
                                  : "border-transparent text-slate-500 hover:text-slate-900"
                              }`}
                            >
                              <span>🏛️ Company Stamp</span>
                            </button>
                          </div>

                          {/* Left Mode Selector (Type / Draw / Upload) + Right Style Options */}
                          <div className="grid grid-cols-12 gap-3">
                            {/* Left Creation Mode Icons */}
                            <div className="col-span-2 flex flex-col gap-1.5 p-1 bg-slate-100 rounded-xl items-center">
                              <button
                                type="button"
                                onClick={() => setSigCreationMode("type")}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer ${
                                  sigCreationMode === "type" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-900"
                                }`}
                                title="Type Name"
                              >
                                <Type className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setSigCreationMode("draw")}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer ${
                                  sigCreationMode === "draw" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-900"
                                }`}
                                title="Draw Signature"
                              >
                                <PenTool className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setSigCreationMode("upload")}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer ${
                                  sigCreationMode === "upload" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-900"
                                }`}
                                title="Upload File"
                              >
                                <UploadCloud className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Right Mode Workspace */}
                            <div className="col-span-10 space-y-3">
                              {/* Type Mode: 10 Cursive Font Choices with Radio Selector */}
                              {sigCreationMode === "type" && (
                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                  {signatureFonts.map((f, idx) => (
                                    <label
                                      key={idx}
                                      onClick={() => setSigSelectedFontIndex(idx)}
                                      className={`flex items-center gap-3 p-2 rounded-xl border transition cursor-pointer ${
                                        sigSelectedFontIndex === idx
                                          ? "border-red-500 bg-red-50/40 ring-1 ring-red-500/30"
                                          : "border-slate-200 hover:bg-slate-50"
                                      }`}
                                    >
                                      <input
                                        type="radio"
                                        name="sigFontChoice"
                                        checked={sigSelectedFontIndex === idx}
                                        onChange={() => setSigSelectedFontIndex(idx)}
                                        className="text-red-600 focus:ring-red-500"
                                      />
                                      <span
                                        className="text-lg font-normal truncate"
                                        style={{
                                          fontFamily: f.style,
                                          color: sigColor,
                                        }}
                                      >
                                        {sigModalTab === "initials"
                                          ? sigInitials || "SM"
                                          : sigFullName || "Signature"}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              )}

                              {/* Draw Mode: Canvas Pad */}
                              {sigCreationMode === "draw" && (
                                <div className="space-y-1.5">
                                  <div className="flex justify-between items-center text-[11px] text-slate-500">
                                    <span>Draw below:</span>
                                    <button
                                      type="button"
                                      onClick={clearSigCanvas}
                                      className="text-red-600 font-bold hover:underline cursor-pointer"
                                    >
                                      Clear
                                    </button>
                                  </div>
                                  <div className="w-full h-32 bg-slate-50 rounded-xl border border-slate-300 overflow-hidden cursor-crosshair">
                                    <canvas
                                      ref={sigCanvasRef}
                                      width={400}
                                      height={128}
                                      onMouseDown={startDrawingSig}
                                      onMouseMove={drawSig}
                                      onMouseUp={stopDrawingSig}
                                      onMouseLeave={stopDrawingSig}
                                      onTouchStart={startDrawingSig}
                                      onTouchMove={drawSig}
                                      onTouchEnd={stopDrawingSig}
                                      className="w-full h-full"
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Upload Mode: File Input */}
                              {sigCreationMode === "upload" && (
                                <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center bg-slate-50 relative cursor-pointer">
                                  <input
                                    type="file"
                                    accept="image/png, image/jpeg, image/webp"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        const reader = new FileReader();
                                        reader.onload = (ev) => {
                                          if (ev.target?.result) {
                                            if (sigModalTab === "initials") {
                                              setInitialsDataUrl(ev.target.result as string);
                                            } else if (sigModalTab === "stamp") {
                                              setCompanyStampDataUrl(ev.target.result as string);
                                            } else {
                                              setSigDataUrl(ev.target.result as string);
                                            }
                                          }
                                        };
                                        reader.readAsDataURL(file);
                                      }
                                    }}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  />
                                  <UploadCloud className="w-6 h-6 mx-auto text-indigo-500 mb-1" />
                                  <p className="text-xs font-bold text-slate-700">Upload signature file</p>
                                  <p className="text-[10px] text-slate-400">PNG with transparent background</p>
                                </div>
                              )}

                              {/* Ink Color Selector */}
                              <div className="flex items-center gap-2 pt-1">
                                <span className="text-[11px] font-bold text-slate-500">Color:</span>
                                {[
                                  { hex: "#0f172a", label: "Black" },
                                  { hex: "#dc2626", label: "Red" },
                                  { hex: "#2563eb", label: "Blue" },
                                  { hex: "#16a34a", label: "Green" },
                                ].map((c) => (
                                  <button
                                    key={c.hex}
                                    type="button"
                                    onClick={() => setSigColor(c.hex)}
                                    className={`w-4 h-4 rounded-full transition cursor-pointer ${
                                      sigColor === c.hex
                                        ? "ring-2 ring-indigo-600 ring-offset-1 scale-110"
                                        : "opacity-80 hover:opacity-100"
                                    }`}
                                    style={{ backgroundColor: c.hex }}
                                    title={c.label}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Modal Footer: Apply Button */}
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIsSigConfigModalOpen(false)}
                            className="px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
                          >
                            Cancel
                          </button>

                          <button
                            type="button"
                            onClick={applySignatureModalConfig}
                            className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-500/25 transition cursor-pointer"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Redact PDF Studio (Interactive Multi-Page Redactor) */}
              {tool.id === "redact-pdf" && (
                <div className="space-y-4">
                  {/* Top Bar: Redaction Actions & Color Selector */}
                  <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-lg space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center font-bold text-xs">
                          🛡️
                        </span>
                        <div>
                          <h4 className="text-xs font-bold text-white">Interactive Redaction Studio</h4>
                          <p className="text-[10px] text-slate-400">
                            Draw & place black bars over sensitive areas to permanently erase them
                          </p>
                        </div>
                      </div>

                      {/* Quick Add Buttons */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => addRedactBox("custom")}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-md shadow-red-500/20 flex items-center gap-1"
                        >
                          <span>+ Redaction Box</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => addRedactBox("line")}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1"
                        >
                          <span>+ Full Line</span>
                        </button>
                      </div>
                    </div>

                    {/* Redaction Style, Label & Metadata Options */}
                    <div className="pt-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                      {/* Color Options */}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-400">Style:</span>
                        {[
                          { hex: "#000000", label: "⬛ Black Bar" },
                          { hex: "#ffffff", label: "⬜ Whiteout" },
                          { hex: "#334155", label: "🔲 Dark Slate" },
                        ].map((c) => (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => setRedactColor(c.hex)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                              redactColor === c.hex
                                ? "bg-slate-700 text-white ring-1 ring-white/40"
                                : "text-slate-400 hover:text-white hover:bg-slate-800"
                            }`}
                          >
                            <span>{c.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Label Stamp */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-400">Stamp:</span>
                        <input
                          type="text"
                          value={redactLabelText}
                          onChange={(e) => setRedactLabelText(e.target.value)}
                          placeholder="None (Solid)"
                          className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-white rounded-lg text-xs font-mono w-28 outline-hidden focus:border-red-500"
                        />
                      </div>

                      {/* Metadata Wiping */}
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300 font-medium select-none">
                        <input
                          type="checkbox"
                          checked={redactWipeMetadata}
                          onChange={(e) => setRedactWipeMetadata(e.target.checked)}
                          className="rounded-sm accent-red-600 cursor-pointer"
                        />
                        <span>Wipe Document Metadata (Author, History)</span>
                      </label>
                    </div>
                  </div>

                  {/* Search & Redact All Feature */}
                  <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Search & Redact All Occurrences (Across All Pages):</span>
                      </span>
                      {redactSearchMatchMsg && (
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                          redactSearchMatchMsg.startsWith("✓")
                            ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                            : "text-slate-500 bg-slate-50 border border-slate-200"
                        }`}>
                          {redactSearchMatchMsg}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={redactSearchText}
                          onChange={(e) => setRedactSearchText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSearchAndRedactMatches();
                            }
                          }}
                          placeholder="Type word, name, or phrase to wipe across all pages (e.g. Confidential, SSN, Account Number)..."
                          className="w-full pl-3 pr-20 py-2.5 bg-slate-50 border-2 border-indigo-200 focus:border-indigo-600 rounded-xl text-xs font-bold text-slate-900 outline-hidden shadow-2xs"
                        />
                        {redactSearchText && (
                          <button
                            type="button"
                            onClick={() => {
                              setRedactSearchText("");
                              setRedactSearchMatchMsg(null);
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={isSearchingRedactMatches || !redactSearchText.trim()}
                        onClick={() => handleSearchAndRedactMatches()}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-md shadow-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
                      >
                        {isSearchingRedactMatches ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <span>🔍</span>
                        )}
                        <span>{isSearchingRedactMatches ? "Searching..." : "Search & Redact All Pages"}</span>
                      </button>
                    </div>

                    {/* Quick Pattern Presets */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-400">Quick Presets:</span>
                      {[
                        { label: "CONFIDENTIAL", val: "CONFIDENTIAL" },
                        { label: "SECRET", val: "SECRET" },
                        { label: "SSN / ID Number", val: "SSN, Social Security, ID Number" },
                        { label: "Bank Account", val: "Account Number, Routing Number, IBAN" },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setRedactSearchText(preset.val);
                            handleSearchAndRedactMatches(preset.val);
                          }}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 rounded-lg text-[10px] font-semibold transition cursor-pointer"
                        >
                          + {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Multi-Page Visual Redactor Canvas */}
                  <div className="p-3.5 bg-slate-100/80 rounded-2xl border border-slate-200/80 space-y-2.5">
                    {/* Document Page Navigation Toolbar */}
                    <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200/80 shadow-2xs">
                      {/* Left: Page Stepper */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={redactPageNum <= 1}
                          onClick={() => handleSwitchRedactPage(redactPageNum - 1)}
                          className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                          title="Previous Page"
                        >
                          ←
                        </button>

                        <div className="flex items-center gap-1 text-xs font-bold text-slate-800">
                          <span>Page</span>
                          <select
                            value={redactPageNum}
                            onChange={(e) => handleSwitchRedactPage(Number(e.target.value))}
                            className="bg-slate-100 border border-slate-200 rounded-md px-1.5 py-0.5 text-xs font-bold text-indigo-700 cursor-pointer outline-hidden"
                          >
                            {(redactThumbnails.length > 0 ? redactThumbnails : [{ page_num: 1 }]).map((t) => (
                              <option key={t.page_num} value={t.page_num}>
                                {t.page_num}
                              </option>
                            ))}
                          </select>
                          <span className="text-slate-400 font-normal">/ {redactThumbnails.length || 1}</span>
                        </div>

                        <button
                          type="button"
                          disabled={redactPageNum >= redactThumbnails.length}
                          onClick={() => handleSwitchRedactPage(redactPageNum + 1)}
                          className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                          title="Next Page"
                        >
                          →
                        </button>
                      </div>

                      {/* Right: Page Redaction Count & Clear */}
                      <div className="flex items-center gap-2">
                        {redactBoxes.filter((b) => b.page === redactPageNum).length > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                              🛡️ {redactBoxes.filter((b) => b.page === redactPageNum).length} Marked for Redaction
                            </span>
                            <button
                              type="button"
                              onClick={() => setRedactBoxes((prev) => prev.filter((b) => b.page !== redactPageNum))}
                              className="px-2 py-1 text-[11px] font-bold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer flex items-center gap-1"
                              title="Remove redaction boxes from this page"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Clear Page</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                            No manual boxes on this page
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Interactive Canvas Viewport */}
                    <div
                      ref={redactContainerRef}
                      className="relative w-full bg-slate-900/90 rounded-2xl overflow-hidden shadow-inner border border-slate-300 select-none flex items-center justify-center min-h-[420px] max-h-[520px]"
                    >
                      {redactPreviewUrl ? (
                        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                          {/* Document Page Image */}
                          <img
                            src={redactPreviewUrl}
                            alt={`Redact Page ${redactPageNum}`}
                            className="max-h-[480px] w-auto object-contain pointer-events-none"
                          />

                          {/* Render All Redaction Boxes for Current Page */}
                          {redactBoxes
                            .filter((b) => b.page === redactPageNum)
                            .map((box) => {
                              const isSelected = activeRedactBoxId === box.id;
                              return (
                                <div
                                  key={box.id}
                                  style={{
                                    left: `${box.x}%`,
                                    top: `${box.y}%`,
                                    width: `${box.w}%`,
                                    height: `${box.h}%`,
                                    backgroundColor: redactColor,
                                  }}
                                  onMouseDown={(e) => handleRedactBoxMouseDown(e, box, "move")}
                                  className={`absolute rounded-xs cursor-move pointer-events-auto select-none flex items-center justify-center transition-shadow group/box ${
                                    isSelected
                                      ? "border-2 border-red-500 shadow-xl ring-2 ring-red-500/30"
                                      : "border border-red-400/80 hover:border-red-600"
                                  }`}
                                >
                                  {/* Floating Toolbar on Selected Redaction Box */}
                                  {isSelected && (
                                    <div className="absolute -top-7 left-0 flex items-center gap-1 bg-slate-950 text-white rounded-md px-1.5 py-0.5 text-[10px] font-bold shadow-md z-30 pointer-events-auto">
                                      <button
                                        type="button"
                                        onClick={(e) => duplicateRedactBox(box, e)}
                                        className="hover:text-red-300 p-0.5 cursor-pointer"
                                        title="Duplicate box"
                                      >
                                        <Copy className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => deleteRedactBox(box.id, e)}
                                        className="hover:text-red-400 p-0.5 cursor-pointer ml-1"
                                        title="Remove box"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}

                                  {/* Optional Label inside Redaction Box */}
                                  {box.label && (
                                    <span
                                      className={`text-[9px] font-mono font-bold select-none truncate px-1 ${
                                        redactColor === "#ffffff" ? "text-slate-900" : "text-white/80"
                                      }`}
                                    >
                                      {box.label}
                                    </span>
                                  )}

                                  {/* Resize Corner Handle */}
                                  {isSelected && (
                                    <div
                                      onMouseDown={(e) => handleRedactBoxMouseDown(e, box, "se")}
                                      className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-red-600 border-2 border-white rounded-full shadow-md cursor-se-resize hover:scale-125 transition-transform"
                                      title="Drag corner to resize"
                                    />
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <div className="text-center p-8 text-white/70 space-y-2">
                          <FileText className="w-10 h-10 mx-auto text-red-400 opacity-80" />
                          <p className="text-xs font-bold">Document Loaded</p>
                          <p className="text-[11px] text-white/50">{redactBoxes.length} redaction box(es) placed</p>
                        </div>
                      )}
                    </div>
                  </div>
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
              disabled={loading || files.length === 0 || (tool.id === "compare-pdf" && files.length < 2)}
              className={`w-full py-4 text-white font-bold rounded-2xl text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg transition-all duration-300 ${
                loading || files.length === 0 || (tool.id === "compare-pdf" && files.length < 2)
                  ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
                  : "bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 hover:from-indigo-500 hover:via-violet-500 hover:to-indigo-600 shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5 cursor-pointer"
              }`}
            >
              {loading ? (
                <div className="flex items-center gap-2.5">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Processing {tool.name}...</span>
                </div>
              ) : (
                <>
                  <span>
                    {tool.id === "organize-pdf"
                      ? "Save & Download Organized PDF"
                      : tool.id === "sign-pdf"
                      ? `Sign & Download PDF (${placedFields.length} placed)`
                      : tool.id === "redact-pdf"
                      ? `Permanently Redact PDF (${redactBoxes.length} marked area${redactBoxes.length === 1 ? "" : "s"})`
                      : tool.id === "compare-pdf"
                      ? (files.length < 2 ? "Please Upload 2 PDF Files to Compare" : "Compare 2 Documents Side-by-Side")
                      : `Process ${tool.name}`}
                  </span>
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

            {/* Compare PDF Side-by-Side Diff Report */}
            {result.comparison && tool.id === "compare-pdf" && (
              <div className="space-y-4">
                {/* Comparison Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-white rounded-2xl border border-slate-200 text-center shadow-2xs">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Document Pages</p>
                    <p className="text-xs sm:text-sm font-bold text-slate-800 mt-0.5">
                      Doc 1: {result.comparison.pdf_a_pages} pg • Doc 2: {result.comparison.pdf_b_pages} pg
                    </p>
                  </div>

                  <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-center shadow-2xs">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase">Lines Added</p>
                    <p className="text-base font-extrabold text-emerald-700 mt-0.5">
                      +{result.comparison.added_lines} lines
                    </p>
                  </div>

                  <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200 text-center shadow-2xs">
                    <p className="text-[10px] font-bold text-rose-600 uppercase">Lines Removed</p>
                    <p className="text-base font-extrabold text-rose-700 mt-0.5">
                      -{result.comparison.removed_lines} lines
                    </p>
                  </div>
                </div>

                {/* Diff Log Viewer */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span>Side-by-Side Text Comparison Log</span>
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                      <span className="text-emerald-600 font-bold">+ Green = Added</span> • <span className="text-rose-600 font-bold">- Red = Removed</span>
                    </span>
                  </div>

                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 max-h-72 overflow-y-auto font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed space-y-0.5 shadow-inner select-text">
                    {result.comparison.diff_summary && result.comparison.diff_summary.length > 0 ? (
                      result.comparison.diff_summary.map((line: string, idx: number) => {
                        const isAdd = line.startsWith("+") && !line.startsWith("+++");
                        const isRemove = line.startsWith("-") && !line.startsWith("---");
                        const isHeader = line.startsWith("@@") || line.startsWith("---") || line.startsWith("+++");
                        return (
                          <div
                            key={idx}
                            className={`px-2 py-0.5 rounded-xs ${
                              isAdd
                                ? "bg-emerald-950/80 text-emerald-300 font-semibold"
                                : isRemove
                                ? "bg-rose-950/80 text-rose-300 font-semibold"
                                : isHeader
                                ? "text-indigo-400 font-bold"
                                : "text-slate-400"
                            }`}
                          >
                            {line}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-emerald-400 font-bold text-center py-4">
                        ✓ Both PDF documents have identical text content. No differences detected.
                      </p>
                    )}
                  </div>
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
