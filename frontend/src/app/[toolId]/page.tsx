import React from "react";
import { notFound } from "next/navigation";
import { TOOLS, ToolItem } from "../../lib/toolsData";
import ToolWorkspace from "../../components/ToolWorkspace";
import VoiceWorkspace from "../../components/VoiceWorkspace";
import AdSlot from "../../components/AdSlot";
import Link from "next/link";
import {
  HelpCircle,
  FileText,
  ArrowRight,
  ShieldCheck,
  Zap,
  Sparkles,
  Lock,
  Clock,
  CheckCircle2,
  FileSpreadsheet,
  FileImage,
  ChevronDown
} from "lucide-react";

export async function generateStaticParams() {
  return TOOLS.map((t) => ({ toolId: t.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ toolId: string }> }) {
  const { toolId } = await params;
  const tool = TOOLS.find((t) => t.id === toolId);
  if (!tool) return {};
  
  return {
    title: `${tool.name} — Convert & Process Online Free | DocFlow`,
    description: `${tool.description} Fast, secure, AES-256 encrypted production document processing with DocFlow. Instant download without email registration required.`,
    keywords: [
      tool.name,
      `${tool.name} online`,
      `free ${tool.name}`,
      `convert ${tool.name}`,
      `best ${tool.name} tool`,
      `online ${tool.name} free`,
      "docflow document tools",
      tool.category.toLowerCase()
    ],
    openGraph: {
      title: `${tool.name} — DocFlow Online Document Tool`,
      description: tool.description,
      url: `https://docflow.com${tool.href}`,
      siteName: "DocFlow",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${tool.name} — DocFlow`,
      description: tool.description,
    },
    alternates: {
      canonical: `https://docflow.com${tool.href}`,
    },
  };
}

export default async function ToolPage({ params }: { params: Promise<{ toolId: string }> }) {
  const { toolId } = await params;
  const tool = TOOLS.find((t) => t.id === toolId);

  if (!tool) {
    notFound();
  }

  const relatedTools = TOOLS.filter((t) => t.category === tool.category && t.id !== tool.id).slice(0, 4);

  // WebApplication JSON-LD Schema
  const webAppSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": `${tool.name} — DocFlow`,
    "description": tool.description,
    "url": `https://docflow.com${tool.href}`,
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "All",
    "browserRequirements": "Requires JavaScript. Requires HTML5.",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    }
  };

  // HowTo JSON-LD Schema for Google Search Rich Snippet
  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": `How to use ${tool.name} on DocFlow`,
    "description": tool.description,
    "step": [
      {
        "@type": "HowToStep",
        "name": "Upload Files",
        "text": `Select or drag & drop your files into the secure ${tool.name} upload zone.`
      },
      {
        "@type": "HowToStep",
        "name": "Configure & Process",
        "text": `Set optional parameters and click Process ${tool.name} to run instant conversion.`
      },
      {
        "@type": "HowToStep",
        "name": "Download Output File",
        "text": "Download processed files instantly. All files auto-purge after 30 minutes for security."
      }
    ]
  };

  const faqs = [
    {
      q: `Is ${tool.name} completely free to use?`,
      a: `Yes! DocFlow offers free usage with up to 10 conversions per period for standard files. For high-volume batch processing and larger file limits up to 500 MB, DocFlow Pro is available.`
    },
    {
      q: "Are my documents secure and private?",
      a: "Absolutely. All document transfers use 256-bit SSL encryption. Your files are processed securely and permanently deleted from our servers automatically after 30 minutes."
    },
    {
      q: "Does this tool work on mobile and tablet devices?",
      a: "Yes! DocFlow is fully web-based and responsive. You can convert and manage documents on iPhone, Android, iPad, Mac, and Windows without installing any apps or software."
    },
    {
      q: "What is the maximum file size allowed?",
      a: "Free accounts can process files up to 25 MB. DocFlow Pro subscribers can upload and convert large files up to 500 MB."
    }
  ];

  return (
    <div className="pb-16 sm:pb-24">
      {/* WebApplication Structured Data for Google Direct Search Links */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }}
      />
      {/* HowTo Structured Data for Google Rich Snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />

      {/* Main Tool Workspace Component */}
      {tool.id === "voice-to-document" ? <VoiceWorkspace /> : <ToolWorkspace tool={tool} />}

      {/* AdSlot */}
      <AdSlot format="banner" />

      {/* Informational & SEO Content Sections */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 space-y-12">
        {/* 1. How It Works (3 Steps) */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-sm space-y-8">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-indigo-600 uppercase tracking-widest">
              <HelpCircle className="w-4 h-4" />
              Simple 3-Step Process
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              How to use {tool.name}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Transform your documents in seconds with our high-speed engine.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-200/60 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-indigo-500/20">
                01
              </div>
              <h3 className="text-sm font-bold text-slate-900">Upload Files</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Drag and drop your document into the upload card or click to browse from your device.
              </p>
            </div>

            <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-200/60 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-indigo-500/20">
                02
              </div>
              <h3 className="text-sm font-bold text-slate-900">Configure & Process</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Adjust optional parameters if needed and click Process to run high-speed cloud conversion.
              </p>
            </div>

            <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-200/60 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-indigo-500/20">
                03
              </div>
              <h3 className="text-sm font-bold text-slate-900">Download Result</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Save your output document instantly. Files are automatically erased after 30 minutes.
              </p>
            </div>
          </div>
        </div>

        {/* 2. Why Choose DocFlow? */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">Instant Processing</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Powered by cloud engines for fast document conversion and optimization in seconds.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">AES-256 Security</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Enterprise-grade encryption on all data transfers with automatic 30-minute file deletion.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">No Watermarks</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Clean output files with no added watermarks, stamps, or restrictions on free conversions.
            </p>
          </div>
        </div>

        {/* 3. Frequently Asked Questions (FAQ) */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-sm space-y-6">
          <div className="space-y-1">
            <span className="text-xs font-extrabold text-indigo-600 uppercase tracking-widest">
              FAQ
            </span>
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">
              Frequently Asked Questions about {tool.name}
            </h3>
          </div>

          <div className="divide-y divide-slate-100">
            {faqs.map((faq, idx) => (
              <div key={idx} className="py-4 space-y-1.5">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                  {faq.q}
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Related Tools Grid */}
        {relatedTools.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                You May Also Need
              </h3>
              <Link href="/" className="text-xs font-bold text-indigo-600 hover:text-indigo-700">
                View All Tools →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {relatedTools.map((rt) => (
                <Link
                  key={rt.id}
                  href={rt.href}
                  className="bg-white p-4 rounded-2xl border border-slate-200/80 hover:border-indigo-500/40 hover:shadow-md transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition">
                        {rt.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 line-clamp-1">
                        {rt.description}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
