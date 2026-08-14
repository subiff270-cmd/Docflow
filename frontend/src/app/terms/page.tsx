"use client";

import React from "react";
import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Page Header */}
      <div className="border-b border-slate-200 pb-6 space-y-2">
        <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">TERMS OF SERVICE</span>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-950">Terms of Service</h1>
        <p className="text-xs text-slate-500 font-medium">Last updated: August 13, 2026</p>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-sm space-y-8 text-xs sm:text-sm text-slate-700 leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">1. Agreement to Terms</h2>
          <p>
            By accessing or using the DocFlow SaaS platform ("DocFlow", "Service"), accessible from our website, you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you are prohibited from using our services.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">2. Use of Services & Account Responsibilities</h2>
          <p>
            DocFlow grants you a non-exclusive, non-transferable, revocable license to access and use our document processing tools in accordance with these Terms:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li><strong>Permitted Files:</strong> You may only upload document and image files that you own or have explicit legal authority to process.</li>
            <li><strong>Prohibited Content:</strong> You agree not to upload files containing malware, viruses, illegal material, or content that infringes upon third-party intellectual property or copyright laws.</li>
            <li><strong>Account Security:</strong> You are responsible for safeguarding your login credentials and for all activities that occur under your account.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">3. Subscription Tiers & Payment Terms</h2>
          <ul className="list-disc pl-5 space-y-2 text-slate-600">
            <li><strong>Free Tier:</strong> Free accounts are subject to quota limits (10 successful conversions per 30-day period) and a maximum file upload size of 25 MB.</li>
            <li><strong>Pro Monthly & Pro Yearly Plans:</strong> Paid subscriptions unlock unlimited document processing and 500 MB file upload limits. Payments are processed securely via Razorpay.</li>
            <li><strong>Refund Policy:</strong> If you experience technical failures with paid conversions, contact our support team within 7 days for review.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">4. Intellectual Property & Document Ownership</h2>
          <p>
            DocFlow claims <strong>zero ownership rights</strong> over the files, text, images, or documents you upload to our platform. All title, ownership, and intellectual property rights in your uploaded documents remain strictly with you.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">5. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, DocFlow SaaS Inc. shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, data, or content resulting from your access to or inability to access our services.
          </p>
        </section>

        <section className="space-y-3 border-t border-slate-100 pt-6">
          <h2 className="text-base font-bold text-slate-900">6. Governing Law & Contact</h2>
          <p>
            These Terms shall be governed by and construed in accordance with standard international software agreements. Questions regarding these Terms should be sent to <a href="mailto:support.docflow@gmail.com" className="text-indigo-600 font-bold underline">support.docflow@gmail.com</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
