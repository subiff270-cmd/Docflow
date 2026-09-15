# PRODUCTION MONITORING GUIDE — NEXDOC / DOCFLOW

This document outlines the monitoring architecture, health check endpoints, and alert procedures for the Nexdoc document processing SaaS platform.

---

## 1. System Health & Readiness Probes

The backend exposes dedicated probes for load balancers, uptime monitors, and Kubernetes/container health checks:

### Liveness Probe: `GET /health`
- **URL**: `https://docflow-backend-8rwy.onrender.com/health`
- **Response**: `{"status": "healthy"}`
- **Purpose**: Quick ping to verify the web server process is accepting TCP traffic.

### Readiness Probe: `GET /ready`
- **URL**: `https://docflow-backend-8rwy.onrender.com/ready`
- **Response**:
  ```json
  {
    "status": "ready",
    "timestamp": "2026-09-15T23:06:54",
    "storage": "writable",
    "database": "connected",
    "engines": {
      "pdf2docx": "ready",
      "pymupdf": "ready",
      "pillow": "ready",
      "docx": "ready"
    }
  }
  ```
- **Purpose**: Deep verification that temporary file storage is writable, database connection is live, and core binary conversion dependencies are functional.

---

## 2. Automated 24/7 Keep-Alive Monitoring

To prevent Render's Free Tier container from spinning down after 15 minutes of idle time, automated external monitors keep the server warm:

1. **GitHub Actions Scheduled Workflow** (`.github/workflows/keepalive.yml`):
   - Triggers every 10 minutes (`*/10 * * * *`).
   - Pings both `/health` and `/ready` from GitHub's global cloud runner IP pool.
2. **UptimeRobot / External Pinger**:
   - URL: `https://docflow-backend-8rwy.onrender.com/health`
   - Interval: 5 minutes.
   - Alert notification on 5xx status codes or response time > 5000ms.

---

## 3. Metrics & Alert Thresholds

| Metric | Normal Range | Warning Threshold | Critical Action |
| :--- | :--- | :--- | :--- |
| **API Response Time** | 200ms – 1.5s | > 5.0s | Check container memory exhaustion |
| **Conversion Error Rate** | < 1.0% | > 5.0% | Inspect server logs for malformed PDF crashes |
| **Storage Usage** | < 500 MB | > 2.0 GB | Verify `purge_expired_files()` cron execution |
| **Memory Consumption** | 250 MB – 450 MB | > 80% (Render limit) | Terminate runaway worker processes |

---

## 4. Troubleshooting Runbook

### Issue: "Service temporarily unavailable"
1. Verify `GET https://docflow-backend-8rwy.onrender.com/health`.
2. Inspect Render dashboard logs: `https://dashboard.render.com`.
3. Check for Out-Of-Memory (OOM) killer events if processing massive PDF files.
