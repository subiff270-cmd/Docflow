"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { createRazorpayOrder, verifyRazorpayPayment } from "../../lib/api";
import { Check, Zap, Shield, Sparkles, AlertCircle, Crown } from "lucide-react";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function PricingPage() {
  const { user, profile, openAuthModal, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleSubscribe = async (plan: "PRO_MONTHLY" | "PRO_YEARLY") => {
    if (!user) {
      openAuthModal();
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const res = await loadRazorpayScript();
    if (!res) {
      setError("Razorpay SDK failed to load. Check your internet connection.");
      setLoading(false);
      return;
    }

    try {
      const orderData = await createRazorpayOrder(plan, user.uid);

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "DocFlow SaaS",
        description: `Upgrade to ${plan === "PRO_MONTHLY" ? "Pro Monthly (₹99/mo)" : "Pro Yearly (₹999/yr)"}`,
        order_id: orderData.order_id,
        handler: async function (response: any) {
          try {
            const verifyRes = await verifyRazorpayPayment(
              {
                razorpay_order_id: response.razorpay_order_id || orderData.order_id,
                razorpay_payment_id: response.razorpay_payment_id || `pay_mock_${Date.now()}`,
                razorpay_signature: response.razorpay_signature || `sig_mock_${Date.now()}`,
                plan: plan,
              },
              user.uid
            );

            setSuccessMsg("Payment verified! Your account is now upgraded to PRO.");
            if (refreshProfile) await refreshProfile();
          } catch (err: any) {
            setError(err.message || "Payment verification failed.");
          }
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          },
        },
        prefill: {
          email: user.email || "",
          name: user.displayName || "DocFlow User",
        },
        theme: {
          color: "#4f46e5",
        },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.on("payment.failed", function (response: any) {
        const desc = response.error?.description || "Payment failed. Please try a different payment method.";
        setError(desc);
      });
      paymentObject.open();
    } catch (err: any) {
      setError(err.message || "Unable to initiate payment.");
    } finally {
      setLoading(false);
    }
  };

  const isPro = profile?.plan === "PRO" || profile?.plan === "PRO_MONTHLY" || profile?.plan === "PRO_YEARLY";
  const isMonthly = profile?.plan === "PRO_MONTHLY" || profile?.plan === "PRO";
  const isYearly = profile?.plan === "PRO_YEARLY";

  return (
    <div className="max-w-7xl mx-auto py-8 sm:py-12 px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-12">
      {/* Active Pro Member Hero Card */}
      {isPro ? (
        <div className="bg-gradient-to-r from-indigo-900 via-violet-900 to-slate-950 text-white rounded-3xl p-6 sm:p-10 shadow-2xl border border-indigo-500/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-3 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/20 border border-amber-400/30 text-amber-300 text-xs font-black uppercase tracking-wider">
                <Crown className="w-4 h-4 text-amber-400" />
                <span>DocFlow Pro Active Member</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
                You have Unlimited Pro Access!
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm max-w-xl leading-relaxed">
                Enjoy 500 MB file uploads, multi-core parallel rendering, instant client-side tools, and completely ad-free unlimited document workflows.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Link
                href="/dashboard"
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs backdrop-blur-md border border-white/20 transition flex items-center justify-center gap-2"
              >
                View Dashboard
              </Link>
              <Link
                href="/"
                className="px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-amber-400/20 transition flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4 fill-slate-950" />
                Launch Tools
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3.5 py-1.5 rounded-full uppercase tracking-wider">
            SIMPLE TRANSPARENT PRICING
          </span>
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-950 tracking-tight">
            Unlock Unlimited Document Processing
          </h1>
          <p className="text-slate-600 text-sm sm:text-base font-medium">
            Choose the plan that fits your document needs. Upgrade anytime with secure Razorpay payments.
          </p>
        </div>
      )}

      {error && (
        <div className="max-w-md mx-auto p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="max-w-md mx-auto p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 text-xs flex items-center gap-2">
          <Sparkles className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
        {/* FREE PLAN */}
        <div className={`bg-white rounded-2xl sm:rounded-3xl border ${!isPro ? "border-indigo-200 shadow-md ring-2 ring-indigo-500/10" : "border-slate-200"} p-6 sm:p-8 shadow-sm flex flex-col justify-between space-y-6`}>
          <div className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">FREE PLAN</span>
            <div className="text-3xl sm:text-4xl font-black text-slate-900">₹0</div>
            <p className="text-xs text-slate-500">Perfect for light personal document processing.</p>
            <ul className="space-y-3 pt-4 text-xs font-medium text-slate-700">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                10 free conversions per day (Resets daily)
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                25 MB maximum file size limit
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                Access to all 34+ document tools
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                30-minute private retention auto-purge
              </li>
            </ul>
          </div>

          <button
            disabled
            className="w-full py-3 bg-slate-100 text-slate-500 font-bold rounded-xl text-xs cursor-default"
          >
            {!isPro ? "Current Plan" : "Basic Free Tier"}
          </button>
        </div>

        {/* PRO MONTHLY */}
        <div className={`bg-gradient-to-b from-indigo-950 via-slate-900 to-slate-950 text-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl relative flex flex-col justify-between space-y-6 border ${isMonthly ? "border-emerald-400 ring-2 ring-emerald-400/30" : "border-indigo-500/30"}`}>
          {isMonthly ? (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-400 text-slate-950 text-[10px] font-black px-3.5 py-1 rounded-full uppercase tracking-wider shadow-md flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>YOUR ACTIVE PLAN</span>
            </div>
          ) : (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-950 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-md">
              MOST POPULAR
            </div>
          )}

          <div className="space-y-4 pt-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">PRO MONTHLY</span>
            <div className="text-3xl sm:text-4xl font-black">
              ₹99 <span className="text-xs font-semibold text-slate-400">/ month</span>
            </div>
            <p className="text-xs text-slate-300">Unlimited operations for power users.</p>
            <ul className="space-y-3 pt-4 text-xs font-medium text-slate-200">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-400" />
                <strong>Unlimited conversions & splits</strong>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-400" />
                500 MB max file size limit
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-400" />
                No advertisements (AdSense disabled)
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-400" />
                High speed document processing
              </li>
            </ul>
          </div>

          {isMonthly ? (
            <button
              disabled
              className="w-full py-3.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-bold rounded-xl text-xs cursor-default flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4 text-emerald-400" />
              Active Subscription
            </button>
          ) : (
            <button
              onClick={() => handleSubscribe("PRO_MONTHLY")}
              disabled={loading}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-500/30 transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Zap className="w-4 h-4 text-amber-400" />
                  {isPro ? "Switch to Monthly (₹99)" : "Upgrade to Pro Monthly (₹99)"}
                </>
              )}
            </button>
          )}
        </div>

        {/* PRO YEARLY */}
        <div className={`bg-white rounded-2xl sm:rounded-3xl border ${isYearly ? "border-emerald-500 ring-2 ring-emerald-500/30" : "border-slate-200"} p-6 sm:p-8 shadow-sm flex flex-col justify-between space-y-6 relative`}>
          {isYearly && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] font-black px-3.5 py-1 rounded-full uppercase tracking-wider shadow-md flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>YOUR ACTIVE PLAN</span>
            </div>
          )}

          <div className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">PRO YEARLY</span>
            <div className="text-3xl sm:text-4xl font-black text-slate-900">
              ₹999 <span className="text-xs font-semibold text-slate-500">/ year</span>
            </div>
            <p className="text-xs text-slate-500">Save 16% annually compared to monthly billing.</p>
            <ul className="space-y-3 pt-4 text-xs font-medium text-slate-700">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                <strong>Unlimited conversions for a full year</strong>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                500 MB max file size limit
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                No advertisements
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                Priority customer support
              </li>
            </ul>
          </div>

          {isYearly ? (
            <button
              disabled
              className="w-full py-3.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold rounded-xl text-xs cursor-default flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4 text-emerald-600" />
              Active Yearly Plan
            </button>
          ) : (
            <button
              onClick={() => handleSubscribe("PRO_YEARLY")}
              disabled={loading}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              {isMonthly ? "Upgrade to Yearly (Save 16%)" : "Get Pro Yearly (₹999/yr)"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
