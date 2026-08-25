"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import {
  FileText,
  ChevronDown,
  ChevronRight,
  User,
  LogOut,
  LayoutDashboard,
  CreditCard,
  Menu,
  X
} from "lucide-react";

export default function Navbar() {
  const { user, profile, openAuthModal, signOut } = useAuth();
  const pathname = usePathname();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);

  const closeMobile = () => {
    setIsMobileMenuOpen(false);
    setMobileExpanded(null);
  };

  const toggleMobileSection = (section: string) => {
    setMobileExpanded(mobileExpanded === section ? null : section);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm shadow-slate-100/50 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 sm:gap-3 group" onClick={closeMobile}>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 group-hover:shadow-indigo-500/50 group-hover:shadow-xl group-hover:scale-105 transition-all duration-300">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">DocFlow</span>
          </Link>

          {/* Center Navigation Links - Desktop Only */}
          <nav className="hidden lg:flex items-center gap-1 font-semibold text-sm text-slate-700">
            <Link
              href="/"
              className={`px-3.5 py-2 rounded-lg transition ${
                pathname === "/" ? "text-indigo-600 font-bold" : "hover:text-indigo-600"
              }`}
            >
              All Tools
            </Link>

            {/* Convert PDF Dropdown */}
            <div className="relative group" onMouseLeave={() => setActiveDropdown(null)}>
              <button
                onMouseEnter={() => setActiveDropdown("convert")}
                className="px-3.5 py-2 rounded-lg hover:text-indigo-600 flex items-center gap-1 transition"
              >
                Convert PDF
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
              {activeDropdown === "convert" && (
                <div className="absolute top-full left-0 w-64 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-indigo-500/5 border border-indigo-100/50 p-3 space-y-1 z-50 animate-in fade-in">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1">CONVERT TO PDF</div>
                  <Link href="/word-to-pdf" className="block px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg">Word to PDF</Link>
                  <Link href="/jpg-to-pdf" className="block px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg">JPG to PDF</Link>
                  <Link href="/ppt-to-pdf" className="block px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg">PowerPoint to PDF</Link>
                  <Link href="/excel-to-pdf" className="block px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg">Excel to PDF</Link>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1 pt-2 border-t border-slate-100">CONVERT FROM PDF</div>
                  <Link href="/pdf-to-word" className="block px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg">PDF to Word</Link>
                  <Link href="/pdf-to-jpg" className="block px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg">PDF to JPG</Link>
                  <Link href="/pdf-to-excel" className="block px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg">PDF to Excel</Link>
                </div>
              )}
            </div>

            {/* PDF Tools Dropdown */}
            <div className="relative group" onMouseLeave={() => setActiveDropdown(null)}>
              <button
                onMouseEnter={() => setActiveDropdown("pdf")}
                className="px-3.5 py-2 rounded-lg hover:text-indigo-600 flex items-center gap-1 transition"
              >
                PDF Tools
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
              {activeDropdown === "pdf" && (
                <div className="absolute top-full left-0 w-64 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-indigo-500/5 border border-indigo-100/50 p-3 space-y-1 z-50 animate-in fade-in">
                  <Link href="/merge-pdf" className="block px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg">Merge PDF</Link>
                  <Link href="/split-pdf" className="block px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg">Split PDF</Link>
                  <Link href="/compress-pdf" className="block px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg">Compress PDF</Link>
                  <Link href="/organize-pdf" className="block px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg">Organize PDF</Link>
                  <Link href="/protect-pdf" className="block px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg">Protect PDF</Link>
                  <Link href="/sign-pdf" className="block px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg">Sign PDF</Link>
                  <Link href="/redact-pdf" className="block px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg">Redact PDF</Link>
                </div>
              )}
            </div>

            {/* OCR Tools Dropdown */}
            <div className="relative group" onMouseLeave={() => setActiveDropdown(null)}>
              <button
                onMouseEnter={() => setActiveDropdown("ocr")}
                className="px-3.5 py-2 rounded-lg hover:text-indigo-600 flex items-center gap-1 transition"
              >
                OCR Tools
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
              {activeDropdown === "ocr" && (
                <div className="absolute top-full left-0 w-64 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-indigo-500/5 border border-indigo-100/50 p-3 space-y-1 z-50 animate-in fade-in">
                  <Link href="/ocr-pdf" className="block px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg">OCR PDF</Link>
                  <Link href="/indian-language-documents" className="block px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg">Indian Language Documents</Link>
                  <Link href="/image-to-text" className="block px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg">Image to Text</Link>
                </div>
              )}
            </div>

            <Link
              href="/pricing"
              className={`px-3.5 py-2 rounded-lg transition ${
                pathname === "/pricing" ? "text-indigo-600 font-bold" : "hover:text-indigo-600"
              }`}
            >
              Pricing
            </Link>

            <Link
              href="/about"
              className={`px-3.5 py-2 rounded-lg transition ${
                pathname === "/about" ? "text-indigo-600 font-bold" : "hover:text-indigo-600"
              }`}
            >
              About
            </Link>

            <Link
              href="/contact"
              className={`px-3.5 py-2 rounded-lg transition ${
                pathname === "/contact"
                  ? "border border-slate-900 text-slate-900 font-bold"
                  : "hover:text-indigo-600"
              }`}
            >
              Contact
            </Link>
          </nav>

          {/* Right Buttons */}
          <div className="flex items-center gap-2 sm:gap-4">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center gap-1.5 sm:gap-2 p-1 sm:p-1.5 rounded-full hover:bg-slate-100 border border-slate-200 transition"
                >
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                    {user.displayName ? user.displayName[0].toUpperCase() : user.email ? user.email[0].toUpperCase() : "U"}
                  </div>
                  {profile && profile.plan !== "FREE" && (
                    <span className="hidden sm:inline bg-amber-400 text-slate-900 font-extrabold text-[10px] px-2 py-0.5 rounded-full uppercase">
                      PRO
                    </span>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 mr-0.5 sm:mr-1" />
                </button>

                {isProfileMenuOpen && (
                  <div
                    onClick={() => setIsProfileMenuOpen(false)}
                    className="fixed inset-0 z-40 lg:hidden"
                  />
                )}
                {isProfileMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-indigo-500/5 border border-slate-200/60 p-2 z-50 animate-in fade-in"
                  >
                    <div className="px-3 py-2 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-900 truncate">{user.displayName || "Account"}</p>
                      <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                    </div>
                    <Link
                      href="/dashboard"
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      Dashboard
                    </Link>
                    <Link
                      href="/pricing"
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition"
                    >
                      <CreditCard className="w-4 h-4" />
                      Subscription & Plan
                    </Link>
                    <button
                      onClick={() => { setIsProfileMenuOpen(false); signOut(); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition mt-1"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={openAuthModal}
                  className="hidden sm:block text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-all duration-300 px-3 py-1.5 rounded-lg hover:bg-indigo-50/50"
                >
                  Sign In
                </button>
                <button
                  onClick={openAuthModal}
                  className="px-4 sm:px-6 py-2 sm:py-2.5 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 hover:from-indigo-500 hover:via-violet-500 hover:to-indigo-600 text-white rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-violet-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300"
                >
                  Get Started
                </button>
              </div>
            )}

            {/* Mobile Menu Trigger */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Full-Screen Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-16 sm:top-20 z-30 bg-white overflow-y-auto animate-slide-up">
          <div className="px-5 py-6 space-y-1">
            {/* All Tools */}
            <Link href="/" onClick={closeMobile} className="flex items-center justify-between px-4 py-3.5 text-sm font-bold text-slate-900 hover:bg-indigo-50 rounded-xl transition">
              All Tools
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>

            {/* Convert PDF Section */}
            <div>
              <button
                onClick={() => toggleMobileSection("convert")}
                className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-bold text-slate-900 hover:bg-indigo-50 rounded-xl transition"
              >
                Convert PDF
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${mobileExpanded === "convert" ? "rotate-180" : ""}`} />
              </button>
              {mobileExpanded === "convert" && (
                <div className="pl-6 space-y-0.5 pb-2 animate-in">
                  <Link href="/word-to-pdf" onClick={closeMobile} className="block px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 rounded-lg">Word to PDF</Link>
                  <Link href="/jpg-to-pdf" onClick={closeMobile} className="block px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 rounded-lg">JPG to PDF</Link>
                  <Link href="/ppt-to-pdf" onClick={closeMobile} className="block px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 rounded-lg">PowerPoint to PDF</Link>
                  <Link href="/excel-to-pdf" onClick={closeMobile} className="block px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 rounded-lg">Excel to PDF</Link>
                  <div className="border-t border-slate-100 mx-4 my-1" />
                  <Link href="/pdf-to-word" onClick={closeMobile} className="block px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 rounded-lg">PDF to Word</Link>
                  <Link href="/pdf-to-jpg" onClick={closeMobile} className="block px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 rounded-lg">PDF to JPG</Link>
                  <Link href="/pdf-to-excel" onClick={closeMobile} className="block px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 rounded-lg">PDF to Excel</Link>
                </div>
              )}
            </div>

            {/* PDF Tools Section */}
            <div>
              <button
                onClick={() => toggleMobileSection("pdf")}
                className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-bold text-slate-900 hover:bg-indigo-50 rounded-xl transition"
              >
                PDF Tools
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${mobileExpanded === "pdf" ? "rotate-180" : ""}`} />
              </button>
              {mobileExpanded === "pdf" && (
                <div className="pl-6 space-y-0.5 pb-2 animate-in">
                  <Link href="/merge-pdf" onClick={closeMobile} className="block px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 rounded-lg">Merge PDF</Link>
                  <Link href="/split-pdf" onClick={closeMobile} className="block px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 rounded-lg">Split PDF</Link>
                  <Link href="/compress-pdf" onClick={closeMobile} className="block px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 rounded-lg">Compress PDF</Link>
                  <Link href="/organize-pdf" onClick={closeMobile} className="block px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 rounded-lg">Organize PDF</Link>
                  <Link href="/protect-pdf" onClick={closeMobile} className="block px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 rounded-lg">Protect PDF</Link>
                  <Link href="/sign-pdf" onClick={closeMobile} className="block px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 rounded-lg">Sign PDF</Link>
                  <Link href="/redact-pdf" onClick={closeMobile} className="block px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 rounded-lg">Redact PDF</Link>
                </div>
              )}
            </div>

            {/* OCR Tools Section */}
            <div>
              <button
                onClick={() => toggleMobileSection("ocr")}
                className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-bold text-slate-900 hover:bg-indigo-50 rounded-xl transition"
              >
                OCR Tools
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${mobileExpanded === "ocr" ? "rotate-180" : ""}`} />
              </button>
              {mobileExpanded === "ocr" && (
                <div className="pl-6 space-y-0.5 pb-2 animate-in">
                  <Link href="/ocr-pdf" onClick={closeMobile} className="block px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 rounded-lg">OCR PDF</Link>
                  <Link href="/indian-language-documents" onClick={closeMobile} className="block px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 rounded-lg">Indian Language Documents</Link>
                  <Link href="/image-to-text" onClick={closeMobile} className="block px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 rounded-lg">Image to Text</Link>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 my-3" />

            {/* Direct Links */}
            <Link href="/pricing" onClick={closeMobile} className="flex items-center justify-between px-4 py-3.5 text-sm font-bold text-indigo-600 hover:bg-indigo-50 rounded-xl transition">
              Pricing
              <ChevronRight className="w-4 h-4 text-indigo-400" />
            </Link>
            <Link href="/contact" onClick={closeMobile} className="flex items-center justify-between px-4 py-3.5 text-sm font-bold text-slate-900 hover:bg-indigo-50 rounded-xl transition">
              Contact
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>
            <Link href="/dashboard" onClick={closeMobile} className="flex items-center justify-between px-4 py-3.5 text-sm font-bold text-slate-900 hover:bg-indigo-50 rounded-xl transition">
              Dashboard
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>

            {/* Mobile Auth Buttons */}
            {!user && (
              <div className="pt-4 space-y-3">
                <button
                  onClick={() => { closeMobile(); openAuthModal(); }}
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 hover:from-indigo-500 hover:via-violet-500 hover:to-indigo-600 text-white font-bold rounded-xl text-sm shadow-lg shadow-indigo-500/30 transition"
                >
                  Get Started — It's Free
                </button>
                <button
                  onClick={() => { closeMobile(); openAuthModal(); }}
                  className="w-full py-3 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl text-sm hover:bg-slate-50 transition"
                >
                  Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
