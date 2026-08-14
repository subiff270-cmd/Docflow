"use client";

import React, { useState } from "react";
import Link from "next/link";
import { TOOLS, ToolItem } from "../lib/toolsData";
import { Search, X, ArrowRight, FileText } from "lucide-react";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");

  if (!isOpen) return null;

  const filteredTools = TOOLS.filter((tool) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      tool.name.toLowerCase().includes(q) ||
      tool.category.toLowerCase().includes(q) ||
      tool.description.toLowerCase().includes(q) ||
      tool.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Search Bar Input */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <Search className="w-5 h-5 text-indigo-600" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools (e.g., 'convert pdf to word', 'compress', 'merge', 'voice', 'ocr')..."
            className="w-full text-base font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-4 space-y-2">
          {filteredTools.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              No tools matching "<strong className="text-slate-700">{query}</strong>"
            </div>
          ) : (
            filteredTools.map((tool) => (
              <Link
                key={tool.id}
                href={tool.href}
                onClick={onClose}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-indigo-50/70 border border-transparent hover:border-indigo-100 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition">
                      {tool.name}
                    </h4>
                    <p className="text-xs text-slate-500 line-clamp-1">{tool.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase">
                    {tool.category}
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition" />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
