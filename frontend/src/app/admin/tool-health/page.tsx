"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Upload,
  RefreshCw,
  Download,
  Server,
  Layers,
  Cpu,
  ShieldAlert,
  ArrowRight,
  Eye,
  Info
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface SystemHealth {
  status: string;
  timestamp: string;
  python: string;
  pymupdf: string;
  pypdf: string;
  pdf2docx: string;
  python_docx: string;
  openpyxl: string;
  python_pptx: string;
  pillow: string;
  reportlab: string;
  pdfplumber: string;
  tesseract: string;
  libreoffice: string;
  temp_storage: string;
}

interface ToolResult {
  name: string;
  category: string;
  engine: string;
  input_format: string;
  output_format: string;
  status: "PASS" | "FAIL" | "MANUAL TEST" | "NOT CONFIGURED";
  details: string;
  download_key?: string;
  filename?: string;
  size_bytes?: number;
}

interface HealthCheckData {
  job_id: string;
  timestamp: string;
  total_tools: number;
  passed: number;
  failed: number;
  manual_test: number;
  not_configured: number;
  pdf_analysis: {
    page_count: number;
    has_text: boolean;
    has_images: boolean;
    has_tables: boolean;
    has_scanned_pages: boolean;
    has_links: boolean;
    dimensions: { width: number; height: number };
    total_characters: number;
    table_count: number;
    image_count: number;
    fonts: string[];
    file_size_bytes: number;
  };
  results: ToolResult[];
}

export default function ToolHealthPage() {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<string>("");
  const [healthData, setHealthData] = useState<HealthCheckData | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");

  useEffect(() => {
    fetchSystemHealth();
  }, []);

  const fetchSystemHealth = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/system/health`);
      if (res.ok) {
        const data = await res.json();
        setSystemHealth(data);
      }
    } catch (e) {
      console.error("System health fetch failed:", e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const runHealthCheck = async () => {
    setIsRunning(true);
    setCurrentStep("Initializing test workspace...");
    setHealthData(null);

    try {
      const formData = new FormData();
      if (selectedFile) {
        formData.append("file", selectedFile);
        setCurrentStep(`Analyzing uploaded PDF: ${selectedFile.name}...`);
      } else {
        setCurrentStep("Generating high-density reference test PDF...");
      }

      await new Promise((r) => setTimeout(r, 600));
      setCurrentStep("Executing end-to-end tool chains across all 38 engines...");

      const res = await fetch(`${BACKEND_URL}/api/system/tool-health-check`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Health check failed with HTTP ${res.status}`);
      }

      const data: HealthCheckData = await res.json();
      setHealthData(data);
      setCurrentStep("Health check completed successfully!");
    } catch (err: any) {
      alert(`Health check error: ${err.message || "Failed to communicate with backend."}`);
    } finally {
      setIsRunning(false);
    }
  };

  const filteredResults = healthData?.results.filter((r) => {
    if (activeFilter === "ALL") return true;
    return r.status === activeFilter;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-2">
              <Activity className="w-3.5 h-3.5" /> Engine Verification Suite
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              DocFlow Tool Health Check &amp; Verification
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Automated end-to-end validation across all 38 document processing engines.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchSystemHealth}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Environment
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition shadow-sm"
            >
              Back to Main Platform <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* System Environment Bar */}
        {systemHealth && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Server className="w-4 h-4 text-indigo-600" /> System Processing Dependencies
              </div>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                ● Status: {systemHealth.status}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="text-[11px] font-medium text-slate-500">Python Engine</div>
                <div className="text-xs font-bold text-slate-800">{systemHealth.python}</div>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="text-[11px] font-medium text-slate-500">PyMuPDF (fitz)</div>
                <div className="text-xs font-bold text-emerald-600">● {systemHealth.pymupdf}</div>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="text-[11px] font-medium text-slate-500">python-docx / pptx</div>
                <div className="text-xs font-bold text-emerald-600">● {systemHealth.python_docx}</div>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="text-[11px] font-medium text-slate-500">openpyxl (Excel)</div>
                <div className="text-xs font-bold text-emerald-600">● {systemHealth.openpyxl}</div>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="text-[11px] font-medium text-slate-500">Pillow &amp; ReportLab</div>
                <div className="text-xs font-bold text-emerald-600">● {systemHealth.pillow}</div>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="text-[11px] font-medium text-slate-500">pdf2docx &amp; Plumber</div>
                <div className="text-xs font-bold text-emerald-600">● {systemHealth.pdf2docx}</div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Test PDF Zone & Trigger Card */}
        <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-800/50 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Cpu className="w-5 h-5 text-indigo-400" /> Automated End-to-End Test Chain
              </h2>
              <p className="text-sm text-indigo-200">
                Upload any real PDF to test real document transformations, or let the engine synthesize a high-density reference document containing tables, headings, and sensitive data to test live redaction and decryption.
              </p>
            </div>

            <button
              onClick={runHealthCheck}
              disabled={isRunning}
              className="px-6 py-3.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Running Health Check...
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4" /> Run Full Tool Health Check
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-indigo-400/30 hover:border-indigo-400/60 rounded-2xl cursor-pointer bg-indigo-950/40 transition">
              <Upload className="w-6 h-6 text-indigo-400 mb-2" />
              <span className="text-xs font-semibold text-indigo-200">
                {selectedFile ? `Selected: ${selectedFile.name}` : "Click to select custom test PDF (Optional)"}
              </span>
              <span className="text-[10px] text-indigo-400 mt-1">Accepts any real .pdf document</span>
              <input type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
            </label>

            <div className="bg-indigo-950/40 p-4 rounded-2xl border border-indigo-800/40 flex flex-col justify-center space-y-1">
              <div className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" /> Automated Test Logic
              </div>
              <div className="text-[11px] text-indigo-200/80">
                • PDF → DOCX output feeds into Word → PDF validator.
                <br />
                • PDF → XLSX output feeds into Excel → PDF validator.
                <br />
                • PDF → PPTX output feeds into PowerPoint → PDF validator.
              </div>
            </div>
          </div>

          {isRunning && (
            <div className="bg-indigo-950/80 p-4 rounded-2xl border border-indigo-500/40 flex items-center gap-3 animate-pulse">
              <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin flex-shrink-0" />
              <div className="text-xs font-semibold text-indigo-100">{currentStep}</div>
            </div>
          )}
        </div>

        {/* Results Section */}
        {healthData && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Summary KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                <div className="text-xs font-semibold text-slate-500">Total Tools</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{healthData.total_tools}</div>
              </div>
              <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200 shadow-sm text-center">
                <div className="text-xs font-semibold text-emerald-700">Passed</div>
                <div className="text-2xl font-black text-emerald-700 mt-1">{healthData.passed}</div>
              </div>
              <div className="bg-rose-50/60 p-4 rounded-2xl border border-rose-200 shadow-sm text-center">
                <div className="text-xs font-semibold text-rose-700">Failed</div>
                <div className="text-2xl font-black text-rose-700 mt-1">{healthData.failed}</div>
              </div>
              <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200 shadow-sm text-center">
                <div className="text-xs font-semibold text-amber-700">Manual Test</div>
                <div className="text-2xl font-black text-amber-700 mt-1">{healthData.manual_test}</div>
              </div>
              <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                <div className="text-xs font-semibold text-slate-600">Not Configured</div>
                <div className="text-2xl font-black text-slate-700 mt-1">{healthData.not_configured}</div>
              </div>
            </div>

            {/* Deep PDF Analysis Card */}
            {healthData.pdf_analysis && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                  <FileText className="w-4 h-4 text-indigo-600" /> Deep PDF Analysis Profile
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">Pages:</span>{" "}
                    <span className="font-bold text-slate-800">{healthData.pdf_analysis.page_count}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Text Layer:</span>{" "}
                    <span className="font-bold text-slate-800">{healthData.pdf_analysis.has_text ? "Yes" : "No"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Tables Detected:</span>{" "}
                    <span className="font-bold text-slate-800">{healthData.pdf_analysis.table_count}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Characters:</span>{" "}
                    <span className="font-bold text-slate-800">{healthData.pdf_analysis.total_characters}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Dimensions:</span>{" "}
                    <span className="font-bold text-slate-800">
                      {healthData.pdf_analysis.dimensions?.width} × {healthData.pdf_analysis.dimensions?.height} pt
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">File Size:</span>{" "}
                    <span className="font-bold text-slate-800">
                      {(healthData.pdf_analysis.file_size_bytes / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
              {["ALL", "PASS", "FAIL", "MANUAL TEST", "NOT CONFIGURED"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveFilter(tab)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    activeFilter === tab
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Results Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Tool Name</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Real Processing Engine</th>
                      <th className="py-3 px-4">Transformation</th>
                      <th className="py-3 px-4">Validation Details</th>
                      <th className="py-3 px-4 text-right">Download</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredResults?.map((r, idx) => {
                      let badge = (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> PASS
                        </span>
                      );
                      if (r.status === "FAIL") {
                        badge = (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3 h-3" /> FAIL
                          </span>
                        );
                      } else if (r.status === "MANUAL TEST") {
                        badge = (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertTriangle className="w-3 h-3" /> MANUAL
                          </span>
                        );
                      } else if (r.status === "NOT CONFIGURED") {
                        badge = (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <Info className="w-3 h-3" /> NOT CONFIGURED
                          </span>
                        );
                      }

                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4 font-semibold">{badge}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">{r.name}</td>
                          <td className="py-3 px-4 text-slate-500 font-medium">{r.category}</td>
                          <td className="py-3 px-4 text-slate-700 font-medium">{r.engine}</td>
                          <td className="py-3 px-4 text-slate-600">
                            <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">
                              {r.input_format} → {r.output_format}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={r.details}>
                            {r.details}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {r.download_key ? (
                              <a
                                href={`${BACKEND_URL}/api/tools/download/${r.download_key}`}
                                download={r.filename}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition"
                              >
                                <Download className="w-3 h-3" /> Test File
                              </a>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
