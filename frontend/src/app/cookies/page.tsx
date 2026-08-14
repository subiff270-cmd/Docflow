"use client";

import React from "react";
import Link from "next/link";

export default function CookiePolicyPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Page Header */}
      <div className="border-b border-slate-200 pb-6 space-y-2">
        <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">COOKIE COMPLIANCE</span>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-950">Cookie Policy</h1>
        <p className="text-xs text-slate-500 font-medium">Last updated: August 13, 2026</p>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-sm space-y-8 text-xs sm:text-sm text-slate-700 leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">1. What Are Cookies?</h2>
          <p>
            Cookies are small text files placed on your computer or mobile device when you visit websites. They are widely used to make websites work efficiently, store user preferences, provide secure authentication, and supply reporting information to advertisers.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">2. Types of Cookies We Use</h2>
          <div className="space-y-4">
            <div>
              <h4 className="font-bold text-slate-900">Essential Technical Cookies</h4>
              <p className="text-slate-600">Necessary for the website to function. They handle Firebase Authentication states, session security tokens, and quota tracking.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900">Google AdSense & Advertising Cookies</h4>
              <p className="text-slate-600">Google uses cookies (including the DoubleClick cookie) to serve ads based on user visits to this and other websites. These cookies allow Google to customize advertisements relevant to your interests.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900">Performance & Analytics Cookies</h4>
              <p className="text-slate-600">Help us measure visitor traffic patterns and application usage to continuously improve site speed and tool responsiveness.</p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">3. How to Control & Opt-Out of Cookies</h2>
          <p>
            You have the right to decide whether to accept or reject cookies:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-slate-600">
            <li><strong>Browser Settings:</strong> You can set your browser to refuse or delete cookies. Refer to your browser's help menu (Chrome, Firefox, Safari, Edge) for instructions.</li>
            <li><strong>Google Ad Opt-Out:</strong> Opt out of personalized advertising by visiting <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-semibold">Google Ads Settings</a>.</li>
          </ul>
        </section>

        <section className="space-y-3 border-t border-slate-100 pt-6">
          <h2 className="text-base font-bold text-slate-900">4. Contact Information</h2>
          <p>
            For questions about our Cookie Policy, reach out to our privacy officer at <a href="mailto:support.docflow@gmail.com" className="text-indigo-600 font-bold underline">support.docflow@gmail.com</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
