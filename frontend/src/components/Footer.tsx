"use client";

import React from "react";
import Link from "next/link";
import { FileText, ShieldCheck } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 border-t border-slate-900 pt-10 sm:pt-14 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-8 pb-10 sm:pb-12 border-b border-slate-900">
          {/* Brand Info */}
          <div className="col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5 text-white">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-xl font-black tracking-tight">DocFlow</span>
            </Link>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              "Everything you need for your documents, in one place."
              Production SaaS platform for PDF merging, editing, converting, voice documents, Indian language OCR, and file security.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>AES-256 Encrypted Private Storage (30-min Auto-Purge)</span>
            </div>
          </div>

          {/* Organize & Convert */}
          <div>
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3.5">Organize & Convert</h4>
            <ul className="space-y-2.5 text-xs">
              <li><Link href="/merge-pdf" className="hover:text-indigo-400 transition">Merge PDF</Link></li>
              <li><Link href="/split-pdf" className="hover:text-indigo-400 transition">Split PDF</Link></li>
              <li><Link href="/compress-pdf" className="hover:text-indigo-400 transition">Compress PDF</Link></li>
              <li><Link href="/pdf-to-word" className="hover:text-indigo-400 transition">PDF to Word</Link></li>
              <li><Link href="/word-to-pdf" className="hover:text-indigo-400 transition">Word to PDF</Link></li>
              <li><Link href="/pdf-to-excel" className="hover:text-indigo-400 transition">PDF to Excel</Link></li>
            </ul>
          </div>

          {/* Security & Tools */}
          <div>
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3.5">Security & Tools</h4>
            <ul className="space-y-2.5 text-xs">
              <li><Link href="/protect-pdf" className="hover:text-indigo-400 transition">Protect PDF</Link></li>
              <li><Link href="/unlock-pdf" className="hover:text-indigo-400 transition">Unlock PDF</Link></li>
              <li><Link href="/sign-pdf" className="hover:text-indigo-400 transition">Sign PDF</Link></li>
              <li><Link href="/redact-pdf" className="hover:text-indigo-400 transition">Redact PDF</Link></li>
              <li><Link href="/add-watermark" className="hover:text-indigo-400 transition">Add Watermark</Link></li>
              <li><Link href="/indian-language-documents" className="hover:text-indigo-400 transition">Indian Language OCR</Link></li>
            </ul>
          </div>

          {/* Company & Legal */}
          <div>
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3.5">Company & Legal</h4>
            <ul className="space-y-2.5 text-xs">
              <li><Link href="/about" className="hover:text-indigo-400 transition font-semibold text-slate-300">About Us</Link></li>
              <li><Link href="/privacy" className="hover:text-indigo-400 transition font-semibold text-slate-300">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-indigo-400 transition font-semibold text-slate-300">Terms of Service</Link></li>
              <li><Link href="/cookies" className="hover:text-indigo-400 transition font-semibold text-slate-300">Cookie Policy</Link></li>
              <li><Link href="/contact" className="hover:text-indigo-400 transition">Contact Support</Link></li>
              <li><Link href="/pricing" className="hover:text-indigo-400 transition">Pricing & Plans</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright & SEO links */}
        <div className="pt-6 sm:pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3 sm:gap-4">
          <p>© {new Date().getFullYear()} DocFlow SaaS Inc. All rights reserved.</p>
          <div className="flex items-center gap-4 text-[11px]">
            <Link href="/sitemap.xml" className="hover:text-slate-400 transition">Sitemap</Link>
            <span>•</span>
            <Link href="/robots.txt" className="hover:text-slate-400 transition">Robots.txt</Link>
            <span>•</span>
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              100% Private & Secure
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
