import React from "react";
import { notFound } from "next/navigation";
import { TOOLS, ToolItem } from "../../lib/toolsData";
import ToolWorkspace from "../../components/ToolWorkspace";
import VoiceWorkspace from "../../components/VoiceWorkspace";
import AdSlot from "../../components/AdSlot";
import Link from "next/link";
import { HelpCircle, FileText, ArrowRight, ShieldCheck, Zap } from "lucide-react";

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

  return (
    <div className="pb-16">
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

      {/* Tool Workspace Component */}
      {tool.id === "voice-to-document" ? <VoiceWorkspace /> : <ToolWorkspace tool={tool} />}

      {/* AdSlot */}
      <AdSlot format="banner" />

      {/* SEO Info & FAQ */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 space-y-10">
        <div className="bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider">
            <HelpCircle className="w-4 h-4" />
            <span>How {tool.name} Works</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center">
                1
              </div>
              <h4 className="text-sm font-bold text-slate-900">Upload Files</h4>
              <p className="text-xs text-slate-500">Select or drag & drop your files into the secure dropzone.</p>
            </div>

            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center">
                2
              </div>
              <h4 className="text-sm font-bold text-slate-900">Configure & Process</h4>
              <p className="text-xs text-slate-500">Set custom options and click Process to run high-speed conversion.</p>
            </div>

            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center">
                3
              </div>
              <h4 className="text-sm font-bold text-slate-900">Download File</h4>
              <p className="text-xs text-slate-500">Download output files immediately. All files auto-purge after 30 minutes.</p>
            </div>
          </div>
        </div>

        {/* Related Tools */}
        {relatedTools.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900">Related {tool.category} Tools</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {relatedTools.map((rt) => (
                <Link
                  key={rt.id}
                  href={rt.href}
                  className="bg-white p-4 rounded-2xl border border-slate-200/80 hover:border-indigo-500/40 hover:shadow-md transition flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition">{rt.name}</h4>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{rt.description}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
