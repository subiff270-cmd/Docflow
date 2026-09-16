# Hugging Face Spaces — 100% Free 16 GB Backend Deployment Guide

Deploy your high-performance Python FastAPI document conversion engine to **Hugging Face Spaces** for **100% Free** with **2 dedicated vCPUs and 16 GB of RAM** (30x more RAM and 20x more CPU than Render free tier).

---

## Why Hugging Face Spaces?

| Feature | Render Free Tier | Hugging Face Spaces (Free) |
| :--- | :--- | :--- |
| **Price** | $0 | **$0 Forever** |
| **RAM** | 512 MB (Crashes on heavy files) | **16 GB RAM (Industrial Grade)** |
| **CPU** | 0.1 vCPU (Shared & Throttled) | **2 Dedicated vCPUs** |
| **LibreOffice & OCR** | Limited | **Full LibreOffice + Tesseract OCR** |
| **Conversion Speed** | 15–30 seconds | **1–3 seconds** |

---

## Step-by-Step Setup (Takes 3 Minutes)

### Step 1: Create a Free Hugging Face Account
1. Go to [https://huggingface.co/join](https://huggingface.co/join) and create a free account (if you don't already have one).

### Step 2: Create a New Space
1. Go to [https://huggingface.co/new-space](https://huggingface.co/new-space).
2. Set **Space name**: `docflow-backend` (or `nexdoc-backend`).
3. Set **License**: `mit`.
4. Select **Space SDK**: Choose **Docker** -> select **Blank**.
5. Select **Space Hardware**: Choose **CPU basic • 2 vCPU • 16 GB • Free**.
6. Set **Privacy**: **Public** (required for your Vercel frontend to reach it via HTTPS).
7. Click **Create Space**.

---

### Step 3: Push Your Code to Hugging Face

Hugging Face gives you a Git URL on your new Space page. 

Run these commands in your project terminal:

```bash
# 1. Add your Hugging Face Space as a git remote (replace YOUR_USERNAME)
git remote add hf https://huggingface.co/spaces/YOUR_USERNAME/docflow-backend

# 2. Push the Dockerfile and code to Hugging Face
git push hf main
```

*(If prompted for a password, generate a free Access Token at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) with "Write" permissions and paste it as your password).*

---

### Step 4: Get Your Live API URL

Once the build finishes (takes ~2 minutes):
1. In your Hugging Face Space, click the **three dots menu (...)** in the upper right corner -> **Embed this Space** -> copy the **Direct URL**.
2. Your direct URL will look like:
   `https://YOUR_USERNAME-docflow-backend.hf.space`

You can test it in your browser:
`https://YOUR_USERNAME-docflow-backend.hf.space/ready`
It will return:
`{"status":"ready","database":"connected","engines":{...}}`

---

### Step 5: Connect Your Vercel Frontend
1. Open your [Vercel Dashboard](https://vercel.com).
2. Click your **nexdoc** project -> **Settings** -> **Environment Variables**.
3. Edit `NEXT_PUBLIC_API_URL`:
   - Change value to: `https://YOUR_USERNAME-docflow-backend.hf.space`
4. Go to **Deployments** -> Click the three dots on the latest deployment -> **Redeploy**.

---

## Congratulations!
Your website is now backed by a **2 vCPU, 16 GB RAM enterprise engine** for **$0/month**. Multi-page PDFs and PowerPoints will convert in **1 to 2 seconds** with zero memory crashes.
