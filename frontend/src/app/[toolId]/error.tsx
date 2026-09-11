"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";

export default function ToolError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Nexdoc Tool Route Error:", error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/80 shadow-xl p-6 sm:p-8 text-center space-y-5">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
          <AlertCircle className="w-6 h-6" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            Tool Failed to Load
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            Something went wrong while loading this tool. Please refresh the page or try again.
          </p>
        </div>

        {error?.message && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 font-mono text-left break-all line-clamp-3">
            {error.message}
          </div>
        )}

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-md shadow-indigo-500/20 active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Tool
          </button>

          <Link
            href="/"
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Tools
          </Link>
        </div>
      </div>
    </div>
  );
}
