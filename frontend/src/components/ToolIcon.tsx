"use client";

import React from "react";
import {
  FileText,
  FileSpreadsheet,
  FileImage,
  ArrowRight,
  Sparkles,
  Lock,
  Unlock,
  RotateCw,
  Scissors,
  Layers,
  Minimize2,
  ScanText,
  PenTool,
  EyeOff,
  Mic,
  Languages,
  FilePlus,
  HelpCircle,
  FileCheck2,
  FileCode,
  Crop,
  Stamp
} from "lucide-react";

interface ToolIconProps {
  toolId: string;
  className?: string;
}

export default function ToolIcon({ toolId, className = "" }: ToolIconProps) {
  // Conversion pair: [Input Icon/Text] -> [Output Icon/Text]
  const renderConversionPair = (fromText: string, toText: string, fromColor: string, toColor: string) => (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`px-2.5 py-1.5 rounded-xl font-extrabold text-xs tracking-wider shadow-sm ${fromColor}`}>
        {fromText}
      </div>
      <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
        <ArrowRight className="w-3.5 h-3.5" />
      </div>
      <div className={`px-2.5 py-1.5 rounded-xl font-extrabold text-xs tracking-wider shadow-sm ${toColor}`}>
        {toText}
      </div>
    </div>
  );

  // Single or composite icon
  const renderSingleIcon = (IconComponent: React.ElementType, bgGradient: string, iconColor: string) => (
    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl ${bgGradient} flex items-center justify-center shadow-md shadow-indigo-500/10 ${className}`}>
      <IconComponent className={`w-6 h-6 sm:w-7 sm:h-7 ${iconColor}`} />
    </div>
  );

  switch (toolId) {
    // Conversions FROM PDF
    case "pdf-to-word":
      return renderConversionPair("PDF", "DOCX", "bg-red-50 text-red-700 border border-red-200/60", "bg-blue-50 text-blue-700 border border-blue-200/60");
    case "pdf-to-jpg":
      return renderConversionPair("PDF", "JPG", "bg-red-50 text-red-700 border border-red-200/60", "bg-emerald-50 text-emerald-700 border border-emerald-200/60");
    case "pdf-to-excel":
      return renderConversionPair("PDF", "XLSX", "bg-red-50 text-red-700 border border-red-200/60", "bg-green-50 text-green-700 border border-green-200/60");
    case "pdf-to-powerpoint":
    case "pdf-to-ppt":
      return renderConversionPair("PDF", "PPTX", "bg-red-50 text-red-700 border border-red-200/60", "bg-amber-50 text-amber-700 border border-amber-200/60");
    case "pdf-to-markdown":
      return renderConversionPair("PDF", "MD", "bg-red-50 text-red-700 border border-red-200/60", "bg-purple-50 text-purple-700 border border-purple-200/60");
    case "pdf-to-pdfa":
      return renderConversionPair("PDF", "PDF/A", "bg-red-50 text-red-700 border border-red-200/60", "bg-indigo-50 text-indigo-700 border border-indigo-200/60");

    // Conversions TO PDF
    case "word-to-pdf":
      return renderConversionPair("DOCX", "PDF", "bg-blue-50 text-blue-700 border border-blue-200/60", "bg-red-50 text-red-700 border border-red-200/60");
    case "jpg-to-pdf":
      return renderConversionPair("JPG", "PDF", "bg-emerald-50 text-emerald-700 border border-emerald-200/60", "bg-red-50 text-red-700 border border-red-200/60");
    case "excel-to-pdf":
      return renderConversionPair("XLSX", "PDF", "bg-green-50 text-green-700 border border-green-200/60", "bg-red-50 text-red-700 border border-red-200/60");
    case "powerpoint-to-pdf":
    case "ppt-to-pdf":
      return renderConversionPair("PPTX", "PDF", "bg-amber-50 text-amber-700 border border-amber-200/60", "bg-red-50 text-red-700 border border-red-200/60");
    case "html-to-pdf":
      return renderConversionPair("HTML", "PDF", "bg-orange-50 text-orange-700 border border-orange-200/60", "bg-red-50 text-red-700 border border-red-200/60");

    // PDF Management
    case "merge-pdf":
      return renderSingleIcon(Layers, "bg-indigo-50 border border-indigo-100", "text-indigo-600");
    case "split-pdf":
      return renderSingleIcon(Scissors, "bg-violet-50 border border-violet-100", "text-violet-600");
    case "compress-pdf":
      return renderSingleIcon(Minimize2, "bg-blue-50 border border-blue-100", "text-blue-600");
    case "rotate-pdf":
      return renderSingleIcon(RotateCw, "bg-amber-50 border border-amber-100", "text-amber-600");
    case "remove-pages":
    case "extract-pages":
      return renderSingleIcon(Scissors, "bg-purple-50 border border-purple-100", "text-purple-600");
    case "crop-pdf":
      return renderSingleIcon(Crop, "bg-cyan-50 border border-cyan-100", "text-cyan-600");
    case "add-watermark":
      return renderSingleIcon(Stamp, "bg-rose-50 border border-rose-100", "text-rose-600");
    case "add-page-numbers":
      return renderSingleIcon(FileText, "bg-indigo-50 border border-indigo-100", "text-indigo-600");

    // Security
    case "protect-pdf":
      return renderSingleIcon(Lock, "bg-amber-50 border border-amber-100", "text-amber-600");
    case "unlock-pdf":
      return renderSingleIcon(Unlock, "bg-emerald-50 border border-emerald-100", "text-emerald-600");
    case "sign-pdf":
      return renderSingleIcon(PenTool, "bg-indigo-50 border border-indigo-100", "text-indigo-600");
    case "redact-pdf":
      return renderSingleIcon(EyeOff, "bg-slate-100 border border-slate-200", "text-slate-700");

    // OCR & AI & Languages
    case "ocr-pdf":
      return renderSingleIcon(ScanText, "bg-indigo-50 border border-indigo-100", "text-indigo-600");
    case "voice-to-document":
      return renderSingleIcon(Mic, "bg-blue-50 border border-blue-100", "text-blue-600");
    case "ai-pdf-summarizer":
      return renderSingleIcon(Sparkles, "bg-violet-50 border border-violet-100", "text-violet-600");
    case "image-to-text":
      return renderSingleIcon(ScanText, "bg-emerald-50 border border-emerald-100", "text-emerald-600");

    // Default Fallback
    default:
      return renderSingleIcon(FileText, "bg-indigo-50 border border-indigo-100", "text-indigo-600");
  }
}
