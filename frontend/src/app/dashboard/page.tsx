"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { fetchUserHistory, getDownloadUrl } from "../../lib/api";
import {
  LayoutDashboard,
  Zap,
  Clock,
  FileText,
  Download,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight
} from "lucide-react";

export default function DashboardPage() {
  const { user, profile, openAuthModal, refreshProfile } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserHistory(user.uid)
        .then((data) => setHistory(data))
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
      if (refreshProfile) refreshProfile();
    } else {
      setLoading(false);
    }
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 bg-white rounded-3xl shadow-xl text-center space-y-4 border border-slate-100">
        <LayoutDashboard className="w-12 h-12 text-indigo-600 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">Account Dashboard</h2>
        <p className="text-xs text-slate-500">Log in to view your real account statistics, quota, and conversion history.</p>
        <button
          onClick={openAuthModal}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition"
        >
          Sign In or Register
        </button>
      </div>
    );
  }

  const isPro = profile?.plan !== "FREE";
  const usagePercentage = isPro ? 0 : Math.min(100, ((profile?.period_usage || 0) / 10) * 100);

  return (
    <div className="max-w-7xl mx-auto py-6 sm:py-10 px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
      {/* Top Welcome Header */}
      <div className="flex flex-col gap-4 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">USER DASHBOARD</span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            Welcome back, {user.displayName || user.email?.split("@")[0] || "User"}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {user.email ? user.email : "Manage your document conversions, subscription, and activity history."}
          </p>
        </div>

        <Link
          href="/pricing"
          className={`px-4 sm:px-5 py-2.5 rounded-xl sm:rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition w-full sm:w-auto ${
            isPro
              ? "bg-slate-900 text-amber-400 border border-slate-800"
              : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20"
          }`}
        >
          <Zap className="w-4 h-4 text-amber-400" />
          {isPro ? "Current Plan: PRO" : "Upgrade to Unlimited Pro"}
        </Link>
      </div>

      {/* Real Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
        {/* Total Conversions */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total Conversions</span>
            <FileText className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{profile?.total_conversions ?? 0}</div>
          <p className="text-[11px] text-slate-500">Only successfully completed operations counted.</p>
        </div>

        {/* Usage Quota */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">30-Day Usage Quota</span>
            <Clock className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">
            {isPro ? "Unlimited" : `${profile?.period_usage ?? 0} / 10`}
          </div>

          {!isPro && (
            <div className="space-y-1">
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full transition-all"
                  style={{ width: `${usagePercentage}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 flex justify-between">
                <span>Resets in {profile?.days_until_reset ?? 30} days</span>
                <span>Max size: 25 MB</span>
              </p>
            </div>
          )}
        </div>

        {/* Plan Status */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Subscription Status</span>
            <CreditCard className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-2 flex-wrap">
            {profile?.plan || "FREE"}
            {isPro && <span className="text-xs bg-amber-400 text-slate-900 px-2 py-0.5 rounded-full font-bold">ACTIVE</span>}
          </div>
          <p className="text-[11px] text-slate-500">
            {isPro ? "Unlimited conversions & 500 MB file limit." : "Free tier limited to 10 conversions per 30 days."}
          </p>
        </div>
      </div>

      {/* Conversion History Table */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Recent Conversion Activity</h3>
          <span className="text-xs font-semibold text-slate-400">{history.length} operations</span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-400 text-xs">Loading activity history...</div>
        ) : history.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No conversion history yet. Try converting or processing a document!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-3">Filename</th>
                  <th className="py-3 px-3">Tool</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3 text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3 font-semibold text-slate-800 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="truncate max-w-xs">{item.filename}</span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-600">{item.tool}</td>
                    <td className="py-3 px-3">
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-400">{new Date(item.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-3 text-right">
                      {item.download_key ? (
                        <a
                          href={getDownloadUrl(item.download_key)}
                          download={item.filename}
                          className="inline-flex items-center gap-1 text-indigo-600 font-bold hover:underline"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </a>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
