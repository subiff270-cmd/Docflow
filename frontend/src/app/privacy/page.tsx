"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, Lock, CheckCircle2 } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Page Header */}
      <div className="border-b border-slate-200 pb-6 space-y-2">
        <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">LEGAL COMPLIANCE</span>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-950">Privacy Policy</h1>
        <p className="text-xs text-slate-500 font-medium">Last updated: August 13, 2026</p>
      </div>

      {/* Main Legal Content */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-sm space-y-8 text-xs sm:text-sm text-slate-700 leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">1. Introduction</h2>
          <p>
            DocFlow ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website <strong>DocFlow</strong> (the "Site") and utilize our online document tools, including PDF conversion, merging, compression, OCR, voice-to-document, and editing services.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">2. Document Files & Auto-Purge Policy</h2>
          <p>
            We prioritize the absolute security of your documents:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li><strong>No Permanent Storage:</strong> Files uploaded to DocFlow are stored temporarily in isolated server storage solely to process your requested operations (e.g. merge, split, convert).</li>
            <li><strong>Automated 30-Minute Purge:</strong> All uploaded files and processed output documents are automatically and permanently deleted from our servers after 30 minutes via automated background cleanup services.</li>
            <li><strong>No Content Inspection:</strong> We do not read, view, copy, share, or sell the contents of your uploaded documents.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">3. Information We Collect</h2>
          <p>
            When you interact with DocFlow, we may collect minimal necessary information:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li><strong>Account Data:</strong> If you register or log in via Firebase Authentication (Email/Password or Google Sign-In), we store your email address and display name.</li>
            <li><strong>Usage & Conversion Stats:</strong> Number of conversions completed, quota usage, and timestamps to enforce subscription tier limits.</li>
            <li><strong>Technical Log Data:</strong> Internet Protocol (IP) address, browser type, operating system, referring URLs, and pages viewed.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">4. Google AdSense & Third-Party Advertising Cookies</h2>
          <p>
            DocFlow uses Google AdSense to serve advertisements on our website:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-slate-600">
            <li>
              <strong>Third Party Vendors:</strong> Third-party vendors, including Google, use cookies to serve ads based on a user's prior visits to DocFlow or other websites.
            </li>
            <li>
              <strong>DoubleClick Cookie:</strong> Google's use of advertising cookies enables it and its partners to serve ads to users based on their visit to DocFlow and/or other sites on the Internet.
            </li>
            <li>
              <strong>Opt-Out Options:</strong> Users may opt out of personalized advertising by visiting <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-semibold">Google Ads Settings</a>. Alternatively, users can opt out of third-party vendor's use of cookies for personalized advertising by visiting <a href="https://www.aboutads.info" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-semibold">aboutads.info</a>.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">5. Cookies & Tracking Technologies</h2>
          <p>
            We use cookies and similar session tokens to:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>Maintain user authentication states across sessions.</li>
            <li>Remember preferences and quota tracking.</li>
            <li>Analyze web traffic patterns and optimize site speed.</li>
          </ul>
          <p>
            You can configure your browser to decline all cookies or notify you when a cookie is sent. However, some site features (such as user login) may not function properly without cookies.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">6. Data Security</h2>
          <p>
            We employ administrative, technical, and physical security measures (including HTTPS SSL encryption, AES-256 data protection, and isolated API containers) to protect your personal information and documents. While we take every reasonable precaution, no Internet transmission is 100% immune from security threats.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">7. Your Data Rights (GDPR & CCPA)</h2>
          <p>
            Depending on your location, you have rights regarding your personal data:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>The right to access, update, or delete the personal account information we hold about you.</li>
            <li>The right to withdraw consent for direct marketing communications.</li>
            <li>The right to request account closure.</li>
          </ul>
          <p>
            To exercise any of these rights, contact us at <a href="mailto:support.docflow@gmail.com" className="text-indigo-600 font-bold underline">support.docflow@gmail.com</a>.
          </p>
        </section>

        <section className="space-y-3 border-t border-slate-100 pt-6">
          <h2 className="text-base font-bold text-slate-900">8. Contact Us</h2>
          <p>
            If you have any questions or concerns regarding this Privacy Policy, please contact our privacy compliance team:
          </p>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 font-mono text-xs space-y-1 text-slate-700">
            <div><strong>Entity:</strong> DocFlow SaaS Inc.</div>
            <div><strong>Support Email:</strong> support.docflow@gmail.com</div>
            <div><strong>Website:</strong> <Link href="/contact" className="text-indigo-600 underline">https://docflow.com/contact</Link></div>
          </div>
        </section>
      </div>
    </div>
  );
}
