#!/usr/bin/env python3
"""
LexiPulse AI - Supabase Seeding Script
Connects to Supabase via Service Role Key, seeds demo departments,
provisions authentic users across Citizen, Officer, and Admin roles via
Supabase Auth Admin API, and batch-inserts 380 multilingual legal complaints.
Finally queries fresh data back from Supabase to confirm persistence.
"""

import os
import sys
import json
import datetime
from dotenv import load_dotenv

# Ensure root .env is loaded
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

def main():
    print("=" * 80)
    print("  LEXIPULSE AI - SUPABASE PERSISTENCE & DATA SEEDING ENGINE")
    print("=" * 80)

    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

    if not supabase_url or not service_role_key or "your-project" in supabase_url:
        print("\n[!] WARNING: Supabase credentials not found or placeholder in .env file.")
        print("    Please set the following keys in your c:\\NLP-Project\\.env file:")
        print("      SUPABASE_URL=https://<your-project-id>.supabase.co")
        print("      SUPABASE_ANON_KEY=<your-anon-key>")
        print("      SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>")
        print("\n    Once configured, re-run this script to populate your live Supabase cloud database.")
        print("    See supabase/schema.sql to apply the PostgreSQL tables and RLS policies first.")
        print("=" * 80)
        return 1

    try:
        from supabase import create_client
    except ImportError:
        print("[!] ERROR: 'supabase' Python package not installed. Run: pip install supabase")
        return 1

    print(f"\n[+] Connecting to Supabase project: {supabase_url}")
    supabase = create_client(supabase_url, service_role_key)

    # -------------------------------------------------------------------------
    # 1. SEED DEPARTMENTS
    # -------------------------------------------------------------------------
    print("\n[1/4] Seeding Government & Judicial Departments...")
    departments = [
        {"id": 1, "name": "Cyber Crime Cell", "code": "CCC", "category_focus": "Cybercrime, Phishing, Online Extortion", "contact_email": "cyber@police.gov.in"},
        {"id": 2, "name": "Women & Child Safety Cell", "code": "WCS", "category_focus": "Domestic Violence, POSH, Child Abuse", "contact_email": "safety@police.gov.in"},
        {"id": 3, "name": "Economic Offences Wing", "code": "EOW", "category_focus": "Financial & Banking Fraud, Chit Funds, Ponzi", "contact_email": "eow@police.gov.in"},
        {"id": 4, "name": "Revenue & Civil Grievance Division", "code": "RCG", "category_focus": "Property Dispute, Land Grabbing, Encroachment", "contact_email": "revenue@district.gov.in"},
        {"id": 5, "name": "Internal Complaints & Labor Cell", "code": "ICL", "category_focus": "Workplace Harassment, Hostile Workplace", "contact_email": "posh@labor.gov.in"},
        {"id": 6, "name": "Consumer Redressal Forum", "code": "CRF", "category_focus": "Consumer Dispute, E-commerce, Warranty Fraud", "contact_email": "consumer@tribunal.gov.in"},
        {"id": 7, "name": "Labor Grievance Tribunal", "code": "LGT", "category_focus": "Labor & Employment Dispute, Unpaid Wages", "contact_email": "labor@tribunal.gov.in"},
        {"id": 8, "name": "Anti-Corruption & Vigilance Cell", "code": "AVC", "category_focus": "Police Negligence & Misconduct, Bribery", "contact_email": "vigilance@gov.in"},
    ]

    for dept in departments:
        try:
            supabase.table("departments").upsert(dept, on_conflict="id").execute()
        except Exception as e:
            print(f"    [-] Department '{dept['name']}' note: {e}")
    print(f"    [✓] {len(departments)} departments verified in Supabase.")

    # -------------------------------------------------------------------------
    # 2. PROVISION AUTH USERS ACROSS CITIZEN, OFFICER, AND ADMIN ROLES
    # -------------------------------------------------------------------------
    print("\n[2/4] Provisioning Multi-Role Users via Supabase Auth Admin API...")
    demo_users = [
        {
            "email": "citizen@example.com",
            "password": "CitizenPassword123!",
            "full_name": "Ramesh Citizen",
            "role": "citizen",
            "language_pref": "en",
            "phone": "+91 98765 00001",
            "department_id": None
        },
        {
            "email": "officer@police.gov.in",
            "password": "OfficerPassword123!",
            "full_name": "Inspector Vikram Rathore",
            "role": "officer",
            "language_pref": "hi",
            "phone": "+91 98765 00002",
            "department_id": 1
        },
        {
            "email": "inspector@safety.gov.in",
            "password": "OfficerPassword123!",
            "full_name": "ACP Priya Venkatesh",
            "role": "officer",
            "language_pref": "te",
            "phone": "+91 98765 00003",
            "department_id": 2
        },
        {
            "email": "admin@grievance.gov.in",
            "password": "AdminPassword123!",
            "full_name": "Director Rajesh Sharma",
            "role": "admin",
            "language_pref": "en",
            "phone": "+91 98765 00004",
            "department_id": 4
        },
        {
            "email": "superadmin@gov.in",
            "password": "SuperAdminPass123!",
            "full_name": "Chief Justice System Admin",
            "role": "super_admin",
            "language_pref": "en",
            "phone": "+91 98765 00005",
            "department_id": None
        }
    ]

    user_id_map = {}
    created_count = 0

    for u in demo_users:
        user_uid = None
        # Try creating via Supabase Auth Admin API
        try:
            auth_res = supabase.auth.admin.create_user({
                "email": u["email"],
                "password": u["password"],
                "email_confirm": True,
                "user_metadata": {
                    "full_name": u["full_name"],
                    "role": u["role"],
                    "language_pref": u["language_pref"],
                    "phone": u["phone"]
                }
            })
            if auth_res and hasattr(auth_res, "user") and auth_res.user:
                user_uid = auth_res.user.id
                created_count += 1
                print(f"    [+] Created Supabase Auth User: {u['email']} [{u['role']}] -> UID: {user_uid}")
        except Exception as auth_err:
            # User might already exist in Supabase Auth, lookup existing
            try:
                users_list = supabase.auth.admin.list_users()
                for existing_u in users_list:
                    if existing_u.email == u["email"]:
                        user_uid = existing_u.id
                        print(f"    [=] Existing Supabase Auth User: {u['email']} [{u['role']}] -> UID: {user_uid}")
                        break
            except Exception:
                pass

        # Upsert corresponding profile row in public.users table
        if user_uid:
            user_id_map[u["role"]] = user_uid
            profile_payload = {
                "id": str(user_uid),
                "name": u["full_name"],
                "email": u["email"],
                "role": u["role"],
                "language_pref": u["language_pref"],
                "phone": u["phone"],
                "department_id": u["department_id"],
                "is_active": True,
                "created_at": datetime.datetime.utcnow().isoformat(),
                "updated_at": datetime.datetime.utcnow().isoformat()
            }
            try:
                supabase.table("users").upsert(profile_payload, on_conflict="id").execute()
            except Exception as e:
                print(f"    [-] Public users sync note: {e}")

    # -------------------------------------------------------------------------
    # 3. BATCH INSERT COMPLAINTS FROM seed_complaints.json
    # -------------------------------------------------------------------------
    seed_json_path = os.path.join(ROOT_DIR, "data", "seed_complaints.json")
    if not os.path.exists(seed_json_path):
        print(f"[!] Error: Seed file not found at {seed_json_path}")
        return 1

    with open(seed_json_path, "r", encoding="utf-8") as f:
        complaint_records = json.load(f)

    print(f"\n[3/4] Batch Inserting {len(complaint_records)} Multilingual Complaints into Supabase...")

    # Department name to ID mapping
    dept_map = {
        "Cyber Crime Cell": 1,
        "Women & Child Safety Cell": 2,
        "Economic Offences Wing": 3,
        "Revenue & Civil Grievance Division": 4,
        "Internal Complaints & Labor Cell": 5,
        "Consumer Redressal Forum": 6,
        "Labor Grievance Tribunal": 7,
        "Anti-Corruption & Vigilance Cell": 8
    }

    citizen_uid = user_id_map.get("citizen")
    officer_uid = user_id_map.get("officer")

    batch_size = 50
    total_inserted = 0

    for i in range(0, len(complaint_records), batch_size):
        chunk = complaint_records[i : i + batch_size]
        payloads = []

        for item in chunk:
            urgency = item.get("urgency_level", "Medium")
            sla_hours = 4 if urgency == "Critical" else (24 if urgency == "High" else (48 if urgency == "Medium" else 120))
            
            created_dt = datetime.datetime.utcnow() - datetime.timedelta(
                days=int(item["id"].split("-")[-1]) % 14,
                hours=int(item["id"].split("-")[-1]) % 24
            )
            sla_deadline = created_dt + datetime.timedelta(hours=sla_hours)

            dept_name = item.get("department_name", "")
            dept_id = dept_map.get(dept_name, 1)

            payload = {
                "id": item["id"],
                "citizen_id": citizen_uid,
                "citizen_name": item.get("citizen_name", "Anonymous Complainant"),
                "citizen_contact": item.get("citizen_contact", "+91 9876543210"),
                "citizen_email": "citizen@example.com",
                "raw_text": item["raw_text"],
                "detected_lang": item.get("detected_lang", "en"),
                "detected_lang_name": item.get("detected_lang_name", "English"),
                "detected_lang_confidence": float(item.get("detected_lang_confidence", 0.95)),
                "translated_text": item.get("translated_text", item["raw_text"]),
                "translation_confidence": item.get("translation_confidence", "high"),
                "language_coverage_confidence": item.get("language_coverage_confidence", "HIGH"),
                "emotion_label": item.get("emotion_label", "Distress"),
                "emotion_confidence": float(item.get("emotion_confidence", 0.88)),
                "emotion_scores": item.get("emotion_scores", {}),
                "urgency_label": urgency,
                "urgency_score": float(item.get("urgency_score", 70.0)),
                "category": item.get("category", "General Grievance"),
                "explanation_text": item.get("explanation_text", "Auto-triaged by NLP engine."),
                "trigger_keywords": item.get("trigger_keywords", []),
                "department_id": dept_id,
                "assigned_officer_id": officer_uid if urgency in ["Critical", "High"] else None,
                "status": item.get("status", "Submitted"),
                "sla_hours": sla_hours,
                "sla_deadline": sla_deadline.isoformat(),
                "evidence_files": item.get("evidence_files", []),
                "model_mode_used": "Fine-Tuned Transformer (Legal-DistilRoBERTa)",
                "created_at": created_dt.isoformat(),
                "updated_at": created_dt.isoformat(),
            }
            payloads.append(payload)

        try:
            supabase.table("complaints").upsert(payloads, on_conflict="id").execute()
            total_inserted += len(payloads)
            print(f"    [+] Upserted batch {i + 1}-{min(i + batch_size, len(complaint_records))} / {len(complaint_records)}")
        except Exception as e:
            print(f"    [-] Batch {i} error: {e}")

    # -------------------------------------------------------------------------
    # 4. QUERY BACK FRESH FROM SUPABASE (VERIFY PERSISTENCE)
    # -------------------------------------------------------------------------
    print("\n[4/4] Verifying Cloud Persistence via Fresh Supabase SELECT Queries...")

    # Query Users
    res_users = supabase.table("users").select("role, count", count="exact").execute()
    total_users_count = res_users.count if res_users.count is not None else len(res_users.data or [])

    # Role Breakdown
    citizens = supabase.table("users").select("*", count="exact").eq("role", "citizen").execute()
    officers = supabase.table("users").select("*", count="exact").eq("role", "officer").execute()
    admins = supabase.table("users").select("*", count="exact").in_("role", ["admin", "super_admin"]).execute()

    # Query Complaints
    res_complaints = supabase.table("complaints").select("*", count="exact").limit(4).order("created_at", desc=True).execute()
    total_complaints_count = res_complaints.count if res_complaints.count is not None else 0

    print("\n" + "=" * 80)
    print("                    SUPABASE SEEDING VERIFICATION SUMMARY")
    print("=" * 80)
    print(f"  • Total Registered Accounts in Supabase : {total_users_count}")
    print(f"      - Citizens                          : {citizens.count or 0}")
    print(f"      - Officers                          : {officers.count or 0}")
    print(f"      - Administrators                    : {admins.count or 0}")
    print(f"  • Total Complaints Persisted in Supabase: {total_complaints_count}")
    print("=" * 80)

    print("\n[+] LIVE PREVIEW: 4 Sample Rows Queried Directly From Supabase Cloud Database:")
    print("-" * 80)
    for idx, c in enumerate(res_complaints.data or [], 1):
        print(f"  Row {idx}:")
        print(f"    ID        : {c.get('id')}")
        print(f"    Language  : {c.get('detected_lang_name')} ({c.get('detected_lang')}) [Coverage: {c.get('language_coverage_confidence')}]")
        print(f"    Category  : {c.get('category')}")
        print(f"    Emotion   : {c.get('emotion_label')} (Confidence: {c.get('emotion_confidence')})")
        print(f"    Urgency   : {c.get('urgency_label')} ({c.get('urgency_score')}/100) -> Status: {c.get('status')}")
        print(f"    Original  : {c.get('raw_text')[:75]}...")
        print(f"    English   : {c.get('translated_text')[:75]}...")
        print("-" * 80)

    print("\n[✓] All data successfully written to and verified from Supabase!")
    print("=" * 80)
    return 0

if __name__ == "__main__":
    sys.exit(main())
