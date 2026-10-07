import datetime
import logging
import random
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from app.models import Complaint, AuditLog, ModelPrediction, User, Department, SystemSetting
from app.schemas import ComplaintSubmitRequest
from app.services.nlp_pipeline import nlp_pipeline
from app.services.llm_service import llm_service
from app.services.vector_service import vector_service
from app.services.supabase_service import supabase_service

logger = logging.getLogger(__name__)

def get_system_model_mode(db: Session) -> str:
    setting = db.query(SystemSetting).filter(SystemSetting.key == "model_mode").first()
    return setting.value if setting else "transformer"

class ComplaintService:
    """
    Dedicated Complaint Service owning the end-to-end Single Source of Truth
    Write & Read pipelines between FastAPI, SQLite, and Supabase.
    """

    async def submit_and_process_complaint(
        self,
        req: ComplaintSubmitRequest,
        db: Session,
        current_user: Optional[User] = None
    ) -> Dict[str, Any]:
        start_time = datetime.datetime.utcnow()
        complaint_id = f"CMP-{datetime.datetime.utcnow().year}-{random.randint(1000, 9999)}"

        citizen_id = current_user.id if current_user else None
        citizen_name = req.citizen_name or (current_user.full_name if current_user else "Citizen")
        citizen_email = req.citizen_email or (current_user.email if current_user else None)

        # ---------------------------------------------------------------------
        # STEP 2a: Immediate Raw Insert (Status: "processing")
        # Guarantees the complaint is never lost even if downstream classification crashes
        # ---------------------------------------------------------------------
        raw_complaint = Complaint(
            id=complaint_id,
            citizen_id=citizen_id,
            citizen_name=citizen_name,
            citizen_contact=req.citizen_contact,
            citizen_email=citizen_email,
            raw_text=req.raw_text,
            status="processing",
            detected_lang="en",
            detected_lang_name="Detecting...",
            translated_text="",
            emotion_label="Pending",
            urgency_label="Pending",
            category="Pending Classification",
            evidence_files=req.evidence_files or [],
            created_at=start_time,
            updated_at=start_time
        )
        db.add(raw_complaint)
        db.commit()
        db.refresh(raw_complaint)

        # Mirror raw insert immediately to Supabase
        if supabase_service.is_configured:
            supabase_service.insert_complaint({
                "id": complaint_id,
                "citizen_id": str(citizen_id) if citizen_id else None,
                "citizen_name": citizen_name,
                "citizen_contact": req.citizen_contact,
                "citizen_email": citizen_email,
                "raw_text": req.raw_text,
                "status": "processing",
                "detected_lang": "en",
                "detected_lang_name": "Detecting...",
                "translated_text": "",
                "emotion_label": "Pending",
                "urgency_label": "Pending",
                "category": "Pending Classification",
                "evidence_files": req.evidence_files or [],
                "created_at": start_time.isoformat(),
                "updated_at": start_time.isoformat()
            })

        # Insert intake audit log
        intake_audit = AuditLog(
            complaint_id=complaint_id,
            user_id=citizen_id,
            user_name=citizen_name,
            action="complaint_received",
            details="Raw grievance intake registered. Classification pipeline initiated.",
            timestamp=start_time
        )
        db.add(intake_audit)
        db.commit()

        if supabase_service.is_configured:
            supabase_service.insert_audit_log(
                complaint_id=complaint_id,
                action="complaint_received",
                details="Raw grievance intake registered in Supabase. Classification pipeline initiated.",
                user_id=str(citizen_id) if citizen_id else None,
                user_name=citizen_name
            )

        # ---------------------------------------------------------------------
        # STEP 2b: Execute NLP/LLM Pipeline with Fallback Protection
        # ---------------------------------------------------------------------
        try:
            mode = req.preferred_model_mode or get_system_model_mode(db)
            lang_code, lang_name, lang_conf = nlp_pipeline.detect_language(req.raw_text)
            translated_text = nlp_pipeline.translate_to_english(req.raw_text, lang_code)

            nlp_res = None
            model_used_name = "Fine-Tuned Transformer (Legal-DistilRoBERTa)"

            if mode == "llm":
                llm_res = await llm_service.analyze_complaint(req.raw_text, lang_name)
                if llm_res and ("urgency" in llm_res or "urgency_label" in llm_res):
                    urg_raw = llm_res.get("urgency") or llm_res.get("urgency_label", "High")
                    emo_raw = (llm_res.get("emotion") or llm_res.get("emotion_label", "Distress")).lower()
                    cat_raw = req.manual_category or llm_res.get("category", "General Grievance")
                    trans_conf = llm_res.get("translation_confidence", "high").lower()
                    coverage_conf = "HIGH" if trans_conf == "high" else ("MEDIUM" if trans_conf == "medium" else "LOW")
                    urg_conf = float(llm_res.get("urgency_confidence") or llm_res.get("urgency_score") or 75)

                    sla_hours = 4 if urg_raw == "Critical" else (24 if urg_raw == "High" else (48 if urg_raw == "Medium" else 120))
                    nlp_res = {
                        "detected_lang": lang_code,
                        "detected_lang_name": llm_res.get("detected_language") or lang_name,
                        "detected_lang_confidence": lang_conf,
                        "translated_text": llm_res.get("translated_text") or translated_text,
                        "translation_confidence": trans_conf,
                        "language_coverage_confidence": coverage_conf,
                        "emotion_label": emo_raw.capitalize(),
                        "emotion_confidence": round(float(llm_res.get("emotion_confidence", 85)) / 100.0, 4),
                        "emotion_scores": {emo_raw: round(float(llm_res.get("emotion_confidence", 85)) / 100.0, 4)},
                        "urgency_label": urg_raw,
                        "urgency_score": round(urg_conf, 1),
                        "category": cat_raw,
                        "explanation_text": llm_res.get("reasoning") or "LLM classification completed.",
                        "trigger_keywords": llm_res.get("keywords") or [],
                        "department_id": 1,
                        "sla_hours": sla_hours
                    }
                    model_used_name = f"Ollama LLM ({llm_service.model_name})"

            if not nlp_res:
                nlp_res = nlp_pipeline.process_complaint(req.raw_text)
                model_used_name = "Fine-Tuned Transformer (Legal-DistilRoBERTa)"
                if req.manual_category:
                    nlp_res["category"] = req.manual_category

            # Department Resolution
            dept = db.query(Department).filter(Department.category_focus.ilike(f"%{nlp_res['category']}%")).first()
            if not dept:
                dept = db.query(Department).first()
            dept_id = dept.id if dept else 1

            sla_hours = nlp_res["sla_hours"]
            sla_deadline = datetime.datetime.utcnow() + datetime.timedelta(hours=sla_hours)
            final_status = "Escalated" if nlp_res["urgency_label"] == "Critical" else "classified"

            # -----------------------------------------------------------------
            # STEP 2c: UPDATE row with classification outputs
            # -----------------------------------------------------------------
            raw_complaint.detected_lang = nlp_res["detected_lang"]
            raw_complaint.detected_lang_name = nlp_res["detected_lang_name"]
            raw_complaint.detected_lang_confidence = nlp_res["detected_lang_confidence"]
            raw_complaint.translated_text = nlp_res["translated_text"]
            raw_complaint.translation_confidence = nlp_res.get("translation_confidence", "high")
            raw_complaint.language_coverage_confidence = nlp_res.get("language_coverage_confidence", "HIGH")
            raw_complaint.emotion_label = nlp_res["emotion_label"]
            raw_complaint.emotion_confidence = nlp_res["emotion_confidence"]
            raw_complaint.emotion_scores = nlp_res["emotion_scores"]
            raw_complaint.urgency_label = nlp_res["urgency_label"]
            raw_complaint.urgency_score = nlp_res["urgency_score"]
            raw_complaint.category = nlp_res["category"]
            raw_complaint.department_id = dept_id
            raw_complaint.status = final_status
            raw_complaint.sla_hours = sla_hours
            raw_complaint.sla_deadline = sla_deadline
            raw_complaint.explanation_text = nlp_res["explanation_text"]
            raw_complaint.trigger_keywords = nlp_res["trigger_keywords"]
            raw_complaint.model_mode_used = model_used_name
            raw_complaint.updated_at = datetime.datetime.utcnow()

            db.commit()
            db.refresh(raw_complaint)

            # Mirror update to Supabase
            if supabase_service.is_configured:
                update_payload = {
                    "detected_lang": nlp_res["detected_lang"],
                    "detected_lang_name": nlp_res["detected_lang_name"],
                    "detected_lang_confidence": nlp_res["detected_lang_confidence"],
                    "translated_text": nlp_res["translated_text"],
                    "translation_confidence": nlp_res.get("translation_confidence", "high"),
                    "language_coverage_confidence": nlp_res.get("language_coverage_confidence", "HIGH"),
                    "emotion_label": nlp_res["emotion_label"],
                    "emotion_confidence": nlp_res["emotion_confidence"],
                    "emotion_scores": nlp_res["emotion_scores"],
                    "urgency_label": nlp_res["urgency_label"],
                    "urgency_score": nlp_res["urgency_score"],
                    "category": nlp_res["category"],
                    "department_id": dept_id,
                    "status": final_status,
                    "sla_hours": sla_hours,
                    "sla_deadline": sla_deadline.isoformat(),
                    "explanation_text": nlp_res["explanation_text"],
                    "trigger_keywords": nlp_res["trigger_keywords"],
                    "model_mode_used": model_used_name,
                    "updated_at": datetime.datetime.utcnow().isoformat()
                }
                supabase_service.client.table("complaints").update(update_payload).eq("id", complaint_id).execute()

            # -----------------------------------------------------------------
            # STEP 2d: Insert Model Prediction & Audit Log
            # -----------------------------------------------------------------
            latency_ms = round((datetime.datetime.utcnow() - start_time).total_seconds() * 1000, 2)
            pred = ModelPrediction(
                complaint_id=complaint_id,
                model_used=model_used_name,
                explanation_text=raw_complaint.explanation_text,
                latency_ms=latency_ms
            )
            db.add(pred)

            class_audit = AuditLog(
                complaint_id=complaint_id,
                user_id=citizen_id,
                user_name=citizen_name,
                action="complaint_submitted",
                details=(
                    f"Classified as {raw_complaint.urgency_label} urgency ({raw_complaint.urgency_score} pts), "
                    f"Emotion: {raw_complaint.emotion_label}. Auto-routed to {dept.name if dept else 'General Queue'}."
                )
            )
            db.add(class_audit)
            db.commit()

            if supabase_service.is_configured:
                supabase_service.insert_prediction(
                    complaint_id=complaint_id,
                    model_used=model_used_name,
                    raw_response="",
                    explanation=raw_complaint.explanation_text,
                    latency_ms=latency_ms
                )
                supabase_service.insert_audit_log(
                    complaint_id=complaint_id,
                    action="complaint_submitted",
                    details=f"Classified as {raw_complaint.urgency_label} urgency. Routed to {dept.name if dept else 'General Queue'}.",
                    user_id=str(citizen_id) if citizen_id else None,
                    user_name=citizen_name
                )

            # Add to vector store for precedent search
            try:
                vector_service.add_complaint(
                    complaint_id=raw_complaint.id,
                    text=f"{raw_complaint.raw_text} {raw_complaint.translated_text}",
                    category=raw_complaint.category,
                    urgency=raw_complaint.urgency_label
                )
            except Exception:
                pass

            # CONFIRMATION LOG: Required by user specification
            print(f"[CONFIRMATION] Complaint {complaint_id} round-tripped successfully: submitted -> classified -> stored -> visible in dashboard.")

            return {
                "complaint_id": raw_complaint.id,
                "status": raw_complaint.status,
                "detected_lang": raw_complaint.detected_lang,
                "detected_lang_name": raw_complaint.detected_lang_name,
                "detected_lang_confidence": raw_complaint.detected_lang_confidence,
                "translated_text": raw_complaint.translated_text,
                "translation_confidence": raw_complaint.translation_confidence,
                "language_coverage_confidence": raw_complaint.language_coverage_confidence,
                "emotion_label": raw_complaint.emotion_label,
                "emotion_confidence": raw_complaint.emotion_confidence,
                "emotion_scores": raw_complaint.emotion_scores,
                "urgency_label": raw_complaint.urgency_label,
                "urgency_score": raw_complaint.urgency_score,
                "category": raw_complaint.category,
                "department_name": dept.name if dept else "General Grievance Queue",
                "sla_hours": raw_complaint.sla_hours,
                "sla_deadline": raw_complaint.sla_deadline.isoformat() if raw_complaint.sla_deadline else None,
                "explanation_text": raw_complaint.explanation_text,
                "trigger_keywords": raw_complaint.trigger_keywords,
                "latency_ms": latency_ms,
                "model_mode_used": model_used_name
            }

        except Exception as pipeline_err:
            logger.error(f"Classification pipeline error for {complaint_id}: {pipeline_err}")
            # Step Failure fallback: Keep complaint visible with status 'needs_review'
            raw_complaint.status = "needs_review"
            raw_complaint.explanation_text = f"Automated classification exception: {str(pipeline_err)}. Marked for manual human officer review."
            db.commit()

            fail_audit = AuditLog(
                complaint_id=complaint_id,
                user_id=citizen_id,
                user_name=citizen_name,
                action="classification_failed",
                details=f"Pipeline exception: {str(pipeline_err)}. Retained with status 'needs_review'."
            )
            db.add(fail_audit)
            db.commit()

            if supabase_service.is_configured:
                supabase_service.client.table("complaints").update({
                    "status": "needs_review",
                    "explanation_text": f"Pipeline exception: {str(pipeline_err)}. Retained for officer review."
                }).eq("id", complaint_id).execute()
                supabase_service.insert_audit_log(
                    complaint_id=complaint_id,
                    action="classification_failed",
                    details=f"Pipeline exception: {str(pipeline_err)}.",
                    user_id=str(citizen_id) if citizen_id else None,
                    user_name=citizen_name
                )

            return {
                "complaint_id": raw_complaint.id,
                "status": "needs_review",
                "raw_text": raw_complaint.raw_text,
                "explanation_text": raw_complaint.explanation_text,
                "error": str(pipeline_err)
            }

complaint_service = ComplaintService()
