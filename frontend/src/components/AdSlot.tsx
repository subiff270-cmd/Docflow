"use client";

import React from "react";
import { useAuth } from "../context/AuthContext";

interface AdSlotProps {
  format?: "banner" | "rectangle" | "vertical";
}

export default function AdSlot({ format = "banner" }: AdSlotProps) {
  const { profile } = useAuth();

  // Pro users see NO advertisements
  if (profile && profile.plan !== "FREE") {
    return null;
  }

  return (
    <div className="my-6 max-w-4xl mx-auto p-4 bg-slate-100/70 border border-slate-200/80 rounded-2xl text-center">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Advertisement</div>
      <div className="h-20 bg-slate-200/60 rounded-xl flex items-center justify-center text-slate-400 text-xs font-semibold border border-dashed border-slate-300">
        Google AdSense Placeholder Slot (Disabled for Pro Users)
      </div>
    </div>
  );
}
