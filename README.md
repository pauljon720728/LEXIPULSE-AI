# NLP-Based Legal Complaint Emotion & Urgency Classification System
*Final-Year B.Tech Capstone Project in Natural Language Processing & Applied AI*

An enterprise-grade, explainable AI platform designed for public and legal organizations (police departments, consumer courts, ombudsman offices, corporate grievance cells) to intake, classify, prioritize, and auto-route bulk legal complaints submitted in multiple Indian regional languages.

---

## 🌟 Key Capabilities

- 🌐 **Multilingual Language Identification & Translation:** Automatic detection & translation for **Hindi, Telugu, Tamil, Bengali, Urdu, and English** (supporting both native scripts and Romanized transliteration like Hinglish and Teluglish).
- 🎭 **7-Class Emotion Classification:** Probability distribution across `anger`, `fear`, `distress`, `neutral`, `desperation`, `frustration`, and `sadness`.
- 🚨 **4-Tier Urgency & Dynamic SLA:** Instant triage into `Critical` (4h SLA), `High` (24h SLA), `Medium` (48h SLA), and `Low` (120h SLA) with live countdown timers and audio-visual escalation banners.
- 🏢 **Intelligent Department Routing:** Categorizes into Cybercrime, Domestic Violence, Property Disputes, Financial Fraud, Workplace Harassment, Consumer Grievances, Labor Disputes, and Police Misconduct.
- 🧠 **Explainable AI (XAI):** Synthesizes plain-language algorithmic justifications and extracts critical trigger keywords.
- 🔀 **Dual Model Mode (Transformer vs. LLM):** Runtime toggle between fine-tuned Transformer pipeline and local Ollama LLM (`llama3.1` or `mistral`) with seamless offline fallback.
- 🔍 **Vector Precedent Search:** Cosine semantic similarity over past legal cases to provide immediate legal precedent.
- 📄 **Downloadable PDF Case Reports:** Generates official case dossiers via ReportLab for formal police/court filing.
- 📊 **Evaluation Benchmark Suite:** Interactive confusion matrices, accuracy, and macro-F1 metrics over 50 ground-truth legal cases.
- 🤖 **Interactive AI Assistant Widget:** Context-aware floating assistant for citizen tracking queries and officer analytics.

---

## 🏗 Monorepo Architecture

```
NLP-Project/
├── backend/
│   ├── app/
│   │   ├── config.py             # App settings & environment bindings
│   │   ├── database.py           # SQLAlchemy engine & session manager
│   │   ├── models.py             # ORM models (Users, Complaints, Departments, etc.)
│   │   ├── schemas.py            # Pydantic validation schemas
│   │   ├── auth.py               # JWT authentication & RBAC guards
│   │   ├── services/
│   │   │   ├── nlp_pipeline.py   # Language detection, translation, emotion, urgency
│   │   │   ├── llm_service.py    # Local Ollama LLM integration & JSON parser
│   │   │   ├── vector_service.py # Cosine vector search over past complaints
│   │   │   ├── evaluator.py      # Benchmark evaluation metrics calculator
│   │   │   └── pdf_generator.py  # ReportLab PDF case report compiler
│   │   ├── routers/              # Auth, Complaints, Analytics, Admin, Assistant
│   │   └── main.py               # FastAPI entrypoint with CORS & routes
│   └── legal_complaints.db       # Seeded SQLite database (380+ complaints)
├── frontend/                     # Modern React/Next.js dashboard & citizen portal
├── data/
│   ├── seed_complaints.json      # 380 synthetic multilingual complaint records
│   └── evaluation_set.json       # 50 labeled ground-truth benchmark cases
├── scripts/
│   ├── seed_db.py                # Database population script
│   ├── run_eval.py               # CLI benchmark evaluation runner
│   └── generate_seed_data.py     # Synthetic complaint generator
└── docs/
    └── architecture.md           # Full technical specifications & viva defense notes
```

---

## 🚀 Quickstart Guide

### 1. Backend Setup

The database is already initialized and seeded with **380 realistic legal complaints**!

To start the FastAPI backend server:
```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation will be accessible at: `http://127.0.0.1:8000/docs`

### 2. (Optional) Local Ollama LLM Setup

If you want to use the Ollama LLM mode:
```bash
# 1. Install and start Ollama from https://ollama.com
# 2. Pull the model:
ollama pull llama3.1

# Verify Ollama is running on http://localhost:11434
```
*Note: If Ollama is not running, the system automatically falls back to the high-speed local Transformer NLP engine without interruption!*

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## ⚡ Supabase Cloud Persistence & Realtime Setup

LexiPulse AI features full cloud persistence via Supabase PostgreSQL, Row Level Security (RLS), and Realtime subscription streams.

### Step 1: Create a Supabase Project
1. Log in to [supabase.com](https://supabase.com) and create a new project.
2. Under **Project Settings -> API**, copy:
   - **Project URL**
   - **anon / public key**
   - **service_role key** (Secret)

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env` in the project root:
```bash
cp .env.example .env
```
Fill in your Supabase project keys:
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

### Step 3: Run the Schema & RLS Migration
1. In your Supabase Dashboard, go to the **SQL Editor**.
2. Open the schema script located at [`supabase/schema.sql`](file:///c:/NLP-Project/supabase/schema.sql).
3. Paste the contents and click **Run**.
This establishes:
- `departments`, `users`, `complaints`, `audit_log`, `model_predictions` tables
- Automatic user provisioning trigger on `auth.users`
- Strict Row Level Security (RLS) policies for Citizens, Officers, and Admins
- Realtime publication stream for live dashboard updates

### Step 4: Run the Supabase Seeding Script
Seed all departments, demo accounts across all roles, and the 380 multilingual complaints into your cloud database:
```bash
python scripts/seed_supabase.py
```
The script will insert all records in batches and immediately run fresh SELECT queries to verify data persistence.

---

## 🔐 Authentication & Access Control

- **Public Self-Registration:** Citizens can create accounts at `/register` with email/password validation and preferred language settings.
- **Official Staff Accounts:** Police Officers and Administrators cannot self-register. They are provisioned and managed directly by Administrators via the **Admin Control Panel** under *User Management*.
- **Row Level Security (RLS):**
  - **Citizens:** Can view and submit only their own grievances.
  - **Officers:** Can view and update complaints routed to their assigned department.
  - **Administrators:** Have complete oversight across all departments, complaints, and user accounts.

---

## 📈 Evaluation & Benchmark

Run the command-line evaluation suite directly:
```bash
python scripts/run_eval.py
```

### Benchmark Results (50 Cases):
- **Urgency Accuracy:** `82.0%` (Macro-F1: `0.8264`)
- **Category Routing Accuracy:** `82.0%`
- **Emotion Accuracy:** `70.0%` (Macro-F1: `0.7231`)
