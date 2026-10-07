import os
import sys
import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.database import SessionLocal
from app.models import Complaint, AuditLog
from app.services.nlp_pipeline import nlp_pipeline
from app.services.vector_service import vector_service

OPEN_SET_TEST_CASES = [
    {
        "id": "CMP-2026-2001",
        "citizen_name": "Siddharth Nair",
        "citizen_contact": "+91 9447123456",
        "raw_text": "എന്റെ ഭൂമി അയൽവാസി അനധികൃതമായി കൈയേറി വേലി കെട്ടി, ചോദിച്ചപ്പോൾ വധഭീഷണി മുഴക്കി, ജീവന് ഭയമുണ്ട്.",
        "lang": "ml",
        "notes": "Malayalam open-set land encroachment with death threat"
    },
    {
        "id": "CMP-2026-2002",
        "citizen_name": "Harpreet Singh",
        "citizen_contact": "+91 9814123456",
        "raw_text": "ਸਾਡੀ ਜ਼ਮੀਨ ਉੱਤੇ ਨਾਜਾਇਜ਼ ਕਬਜ਼ਾ ਕੀਤਾ ਗਿਆ ਹੈ ਅਤੇ ਗੁੰਡੇ ਹਥਿਆਰਾਂ ਨਾਲ ਜਾਨੋਂ ਮਾਰਨ ਦੀਆਂ ਧਮਕੀਆਂ ਦੇ ਰਹੇ ਹਨ।",
        "lang": "pa",
        "notes": "Punjabi open-set land dispute with armed goons"
    },
    {
        "id": "CMP-2026-2003",
        "citizen_name": "Jean-Luc Dubois",
        "citizen_contact": "+33 612345678",
        "raw_text": "On m'a facturé deux fois pour le même achat en ligne et le service client ne répond pas depuis 3 semaines.",
        "lang": "fr",
        "notes": "French consumer dispute billing error"
    },
    {
        "id": "CMP-2026-2004",
        "citizen_name": "Hans Schneider",
        "citizen_contact": "+49 1701234567",
        "raw_text": "Mein Bankkonto wurde durch Phishing-Betrug um 1200 Euro belastet und der Plattformbetreiber verweigert jede Hilfe.",
        "lang": "de",
        "notes": "German online phishing and banking fraud"
    },
    {
        "id": "CMP-2026-2005",
        "citizen_name": "Eknath Shinde",
        "citizen_contact": "+91 9822123456",
        "raw_text": "माझ्या बँक खात्यातून ऑनलाइन सायबर फसवणूक करून ५०,००० रुपये परस्पर काढण्यात आले आहेत, तातડીने खाते ब्लॉक करा.",
        "lang": "mr",
        "notes": "Marathi cyber fraud unauthorized withdrawal"
    },
    {
        "id": "CMP-2026-2006",
        "citizen_name": "Dharmesh Patel",
        "citizen_contact": "+91 9825123456",
        "raw_text": "મારા પતિ અને સાસરિયાઓ દહેજ માટે શારીરિક ત્રાસ આપી રહ્યા છે, મદદ કરો.",
        "lang": "gu",
        "notes": "Gujarati domestic abuse and physical assault"
    }
]

def seed_open_set_batch():
    db = SessionLocal()
    count = 0
    try:
        for item in OPEN_SET_TEST_CASES:
            existing = db.query(Complaint).filter(Complaint.id == item["id"]).first()
            if not existing:
                nlp_res = nlp_pipeline.process_complaint(item["raw_text"])
                created_at = datetime.datetime.utcnow() - datetime.timedelta(hours=count*2)
                sla_deadline = created_at + datetime.timedelta(hours=nlp_res["sla_hours"])

                c = Complaint(
                    id=item["id"],
                    citizen_name=item["citizen_name"],
                    citizen_contact=item["citizen_contact"],
                    raw_text=item["raw_text"],
                    detected_lang=nlp_res["detected_lang"],
                    detected_lang_name=nlp_res["detected_lang_name"],
                    detected_lang_confidence=nlp_res["detected_lang_confidence"],
                    translated_text=nlp_res["translated_text"],
                    translation_confidence=nlp_res.get("translation_confidence", "high"),
                    language_coverage_confidence=nlp_res.get("language_coverage_confidence", "HIGH"),
                    emotion_label=nlp_res["emotion_label"],
                    emotion_confidence=nlp_res["emotion_confidence"],
                    emotion_scores=nlp_res["emotion_scores"],
                    urgency_label=nlp_res["urgency_label"],
                    urgency_score=nlp_res["urgency_score"],
                    category=nlp_res["category"],
                    department_id=nlp_res["department_id"],
                    status="Submitted" if nlp_res["urgency_label"] != "Critical" else "Escalated",
                    sla_hours=nlp_res["sla_hours"],
                    sla_deadline=sla_deadline,
                    explanation_text=nlp_res["explanation_text"],
                    trigger_keywords=nlp_res["trigger_keywords"],
                    model_mode_used="Fine-Tuned Transformer (Open-Set Fallback)",
                    created_at=created_at
                )
                db.add(c)
                db.add(AuditLog(
                    complaint_id=c.id,
                    user_name="Open-Set Multilingual Ingestion",
                    action="Created & Fallback-Classified",
                    details=f"Language: {c.detected_lang_name}, Coverage: {c.language_coverage_confidence}, Urgency: {c.urgency_label}",
                    timestamp=created_at
                ))
                count += 1

        db.commit()
        print(f"Successfully seeded {count} open-set multilingual test cases into queue!")
    finally:
        db.close()

if __name__ == "__main__":
    seed_open_set_batch()
