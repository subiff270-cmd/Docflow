# 🚀 DocFlow Complete Cloud Deployment Guide

This guide explains how to deploy DocFlow to the web on a **Free / Low-Cost Production Stack** with a **Custom Domain** (e.g., `www.yourdomain.com`).

---

## 🏗️ Architecture Overview

| Component | Platform | Free Tier Available? | Role |
|---|---|---|---|
| **Frontend** | [Vercel](https://vercel.com) | ✅ Yes | Next.js 16 SSR/Static Hosting + Global CDN + Custom Domain SSL |
| **Backend** | [Render](https://render.com) or [Railway](https://railway.app) | ✅ Yes | FastAPI + PyMuPDF + Tesseract OCR + ReportLab Python Engine |
| **Database** | SQLite / Supabase PostgreSQL | ✅ Yes | User quotas, file items, and payment history |
| **Auth** | Firebase Auth | ✅ Yes | Google, Email/Password authentication |

---

## 📌 STEP 1: Deploy Backend on Render (Free)

1. Go to **[https://render.com](https://render.com)** and sign in with your GitHub account.
2. Click **New +** ➔ **Web Service**.
3. Connect your GitHub repository: `subiff270-cmd/Docflow`.
4. Configure the service settings:
   - **Name**: `docflow-backend`
   - **Region**: Select closest to your users (e.g. *Singapore*, *Frankfurt*, or *Oregon*)
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3` (or `Docker` if using the included Dockerfile)
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: `Free`
5. Click **Create Web Service**.
6. Render will build and deploy your API in ~2 minutes and provide a live URL like:
   `https://docflow-backend.onrender.com`

> **Note**: Test your live backend by visiting `https://docflow-backend.onrender.com/` in your browser. It will return `{"message": "DocFlow Backend API is running.", "status": "healthy"}`.

---

## 📌 STEP 2: Deploy Frontend on Vercel (Free)

1. Go to **[https://vercel.com](https://vercel.com)** and sign in with GitHub.
2. Click **Add New...** ➔ **Project**.
3. Import your repository: `subiff270-cmd/Docflow`.
4. Configure project settings:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click `Edit` and select `frontend`
   - **Build Command**: `next build`
   - **Output Directory**: `.next`
5. Expand **Environment Variables** and add:
   - `NEXT_PUBLIC_API_URL` = `https://docflow-backend.onrender.com` *(your live Render backend URL from Step 1)*
   - *(Optional Firebase keys if you use login/signup)*:
     - `NEXT_PUBLIC_FIREBASE_API_KEY`
     - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
     - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
6. Click **Deploy**!
7. Vercel will build your frontend in ~60 seconds and give you a live URL like `https://docflow-frontend.vercel.app`.

---

## 📌 STEP 3: Connect Your Custom Domain (e.g. `www.docflow.app`)

1. In your **Vercel Dashboard**, open your deployed project and go to **Settings ➔ Domains**.
2. Type your domain name (e.g. `www.docflow.app` or `docflow.app`) and click **Add**.
3. Vercel will show you the exact DNS records to add at your domain provider (Namecheap, GoDaddy, Cloudflare, etc.):
   - **For `www.docflow.app`**:
     - Type: `CNAME`
     - Name: `www`
     - Value: `cname.vercel-dns.com`
   - **For `docflow.app` (apex domain)**:
     - Type: `A`
     - Name: `@`
     - Value: `76.76.21.21`
4. Once you add these records in your domain registrar DNS panel, Vercel will automatically verify them and issue a **Free SSL Certificate (HTTPS 🔒)** within minutes.

---

## 📌 STEP 4: Connect Custom Subdomain for Backend API (Optional)

If you want your backend API to also use your domain (e.g. `api.docflow.app`):
1. In Render, go to your service ➔ **Settings ➔ Custom Domains**.
2. Add `api.docflow.app`.
3. Add the `CNAME` record in your DNS registrar pointing `api` to your Render service address.
4. Update `NEXT_PUBLIC_API_URL` on Vercel to `https://api.docflow.app`!
