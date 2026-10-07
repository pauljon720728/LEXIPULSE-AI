import os
import sys
import json
import datetime

# Add backend directory to sys.path so app modules import cleanly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.database import engine, Base, SessionLocal
from app.models import Department, User, Complaint, AuditLog, ModelPrediction, SystemSetting
from app.auth import hash_password
from app.services.nlp_pipeline import nlp_pipeline
from app.services.vector_service import vector_service

def seed_database():
    print("Initializing Database Schema...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Seed Departments
        print("Seeding Departments...")
        departments_data = [
            {"id": 1, "name": "Cyber Crime Cell", "code": "CCC", "category_focus": "Cybercrime, Phishing, Online Extortion", "contact_email": "cyber@police.gov.in"},
            {"id": 2, "name": "Women & Child Safety Cell", "code": "WCS", "category_focus": "Domestic Violence, POSH, Child Abuse", "contact_email": "safety@police.gov.in"},
            {"id": 3, "name": "Economic Offences Wing", "code": "EOW", "category_focus": "Financial & Banking Fraud, Chit Funds, Ponzi", "contact_email": "eow@police.gov.in"},
            {"id": 4, "name": "Revenue & Civil Grievance Division", "code": "RCG", "category_focus": "Property Dispute, Land Grabbing, Encroachment", "contact_email": "revenue@district.gov.in"},
            {"id": 5, "name": "Internal Complaints & Labor Cell", "code": "ICL", "category_focus": "Workplace Harassment, Hostile Workplace", "contact_email": "posh@labor.gov.in"},
            {"id": 6, "name": "Consumer Redressal Forum", "code": "CRF", "category_focus": "Consumer Dispute, E-commerce, Warranty Fraud", "contact_email": "consumer@tribunal.gov.in"},
            {"id": 7, "name": "Labor Grievance Tribunal", "code": "LGT", "category_focus": "Labor & Employment Dispute, Unpaid Wages", "contact_email": "labor@tribunal.gov.in"},
            {"id": 8, "name": "Anti-Corruption & Vigilance Cell", "code": "AVC", "category_focus": "Police Negligence & Misconduct, Bribery", "contact_email": "vigilance@gov.in"},
        ]

        for d in departments_data:
            existing = db.query(Department).filter(Department.id == d["id"]).first()
            if not existing:
                db.add(Department(**d))
        db.commit()

        # 2. Seed Default Settings
        print("Seeding System Settings...")
        settings_data = [
            {"key": "model_mode", "value": "transformer", "description": "Active NLP Model Mode: transformer or llm"},
            {"key": "critical_urgency_threshold", "value": "80", "description": "Score threshold for Critical urgency classification"},
            {"key": "ollama_model", "value": "llama3.1", "description": "Configured Ollama Model identifier"},
        ]
        for s in settings_data:
            existing = db.query(SystemSetting).filter(SystemSetting.key == s["key"]).first()
            if not existing:
                db.add(SystemSetting(**s))
        db.commit()

        # 3. Seed Users
        print("Seeding Users...")
        users_data = [
            {"email": "citizen@example.com", "full_name": "Ramesh Citizen", "password": "citizen123", "role": "citizen", "language_pref": "en"},
            {"email": "officer@police.gov.in", "full_name": "Inspector Vikram Rathore", "password": "officer123", "role": "officer", "department_id": 1, "language_pref": "hi"},
            {"email": "inspector@safety.gov.in", "full_name": "ACP Priya Venkatesh", "password": "officer123", "role": "officer", "department_id": 2, "language_pref": "te"},
            {"email": "admin@grievance.gov.in", "full_name": "Director Rajesh Sharma", "password": "admin123", "role": "admin", "department_id": 4, "language_pref": "en"},
            {"email": "superadmin@gov.in", "full_name": "System Super Administrator", "password": "superadmin123", "role": "super_admin", "language_pref": "en"}
        ]

        for u in users_data:
            existing = db.query(User).filter(User.email == u["email"]).first()
            if not existing:
                new_u = User(
                    email=u["email"],
                    full_name=u["full_name"],
                    hashed_password=hash_password(u["password"]),
                    role=u["role"],
                    department_id=u.get("department_id"),
                    language_pref=u["language_pref"],
                    is_active=True
                )
                db.add(new_u)
        db.commit()

        # 4. Seed Complaints from seed_complaints.json
        seed_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "seed_complaints.json"))
        if os.path.exists(seed_file):
            print(f"Loading Complaints from {seed_file}...")
            with open(seed_file, "r", encoding="utf-8") as f:
                complaint_records = json.load(f)

            count = 0
            for item in complaint_records:
                existing = db.query(Complaint).filter(Complaint.id == item["id"]).first()
                if not existing:
                    # Enrich with NLP pipeline
                    raw_text = item["raw_text"]
                    nlp_res = nlp_pipeline.process_complaint(raw_text)

                    # Department assignment
                    dept = db.query(Department).filter(Department.name == item.get("department_name")).first()
                    dept_id = dept.id if dept else nlp_res["department_id"]

                    created_at = datetime.datetime.utcnow() - datetime.timedelta(
                        days=int(item["id"].split("-")[-1]) % 12,
                        hours=int(item["id"].split("-")[-1]) % 24
                    )
                    sla_deadline = created_at + datetime.timedelta(hours=nlp_res["sla_hours"])

                    complaint = Complaint(
                        id=item["id"],
                        citizen_id=1,
                        citizen_name=item["citizen_name"],
                        citizen_contact=item["citizen_contact"],
                        citizen_email=item["citizen_email"],
                        raw_text=raw_text,
                        detected_lang=nlp_res["detected_lang"],
                        detected_lang_name=nlp_res["detected_lang_name"],
                        detected_lang_confidence=nlp_res["detected_lang_confidence"],
                        translated_text=nlp_res["translated_text"],
                        translation_confidence=nlp_res.get("translation_confidence", "high"),
                        language_coverage_confidence=nlp_res.get("language_coverage_confidence", "HIGH"),
                        emotion_label=item.get("emotion_label") or nlp_res["emotion_label"],
                        emotion_confidence=nlp_res["emotion_confidence"],
                        emotion_scores=nlp_res["emotion_scores"],
                        urgency_label=item.get("urgency_label") or nlp_res["urgency_label"],
                        urgency_score=nlp_res["urgency_score"],
                        category=item.get("category") or nlp_res["category"],
                        department_id=dept_id,
                        status=item.get("status", "Submitted"),
                        sla_hours=nlp_res["sla_hours"],
                        sla_deadline=sla_deadline,
                        explanation_text=nlp_res["explanation_text"],
                        trigger_keywords=nlp_res["trigger_keywords"],
                        evidence_files=[],
                        model_mode_used="Fine-Tuned Transformer (Legal-DistilRoBERTa)",
                        created_at=created_at
                    )
                    db.add(complaint)

                    # Audit Log
                    audit = AuditLog(
                        complaint_id=complaint.id,
                        user_name="Automated Ingestion Queue",
                        action="Created & AI-Classified",
                        details=f"Classified urgency {complaint.urgency_label} ({complaint.urgency_score}/100), Emotion: {complaint.emotion_label}",
                        timestamp=created_at
                    )
                    db.add(audit)

                    # Vector Index
                    vector_service.add_complaint(
                        complaint_id=complaint.id,
                        text=f"{complaint.raw_text} {complaint.translated_text}",
                        category=complaint.category,
                        urgency=complaint.urgency_label
                    )

                    count += 1
                    if count % 50 == 0:
                        db.commit()
                        print(f"Seeded {count} complaints...")

            db.commit()
            print(f"Successfully seeded {count} complaint records into database!")

            # Seed Open-Set Multilingual Evaluation Cases
            try:
                from seed_open_set import seed_open_set_batch
                seed_open_set_batch()
            except ImportError:
                from scripts.seed_open_set import seed_open_set_batch
                seed_open_set_batch()

    except Exception as e:
        db.rollback()
        print(f"Seeding error: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
