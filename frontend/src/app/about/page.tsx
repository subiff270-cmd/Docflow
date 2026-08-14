"use client";

import React from "react";
import Link from "next/link";
import {
  FileText,
  ShieldCheck,
  Zap,
  Globe,
  Lock,
  Cpu,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Users,
  Award
} from "lucide-react";

export default function AboutPage() {
  return (
    <div className="space-y-16 py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      {/* Hero Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <span className="inline-block bg-indigo-50 text-indigo-700 text-xs font-bold px-3.5 py-1.5 rounded-full uppercase tracking-wider">
          ABOUT DOCFLOW
        </span>
        <h1 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight leading-tight">
          Everything you need for your documents, <br className="hidden sm:inline" />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-800">
            all in one place.
          </span>
        </h1>
        <p className="text-slate-600 text-sm sm:text-base font-medium leading-relaxed">
          DocFlow is a production-grade document management SaaS platform designed to make document processing fast, secure, accessible, and hassle-free for individuals, students, professionals, and enterprise organizations worldwide.
        </p>
      </div>

      {/* Core Mission & Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
        <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Zap className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Real Backend Processing</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Unlike superficial web demos, DocFlow is powered by high-performance Python FastAPI engine and dedicated PyMuPDF, PDFium, and Tesseract OCR pipelines. Every tool handles real-world documents efficiently.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Privacy & Security First</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Your data is strictly your own. Files uploaded to DocFlow are protected with AES-256 encryption in transit and rest, and strictly deleted after 30 minutes via automated background retention purge services.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Globe className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Multilingual & Voice Intelligence</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            DocFlow pioneers specialized OCR document processing for 10+ Indian regional languages (Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, etc.) alongside browser MediaRecorder Voice-to-Document reporting.
          </p>
        </div>
      </div>

      {/* Detailed Technical Feature Suite */}
      <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200/80 shadow-sm space-y-8">
        <div className="max-w-2xl space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">PRODUCTION SUITE</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">What We Build & Deliver</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              <span>PDF Organization</span>
            </div>
            <p className="text-xs text-slate-500">Merge multiple documents into a cohesive file, split pages by ranges or individual sheets, compress size, and rearrange page order.</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              <span>Format Conversions</span>
            </div>
            <p className="text-xs text-slate-500">Convert JPG, Word (DOCX), PowerPoint (PPTX), Excel (XLSX), and HTML web pages into PDF, and vice versa with precision layout preservation.</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              <span>Document Security & Redaction</span>
            </div>
            <p className="text-xs text-slate-500">Protect files with password encryption, unlock protected PDFs, add custom watermarks, digital signature drawing, and true stream-level redaction.</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              <span>Voice to Document</span>
            </div>
            <p className="text-xs text-slate-500">Record audio notes directly with your browser microphone and instantly convert spoken thoughts into formal, structured PDF or DOCX files.</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              <span>Indian Language OCR</span>
            </div>
            <p className="text-xs text-slate-500">Extract readable text layers from scanned printed documents in Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi, and Urdu.</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              <span>Ad-Free & Unlimited Pro</span>
            </div>
            <p className="text-xs text-slate-500">Power users get up to 500 MB file upload limits, zero banner advertisements, and unlimited daily document conversions.</p>
          </div>
        </div>
      </div>

      {/* Commitment to Security & Compliance */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 sm:p-12 text-white shadow-xl space-y-6">
        <div className="max-w-2xl space-y-3">
          <span className="bg-indigo-500/20 text-indigo-300 text-xs font-bold px-3 py-1 rounded-full uppercase">
            PRIVACY GUARANTEE
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold">Zero Permanent Data Retention</h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            DocFlow operates on strict confidentiality principles. We do not analyze, sell, or retain your personal document content. Files uploaded to our platform reside in isolated temporary buffers and are automatically removed after 30 minutes.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 pt-2">
          <Link
            href="/contact"
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition"
          >
            Contact Support Team
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/privacy"
            className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition backdrop-blur-sm"
          >
            Read Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
