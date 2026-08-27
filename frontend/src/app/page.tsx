"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { CATEGORIES, TOOLS, ToolItem } from "../lib/toolsData";
import AdSlot from "../components/AdSlot";
import {
  FileText,
  Search,
  Zap,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Mic,
  Languages,
  CheckCircle2,
  X,
  FileOutput,
  FileMinus,
  Brain,
  Globe,
  Lock,
  LayoutGrid,
  FileCheck2,
  FileSearch,
} from "lucide-react";

/* ──────────────────────────────────────────
   Scroll-reveal hook (IntersectionObserver)
   ────────────────────────────────────────── */
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("revealed");
          observer.unobserve(el);
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

/* ──────────────────────────────────────────
   Featured tools data
   ────────────────────────────────────────── */
const FEATURED_TOOLS = [
  {
    id: "pdf-to-word",
    name: "PDF to Word",
    desc: "Convert PDFs into editable Word documents instantly.",
    icon: FileOutput,
    href: "/pdf-to-word",
    glowClass: "",
  },
  {
    id: "compress-pdf",
    name: "Compress PDF",
    desc: "Reduce file size while keeping quality intact.",
    icon: FileMinus,
    href: "/compress-pdf",
    glowClass: "",
  },
  {
    id: "merge-pdf",
    name: "Merge PDF",
    desc: "Combine multiple PDFs into a single document.",
    icon: FileText,
    href: "/merge-pdf",
    glowClass: "",
  },
  {
    id: "organize-pdf",
    name: "Organize PDF",
    desc: "Reorder, rotate, delete, and duplicate pages visually.",
    icon: LayoutGrid,
    href: "/organize-pdf",
    glowClass: "",
  },
  {
    id: "split-pdf",
    name: "Split PDF",
    desc: "Separate pages or extract specific page ranges easily.",
    icon: FileMinus,
    href: "/split-pdf",
    glowClass: "",
  },
  {
    id: "add-page-numbers",
    name: "Page Numbers",
    desc: "Insert customizable page numbers with 6 position presets.",
    icon: FileCheck2,
    href: "/add-page-numbers",
    glowClass: "",
  },
];

/* ──────────────────────────────────────────
   Particles configuration (max 15)
   ────────────────────────────────────────── */
const PARTICLES = [
  { size: 3, x: "12%", y: "20%", color: "particle-purple", dur: "12s", delay: "0s" },
  { size: 2, x: "85%", y: "30%", color: "particle-blue", dur: "15s", delay: "2s" },
  { size: 4, x: "25%", y: "70%", color: "particle-purple", dur: "18s", delay: "1s" },
  { size: 2, x: "70%", y: "15%", color: "particle-white", dur: "14s", delay: "3s" },
  { size: 3, x: "90%", y: "65%", color: "particle-blue", dur: "16s", delay: "0.5s" },
  { size: 2, x: "40%", y: "80%", color: "particle-purple", dur: "13s", delay: "4s" },
  { size: 3, x: "60%", y: "25%", color: "particle-white", dur: "17s", delay: "1.5s" },
  { size: 2, x: "15%", y: "50%", color: "particle-blue", dur: "11s", delay: "2.5s" },
  { size: 3, x: "78%", y: "75%", color: "particle-purple", dur: "19s", delay: "0s" },
  { size: 2, x: "50%", y: "10%", color: "particle-white", dur: "14s", delay: "3.5s" },
  { size: 4, x: "35%", y: "45%", color: "particle-blue", dur: "16s", delay: "1s" },
  { size: 2, x: "92%", y: "50%", color: "particle-purple", dur: "13s", delay: "2s" },
];

/* ──────────────────────────────────────────
   Language chips
   ────────────────────────────────────────── */
const LANGUAGES = [
  { label: "हिन्दी", name: "Hindi" },
  { label: "தமிழ்", name: "Tamil" },
  { label: "తెలుగు", name: "Telugu" },
  { label: "ಕನ್ನಡ", name: "Kannada" },
  { label: "മലയാളം", name: "Malayalam" },
  { label: "বাংলা", name: "Bengali" },
  { label: "मराठी", name: "Marathi" },
  { label: "ગુજરાતી", name: "Gujarati" },
];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const toolsGridRef = useRef<HTMLDivElement>(null);

  /* Scroll-reveal refs for sections */
  const featuredRef = useScrollReveal();
  const toolsRef = useScrollReveal();
  const langRef = useScrollReveal();
  const bannerRef = useScrollReveal();

  /* Map grouped tabs to underlying categories */
  const TAB_CATEGORY_MAP: Record<string, string[]> = {
    CONVERT: ["CONVERT FROM PDF", "CONVERT TO PDF"],
    PDF_TOOLS: ["ORGANIZE PDF", "OPTIMIZE PDF", "EDIT PDF", "PDF SECURITY"],
    OCR: ["INDIAN LANGUAGE DOCUMENTS"],
    IMAGE: ["IMAGE TOOLS"],
  };

  const filteredTools = TOOLS.filter((tool) => {
    const matchesTab =
      activeTab === "ALL" ||
      (TAB_CATEGORY_MAP[activeTab]
        ? TAB_CATEGORY_MAP[activeTab].includes(tool.category)
        : tool.category === activeTab);
    const matchesSearch =
      !searchQuery ||
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const searchResults = searchQuery
    ? TOOLS.filter(
        (tool) =>
          tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tool.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tool.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setIsDropdownOpen(val.trim().length > 0);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsDropdownOpen(false);
    if (toolsGridRef.current) {
      toolsGridRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  /* Determine card glow class based on tool */
  const getCardClass = (tool: ToolItem) => {
    if (tool.id.includes("ai") || tool.id.includes("summarizer")) return "tool-card-ai";
    if (tool.id.includes("voice")) return "tool-card-voice";
    return "";
  };

  return (
    <div className="space-y-8 sm:space-y-16 pb-8 sm:pb-16">
      {/* ============================================
          HERO SECTION — Premium Ambient Glow
          ============================================ */}
      <section className="hero-ambient relative z-10 bg-gradient-to-b from-white via-indigo-50/30 to-slate-50 pt-10 sm:pt-20 pb-20 sm:pb-32 px-4 sm:px-6 lg:px-8 border-b border-slate-100/60">
        {/* Ambient glow layers */}
        <div className="hero-glow-extra" aria-hidden="true" />
        <div className="hero-light-beam" aria-hidden="true" />

        {/* Floating document outlines */}
        <div className="floating-doc floating-doc-1" aria-hidden="true" />
        <div className="floating-doc floating-doc-2" aria-hidden="true" />
        <div className="floating-doc floating-doc-3" aria-hidden="true" />
        <div className="floating-doc floating-doc-4" aria-hidden="true" />

        {/* Particles */}
        {PARTICLES.map((p, i) => (
          <div
            key={i}
            className={`particle ${p.color}`}
            aria-hidden="true"
            style={{
              width: p.size,
              height: p.size,
              left: p.x,
              top: p.y,
              animation: `particleFloat ${p.dur} ease-in-out ${p.delay} infinite`,
            }}
          />
        ))}

        <div className="relative max-w-5xl mx-auto text-center space-y-6 sm:space-y-8">
          {/* Hero Heading */}
          <h1 className="hero-heading-anim text-3xl sm:text-5xl lg:text-7xl font-black text-slate-950 tracking-tight leading-[1.1]">
            Everything you need for your{" "}
            <br className="hidden sm:inline" />
            documents,{" "}
            <br className="hidden sm:inline" />
            <span
              className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-violet-500 to-purple-600"
              style={{ filter: "drop-shadow(0 0 30px rgba(99, 102, 241, 0.15))" }}
            >
              all in one place.
            </span>
          </h1>

          {/* Description */}
          <p className="hero-desc-anim text-sm sm:text-base lg:text-lg text-slate-500 max-w-2xl mx-auto font-medium px-2 sm:px-0 leading-relaxed">
            Merge, split, compress, edit, convert, protect, sign, redact PDFs,
            and extract text from Indian Language documents.
          </p>

          {/* Premium Search Bar */}
          <div
            className="hero-search-anim max-w-2xl mx-auto pt-2 relative"
            ref={searchContainerRef}
          >
            <form onSubmit={handleSearchSubmit}>
              <div className="search-premium relative flex items-center p-2.5 sm:p-3">
                <Search className="w-5 h-5 text-indigo-500 ml-3 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => {
                    if (searchQuery.trim().length > 0) setIsDropdownOpen(true);
                  }}
                  placeholder='Search tools (e.g. "merge pdf")...'
                  className="w-full pl-3 pr-4 py-2 text-base text-slate-900 placeholder:text-slate-400 font-medium focus:outline-none bg-transparent"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setIsDropdownOpen(false);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 mr-1 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                ) : null}
              </div>
            </form>

            {/* Search Results Dropdown */}
            {isDropdownOpen && (
              <div className="search-dropdown-premium absolute top-full left-0 right-0 mt-3 max-h-[60vh] sm:max-h-[420px] overflow-y-auto p-2 sm:p-3 z-50 text-left space-y-1 sm:space-y-1.5 animate-in fade-in">
                {searchResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No tools found for &ldquo;
                    <strong className="text-slate-700">{searchQuery}</strong>
                    &rdquo;
                  </div>
                ) : (
                  searchResults.map((tool) => (
                    <Link
                      key={tool.id}
                      href={tool.href}
                      onClick={() => setIsDropdownOpen(false)}
                      className="flex items-center justify-between p-3 sm:p-3.5 rounded-xl hover:bg-indigo-50/80 transition group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition">
                            {tool.name}
                          </h4>
                          <p className="text-xs text-slate-500 line-clamp-1">
                            {tool.description}
                          </p>
                        </div>
                      </div>
                      <div className="hidden sm:flex items-center gap-2">
                        <span className="text-[10px] font-extrabold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md uppercase">
                          {tool.category}
                        </span>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition" />
                      </div>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* AdSlot */}
      <AdSlot format="banner" />



      {/* ============================================
          TOOLS SECTION — Full Grid
          ============================================ */}
      <section
        ref={toolsGridRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 scroll-mt-24"
      >
        <div ref={toolsRef} className="scroll-reveal space-y-8">
          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-200">
            {[
              { label: "All Tools", value: "ALL", count: TOOLS.length },
              { label: "Convert", value: "CONVERT" },
              { label: "PDF Tools", value: "PDF_TOOLS" },
              { label: "OCR & Languages", value: "OCR" },
              { label: "Image Tools", value: "IMAGE" },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`category-pill px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition ${
                  activeTab === tab.value
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {tab.label}{tab.count ? ` (${tab.count})` : ""}
              </button>
            ))}
          </div>

          {/* Tool Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {filteredTools.map((tool) => (
              <Link
                key={tool.id}
                href={tool.href}
                className={`tool-card-premium ${getCardClass(
                  tool
                )} group bg-white rounded-2xl p-5 border border-slate-200/80 hover:border-indigo-500/40 transition-all flex flex-col justify-between`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition flex items-center justify-center">
                      <FileText className="w-5 h-5" />
                    </div>
                    {tool.popular && (
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                        POPULAR
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition">
                      {tool.name}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                      {tool.description}
                    </p>
                  </div>
                </div>

                <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition-transform">
                  <span>Use Tool</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          INDIAN LANGUAGES SECTION
          ============================================ */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={langRef} className="scroll-reveal">
          <div className="text-center space-y-4 mb-8">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 uppercase tracking-widest">
              <Globe className="w-3.5 h-3.5" />
              Multi-Language Support
            </span>
            <h2 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Documents that speak your language
            </h2>
            <p className="text-sm text-slate-500 max-w-lg mx-auto">
              Extract text from documents in 10+ Indian languages with precision
              OCR technology.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {LANGUAGES.map((lang) => (
              <span key={lang.name} className="lang-chip" title={lang.name}>
                {lang.label}
              </span>
            ))}
          </div>
          <div className="text-center mt-6">
            <Link
              href="/ocr-pdf"
              className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 transition group"
            >
              Explore OCR PDF
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================
          FEATURED CAPABILITIES BANNER
          ============================================ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={bannerRef} className="scroll-reveal">
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 sm:p-12 text-white shadow-2xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <span className="bg-indigo-500/20 text-indigo-300 text-xs font-bold px-3 py-1 rounded-full uppercase">
                POWERFUL CAPABILITIES
              </span>
              <h2 className="text-xl sm:text-3xl font-extrabold">
                Smart OCR & Multi-Format PDF Processing
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Extract searchable text, convert scanned documents to editable formats,
                or optimize and organize large PDFs with zero quality loss.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href="/ocr-pdf"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition"
                >
                  <FileSearch className="w-4 h-4" />
                  Try OCR PDF
                </Link>
                <Link
                  href="/organize-pdf"
                  className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition backdrop-blur-sm"
                >
                  <LayoutGrid className="w-4 h-4" />
                  Organize PDF
                </Link>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 space-y-3 font-mono text-[10px] sm:text-xs text-indigo-200 overflow-hidden">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>High-Speed Local & Cloud PDF Processing</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi,
                  Gujarati, Punjabi, Urdu
                </span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>True PDF Redaction (Underlying Stream Removal)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          TRUST / FEATURES STRIP
          ============================================ */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 text-center">
          {[
            {
              icon: ShieldCheck,
              title: "Secure Processing",
              desc: "Files encrypted & auto-deleted",
            },
            {
              icon: Zap,
              title: "Lightning Fast",
              desc: "Process documents in seconds",
            },
            {
              icon: Lock,
              title: "Privacy First",
              desc: "No data stored on our servers",
            },
            {
              icon: Sparkles,
              title: "AI Powered",
              desc: "Intelligent document analysis",
            },
          ].map((item) => (
            <div key={item.title} className="space-y-2">
              <div className="w-10 h-10 mx-auto rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <item.icon className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
              <p className="text-xs text-slate-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
