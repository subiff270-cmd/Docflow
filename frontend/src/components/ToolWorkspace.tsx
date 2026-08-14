"use client";

import React, { useState } from "react";
import { ToolItem } from "../lib/toolsData";
import { useAuth } from "../context/AuthContext";
import { processToolApi, getDownloadUrl } from "../lib/api";
import {
  UploadCloud,
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
  Globe
} from "lucide-react";

interface ToolWorkspaceProps {
  tool: ToolItem;
}

export default function ToolWorkspace({ tool }: ToolWorkspaceProps) {
  const { user, profile, openAuthModal, refreshProfile } = useAuth();

  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      if (tool.multiple) {
        setFiles((prev) => [...prev, ...selected]);
      } else {
        setFiles(selected.slice(0, 1));
      }
      setError(null);
      setResult(null);
    }
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
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
      let msg = err.message || "Unable to process this file.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const languages = [
    "English", "Hindi", "Tamil", "Telugu", "Kannada", "Malayalam",
    "Bengali", "Marathi", "Gujarati", "Punjabi", "Urdu"
  ];

  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-8 px-4 sm:px-6">
      {/* Tool Header */}
      <div className="text-center mb-6 sm:mb-8">
        <span className="inline-block bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2">
          {tool.category}
        </span>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">{tool.name}</h1>
        <p className="mt-2 text-slate-600 text-sm max-w-xl mx-auto">{tool.description}</p>
      </div>

      {/* Special Notice for AI & Translation modular features */}
      {(tool.id === "ai-pdf-summarizer" || tool.id === "translate-pdf") && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-sm flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <strong>Notice:</strong> The AI/Translation external API integration is currently unconfigured in this build per specifications.
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-slate-100 p-4 sm:p-6 md:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File Upload Box */}
          <div className="relative border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl sm:rounded-2xl p-6 sm:p-8 text-center bg-slate-50/50 hover:bg-indigo-50/20 transition group cursor-pointer">
            <input
              type="file"
              accept={tool.accept}
              multiple={tool.multiple}
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
              <UploadCloud className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              {files.length > 0 ? "Add more files" : `Select ${tool.name} Files`}
            </h3>
            <p className="text-xs text-slate-500 mt-1">or drag and drop your document files here</p>
            <p className="text-[11px] text-slate-400 mt-2 font-medium">
              Max file size: {profile?.plan === "PRO" ? "500 MB (Pro)" : "25 MB (Free limit)"}
            </p>
          </div>

          {/* Selected Files List */}
          {files.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Selected Files ({files.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <File className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="text-xs font-semibold text-slate-800 truncate">{f.name}</span>
                      <span className="text-[10px] text-slate-400">({(f.size / (1024*1024)).toFixed(2)} MB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tool Options Controls */}
          {files.length > 0 && [
            "split-pdf", "remove-pages", "extract-pages", "compress-pdf",
            "rotate-pdf", "unlock-pdf", "protect-pdf", "add-watermark",
            "ocr-pdf", "indian-language-documents", "image-to-text", "crop-pdf"
          ].includes(tool.id) && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-indigo-600" />
                Tool Settings
              </h4>

              {tool.id === "split-pdf" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Split Mode</label>
                    <select
                      value={splitMode}
                      onChange={(e) => setSplitMode(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-medium"
                    >
                      <option value="ranges">Page Ranges (e.g. 1-2, 5-8)</option>
                      <option value="individual">Extract Every Single Page</option>
                      <option value="every_n">Split Every N Pages</option>
                    </select>
                  </div>
                  {splitMode === "ranges" && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Page Ranges</label>
                      <input
                        type="text"
                        value={ranges}
                        onChange={(e) => setRanges(e.target.value)}
                        placeholder="1-2, 5, 8-10"
                        className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs"
                      />
                    </div>
                  )}
                  {splitMode === "every_n" && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Every N Pages</label>
                      <input
                        type="number"
                        min="1"
                        value={everyN}
                        onChange={(e) => setEveryN(Number(e.target.value))}
                        className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs"
                      />
                    </div>
                  )}
                </div>
              )}

              {tool.id === "remove-pages" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pages to Remove (comma separated)</label>
                  <input
                    type="text"
                    value={pagesToRemove}
                    onChange={(e) => setPagesToRemove(e.target.value)}
                    placeholder="e.g. 1, 3, 5"
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              )}

              {tool.id === "extract-pages" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Page Range to Extract</label>
                  <input
                    type="text"
                    value={ranges}
                    onChange={(e) => setRanges(e.target.value)}
                    placeholder="e.g. 2, 5, 8-12"
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              )}

              {tool.id === "compress-pdf" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">Compression Level</label>
                  <div className="grid grid-cols-3 gap-3">
                    {["low", "medium", "high"].map((lvl) => (
                      <button
                        type="button"
                        key={lvl}
                        onClick={() => setCompressLevel(lvl)}
                        className={`p-3 rounded-xl border text-xs font-bold uppercase transition ${
                          compressLevel === lvl
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tool.id === "rotate-pdf" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">Rotation Angle</label>
                  <div className="grid grid-cols-3 gap-3">
                    {["90", "180", "270"].map((ang) => (
                      <button
                        type="button"
                        key={ang}
                        onClick={() => setRotateAngle(ang)}
                        className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          rotateAngle === ang
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
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

              {(tool.id === "unlock-pdf" || tool.id === "protect-pdf") && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {tool.id === "unlock-pdf" ? "Enter PDF Password" : "Create PDF Password"}
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-medium"
                  />
                </div>
              )}

              {tool.id === "add-watermark" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Watermark Text</label>
                  <input
                    type="text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-medium"
                  />
                </div>
              )}

              {(tool.id === "ocr-pdf" || tool.id === "indian-language-documents" || tool.id === "image-to-text") && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-indigo-600" />
                    Document Language
                  </label>
                  <select
                    value={ocrLanguage}
                    onChange={(e) => setOcrLanguage(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-medium"
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

          {/* Error Banner */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
              {error.includes("limit") && (
                <button
                  type="button"
                  onClick={openAuthModal}
                  className="px-3 py-1 bg-red-600 text-white rounded-lg font-bold text-[11px] hover:bg-red-700 transition"
                >
                  Upgrade
                </button>
              )}
            </div>
          )}

          {/* Process Action Button */}
          <button
            type="submit"
            disabled={loading || files.length === 0}
            className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 text-white font-bold rounded-xl sm:rounded-2xl text-sm sm:text-base transition shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Processing Document...</span>
              </div>
            ) : (
              <>
                <span>Process {tool.name}</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* Real Result & Download Area */}
        {result && (
          <div className="mt-8 p-6 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <h4 className="text-base font-bold text-slate-900">Conversion Successful!</h4>
                <p className="text-xs text-slate-600">Your processed file is ready for download.</p>
              </div>
            </div>

            {result.reduction_percentage !== undefined && (
              <div className="p-3 bg-white rounded-xl border border-emerald-200 text-xs font-semibold text-slate-700 flex justify-around">
                <div>Original: {(result.original_size / 1024).toFixed(1)} KB</div>
                <div>Compressed: {(result.compressed_size / 1024).toFixed(1)} KB</div>
                <div className="text-emerald-700 font-bold">Reduction: -{result.reduction_percentage}%</div>
              </div>
            )}

            {result.extracted_text && (
              <div className="p-3 bg-white rounded-xl border border-slate-200 max-h-40 overflow-y-auto font-mono text-[11px] text-slate-700 whitespace-pre-wrap">
                {result.extracted_text}
              </div>
            )}

            {result.download_key && (
              <a
                href={getDownloadUrl(result.download_key)}
                download={result.filename}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-md transition"
              >
                <Download className="w-5 h-5" />
                Download {result.filename || "Output File"}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
