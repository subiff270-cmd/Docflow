# PRODUCTION DEPLOYMENT GUIDE — NEXDOC / DOCFLOW

This guide provides step-by-step instructions for deploying and configuring both the Next.js frontend and Python FastAPI backend for high-availability production environments.

---

## 1. Frontend Deployment (Vercel)

1. **Repository Connection**:
   - Push code to GitHub repository: `https://github.com/subiff270-cmd/Docflow.git` on branch `main`.
   - In [Vercel Dashboard](https://vercel.com/), link the repository.
   - Root Directory: `frontend`
   - Framework Preset: `Next.js`

2. **Build Settings**:
   - Build Command: `next build`
   - Output Directory: `.next`
   - Install Command: `npm install`

3. **Environment Variables**:
   ```env
   NEXT_PUBLIC_API_URL=https://docflow-backend-8rwy.onrender.com
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBac5n-9U8l4nkytCqwKEoavK4iAd539yA
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=docflow-db4fe.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=docflow-db4fe
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=docflow-db4fe.firebasestorage.app
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=932082145532
   NEXT_PUBLIC_FIREBASE_APP_ID=1:932082145532:web:f1b5cc5d4584af3b3a9f79
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-BCX71H8V5D
   ```

4. **Custom Domain / DNS Configuration**:
   - Under Project Settings $\rightarrow$ Domains:
     - Primary Domain: `nexdocmain.vercel.app`
     - Custom Domain (e.g. GoDaddy): Add `A` record pointing `@` to `76.76.21.21` and `CNAME` for `www` to `cname.vercel-dns.com`.

---

## 2. Backend Deployment (Render)

1. **Service Configuration**:
   - Type: **Web Service**
   - Root Directory: `backend`
   - Runtime: `Docker` (or Python 3.11)
   - Dockerfile Path: `./Dockerfile`
   - Region: `Frankfurt` (or `Oregon`)

2. **Start Command**:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 2 --timeout-keep-alive 75
   ```

3. **Environment Variables**:
   ```env
   DATABASE_URL=sqlite:///./docflow.db
   SECRET_KEY=nexdoc_production_jwt_secret_key_983147
   RENDER_EXTERNAL_URL=https://docflow-backend-8rwy.onrender.com
   RAZORPAY_KEY_ID=rzp_test_xxxx
   RAZORPAY_KEY_SECRET=xxxx
   ```

4. **Zero Cold-Start Recommendation**:
   - Upgrade from **Free** to **Starter ($7/mo)** to eliminate the 15-minute idle sleep timer permanently.
   - Alternatively, maintain the free GitHub Actions keep-alive workflow (`.github/workflows/keepalive.yml`).
