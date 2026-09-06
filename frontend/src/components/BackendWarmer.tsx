"use client";

import { useEffect } from "react";

export default function BackendWarmer() {
  useEffect(() => {
    // Silently pre-warm the backend connection in the background
    const warmBackend = () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://docflow-backend-8rwy.onrender.com";
        fetch(`${apiUrl}/health`, { method: "GET", keepalive: true }).catch(() => {});
      } catch (_) {}
    };

    warmBackend();
    const interval = setInterval(warmBackend, 4 * 60 * 1000); // Ping every 4 mins while user is browsing
    return () => clearInterval(interval);
  }, []);

  return null;
}
