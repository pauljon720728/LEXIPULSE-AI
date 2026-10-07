# Render Deployment Guide: LEXIPULSE-AI

This guide walks you through deploying both the **FastAPI Backend** and the **React Vite Frontend** on [Render.com](https://render.com) using your GitHub repository.

---

## 🎯 Method 1: 1-Click Blueprint (Recommended & Easiest)

Render reads our included `render.yaml` file to automatically set up both the backend and frontend services with the correct build and start commands.

1. Go to [https://dashboard.render.com/](https://dashboard.render.com/) and log in (e.g., with your GitHub account).
2. Click **New +** in the top right corner and select **Blueprint**.
3. Connect your GitHub repository:
   ```text
   https://github.com/pauljon720728/LEXIPULSE-AI
   ```
4. Render will detect `render.yaml` and show:
   - `lexipulse-backend` (Python Web Service)
   - `lexipulse-frontend` (Static Site)
5. Fill in the required environment variables:
   - For **`lexipulse-backend`**:
     - `SUPABASE_URL`: `https://hxvkkyogureedbthjjcq.supabase.co`
     - `SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4dmtreW9ndXJlZWRidGhqamNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNzUzODQsImV4cCI6MjEwNjk1MTM4NH0.smUCEjWxmHz7PKFXZ2TqpwBFaVlnXDFEx4Mx1Z-8aCA`
     - `SUPABASE_SERVICE_ROLE_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4dmtreW9ndXJlZWRidGhqamNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTM3NTM4NCwiZXhwIjoyMTA2OTUxMzg0fQ.6xfRawGMG3mKFhEBMCUPIp4aehMhsxaxXdLi7qmkM2o`
     - `SECRET_KEY`: `super-secret-jwt-key-for-legal-complaint-system-2026`
   - For **`lexipulse-frontend`**:
     - `VITE_API_URL`: `https://lexipulse-backend.onrender.com/api` *(or your actual backend URL after Render generates it)*
     - `VITE_SUPABASE_URL`: `https://hxvkkyogureedbthjjcq.supabase.co`
     - `VITE_SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4dmtreW9ndXJlZWRidGhqamNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNzUzODQsImV4cCI6MjEwNjk1MTM4NH0.smUCEjWxmHz7PKFXZ2TqpwBFaVlnXDFEx4Mx1Z-8aCA`
6. Click **Apply**. Render will build and deploy both services!

---

## 🛠 Method 2: Manual Setup (Step-by-Step)

If you prefer to configure the two services manually in the Render dashboard:

### Step 1: Deploy Backend (Web Service)
1. On Render Dashboard, click **New +** -> **Web Service**.
2. Select your repository: `pauljon720728/LEXIPULSE-AI`.
3. Configure the following settings:
   - **Name**: `lexipulse-backend`
   - **Region**: Oregon (or your preferred region)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: Free
4. Add **Environment Variables** under the "Environment" tab:
   | Key | Value |
   |---|---|
   | `PYTHON_VERSION` | `3.11.9` |
   | `SECRET_KEY` | `super-secret-jwt-key-for-legal-complaint-system-2026` |
   | `SUPABASE_URL` | `https://hxvkkyogureedbthjjcq.supabase.co` |
   | `SUPABASE_ANON_KEY` | *(your anon key)* |
   | `SUPABASE_SERVICE_ROLE_KEY` | *(your service role key)* |
5. Click **Create Web Service**.
6. Wait 1-2 minutes until it deploys. Note the live URL, for example:
   `https://lexipulse-backend.onrender.com`

---

### Step 2: Deploy Frontend (Static Site)
1. On Render Dashboard, click **New +** -> **Static Site**.
2. Select your repository: `pauljon720728/LEXIPULSE-AI`.
3. Configure the following settings:
   - **Name**: `lexipulse-frontend`
   - **Branch**: `main`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Add **Environment Variables**:
   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://lexipulse-backend.onrender.com/api` *(use your backend URL from Step 1)* |
   | `VITE_SUPABASE_URL` | `https://hxvkkyogureedbthjjcq.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | *(your anon key)* |
5. Under **Redirects/Rewrites**:
   - Add Rewrite Rule:
     - **Source**: `/*`
     - **Destination**: `/index.html`
     - **Action**: Rewrite
6. Click **Create Static Site**.

---

## ⚡ Verification Checklist Once Deployed

1. Open your frontend URL: `https://lexipulse-frontend.onrender.com`
2. Test citizen login with `pauljon@gmail.com` / `paul123` or register a new citizen.
3. Submit a complaint in Telugu, Hindi, or English.
4. Log into officer dashboard (`officer@police.gov.in` / `officer123`).
5. Verify the complaint appears in the queue across departments.
6. Click **Resolve & Issue Clearance**, input manual notes, and download the official PDF clearance certificate.
