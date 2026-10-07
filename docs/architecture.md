# System Architecture & Technical Specifications

**Project Title:** NLP-Based Legal Complaint Emotion & Urgency Classification System  
**Academic Target:** B.Tech Final Year Capstone Project / Viva Defense  
**Domain:** Natural Language Processing (NLP), Explainable AI (XAI), Large Language Models (LLMs), Full-Stack Systems

---

## 1. Executive Overview

Public legal grievance systems—including police control centers, consumer redressal courts, labor commissioners, and corporate grievance portals—suffer from severe triage bottlenecks when receiving thousands of uncurated complaints in diverse regional languages. Traditional keyword filtering fails to recognize emotional distress, veiled threats to physical safety, financial emergencies, or translation nuances.

This project implements an end-to-end intelligent triage platform capable of:
1. **Multilingual Script & Language Detection:** Supports English, Hindi, Telugu, Tamil, Bengali, and Urdu in both native scripts and Romanized transliteration (Hinglish/Teluglish).
2. **Standardized Legal Translation:** Translates regional grievances into standardized legal English while preserving urgency semantics.
3. **7-Class Emotion Classification:** Probability distribution across `anger`, `fear`, `distress`, `neutral`, `desperation`, `frustration`, and `sadness`.
4. **4-Tier Urgency Classification & SLA Countdown:** Computes a continuous Urgency Score (0–100) and maps to `Critical` (SLA: 4h), `High` (SLA: 24h), `Medium` (SLA: 48h), and `Low` (SLA: 120h).
5. **Automatic Department Routing:** Dispatches grievances to specialized queues (Cyber Crime Cell, Women & Child Safety, Economic Offences Wing, etc.).
6. **Explainable AI (XAI) Synthesis:** Outputs explicit trigger keyword tokens and human-readable algorithmic justifications explaining *why* a particular classification was reached.
7. **Dual-Engine Toggle:** Enables runtime selection between a Fine-Tuned Transformer pipeline and a Local LLM (Ollama Llama 3.1 / Mistral) with seamless offline resilience.

---

## 2. High-Level System Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                            CITIZEN / OFFICER FRONTEND                             |
|  - Next.js / React 18 (TailwindCSS, Lucide Icons, Glassmorphism UI)               |
|  - Multilingual Speech-to-Text (Web Speech API) & Live Pipeline Visualizer Stream |
|  - Real-Time SLA Countdown & Escalation Alert Audio-Visual Banner                 |
+-----------------------------------------------------------------------------------+
                                         |
                                         | RESTful JSON / SSE Streams
                                         v
+-----------------------------------------------------------------------------------+
|                               FASTAPI BACKEND SERVICE                             |
|  - Auth & RBAC (Citizen, Officer, Admin, Super Admin)                             |
|  - PDF Dossier Generation Engine (ReportLab)                                      |
|  - Dual Model Switcher & Health Monitor                                           |
+-----------------------------------------------------------------------------------+
              |                                            |
              | (Model Mode = "llm")                       | (Model Mode = "transformer")
              v                                            v
+-----------------------------+              +--------------------------------------+
|     LOCAL OLLAMA ENGINE     |              |     INTERNAL TRANSFORMER PIPELINE    |
| - Llama 3.1 / Mistral       |              | - Unicode Script Range Detector      |
| - Few-Shot System Prompting |              | - Normalized Legal Translation Layer |
| - Structured JSON Parsing   |              | - Affective Emotion Probability Net  |
| - Offline Fallback Bridge   |              | - Urgency & Temporal Risk Evaluator  |
+-----------------------------+              +--------------------------------------+
              \                                            /
               \                                          /
                v                                        v
+-----------------------------------------------------------------------------------+
|                        STORAGE & SEMANTIC PRECEDENT LAYER                         |
|  - PostgreSQL / SQLite (Complaints, Audit Logs, Users, Departments)               |
|  - Vector Store (ChromaDB / Cosine Vectorizer for Semantic Legal Precedents)       |
+-----------------------------------------------------------------------------------+
```

---

## 3. NLP Pipeline Component Breakdown

### 3.1 Language Identification & Transliteration Handling
Legal grievances in India frequently combine regional scripts (Devanagari, Telugu, Tamil, Bengali, Perso-Arabic) and Latin transliterated phonetics (e.g., *"Mere bank khate se..."* or *"Nannu champesthamu..."*). The pipeline deploys a 3-tier identification cascade:
1. **Unicode Script Range Analysis:** Inspects code-point distributions (e.g., `0x0900-0x097F` for Devanagari, `0x0C00-0x0C7F` for Telugu). High script density yields >95% confidence without network round-trips.
2. **Lexical Transliteration Heuristics:** Scans for high-frequency Indic phonetic tokens to identify Romanized Hindi, Telugu, etc.
3. **Statistical N-gram Detection:** Utilizes `langdetect` as a fallback for mixed-language content.

### 3.2 Emotion Modeling (7 Affective Classes)
Legal complainants exhibit distinct emotional expressions that directly correlate with risk:
- **Fear:** Triggered by physical threats, weapons, stalking, impending violence.
- **Desperation:** Characterized by suicidal ideation, kidnapping ransom deadlines, eviction onto streets.
- **Anger:** Associated with blatant corruption, official apathy, flagrant breach of trust.
- **Distress:** Arising from severe financial drain, cyber extortion, persistent domestic abuse.
- **Frustration:** Prolonged bureaucratic delays, unanswered RTI requests, defective product support.
- **Sadness:** Grief, loss of life savings, death of a relative due to medical negligence.
- **Neutral:** Procedural status requests, land mutation inquiries, survey requests.

### 3.3 Urgency Classification & SLA Calculus
The urgency score $U \in [0, 100]$ is computed as:
$$U = w_{\text{crit}} \cdot N_{\text{crit}} + w_{\text{high}} \cdot N_{\text{high}} + w_{\text{med}} \cdot N_{\text{med}} + \gamma(\text{emotion}) + \beta(\text{temporal\_markers})$$
- **Critical ($U \ge 80$):** Immediate physical danger, severe violence, abduction, imminent weapon threats. **SLA: 4 Hours.**
- **High ($60 \le U < 80$):** Active financial extortion, cyber fraud with fund-recovery windows, continuous stalking. **SLA: 24 Hours.**
- **Medium ($30 \le U < 60$):** Commercial fraud, contract non-performance, unpaid wages, property boundary disputes. **SLA: 48 Hours.**
- **Low ($U < 30$):** Routine administrative queries, status verifications, minor civic nuisances. **SLA: 120 Hours (5 Days).**

---

## 4. Dual Model Architecture: Transformer vs. Local LLM

| Feature | Fine-Tuned Transformer Pipeline | Ollama Local LLM (Llama 3.1) |
|---|---|---|
| **Latency** | < 25 milliseconds | 1.5 – 4.0 seconds |
| **Hardware Overhead** | Low (Runs on CPU with zero GPU requirement) | Moderate-High (4GB–8GB VRAM / RAM) |
| **Output Type** | Direct probability distribution | Generative structured JSON |
| **Offline Resilience** | 100% autonomous, zero external dependencies | Requires local Ollama background daemon |
| **Explainability** | Trigger token extraction & template reasoning | Generative narrative justification |
| **Admin Control** | Active baseline in settings | Selectable toggle in Admin Dashboard |

### Offline Fallback Protocol
If an administrator toggles the system to **LLM Mode** but the local Ollama instance is stopped or times out, the backend automatically intercepts the failure, invokes the Transformer NLP pipeline, and stamps the record as `model_mode_used: "Fine-Tuned Transformer (Offline Fallback)"`. The application never crashes or returns a 500 error during live evaluation demonstrations.

---

## 5. Explainable AI (XAI) & Audit Trail

Every classified complaint retains:
1. **Trigger Keyword Vector:** A serialized array of explicit tokens extracted from the text (e.g., `["threatened to kill", "physical assault", "immediate protection"]`).
2. **Natural Language Rationale:** A transparent, non-black-box justification linking identified legal risk markers, emotion levels, and urgency categories.
3. **Immutable Audit Log:** Records every actor (Citizen, Ingestion Queue, Assigned Officer), timestamp, and action (`Created`, `Viewed`, `Escalated`, `Status Changed`).

---

## 6. Model Evaluation Benchmark & Metrics

Evaluation over the 50 ground-truth multilingual benchmark cases:
- **Urgency Classification Accuracy:** **82.0%**
- **Urgency Macro-F1 Score:** **0.8264**
- **Category Routing Accuracy:** **82.0%**
- **Emotion Classification Accuracy:** **70.0%**
- **Emotion Macro-F1 Score:** **0.7231**

The system provides an interactive `/evaluation` page and CLI runner (`scripts/run_eval.py`) demonstrating confusion matrices and per-language reliability metrics.

---

## 7. Viva Defense: Anticipated Evaluator Questions & Answers

1. **Q: Why classify both Emotion AND Urgency? Aren't they the same?**  
   *A:* No. A citizen experiencing high *Anger* regarding a 3-month delayed refund is Medium urgency, whereas a citizen speaking with quiet *Fear* about an armed threat outside their door is Critical urgency. Disentangling affective state from temporal threat severity prevents emotional inflation while prioritizing life safety.

2. **Q: How does the system handle mixed Romanized Indic languages like Hinglish?**  
   *A:* The pipeline incorporates sub-word and phonetic lexicon mapping for common transliterated words (e.g., *jaan se marne*, *dhamki*, *champa*) alongside native script Unicode block detection.

3. **Q: How is data privacy preserved?**  
   *A:* The system is designed for on-premise execution using local Ollama LLMs and local embedding models. No citizen grievance data is transmitted to external proprietary cloud APIs (e.g. OpenAI or Google Cloud).
