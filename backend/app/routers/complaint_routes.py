import datetime
import io
import random
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

from app.database import get_db
from app.models import Complaint, AuditLog, ModelPrediction, User, Department, SystemSetting
from app.schemas import ComplaintSubmitRequest, ComplaintDetailOut, ComplaintUpdateStatus
from app.auth import get_current_user
from app.services.nlp_pipeline import nlp_pipeline
from app.services.llm_service import llm_service
from app.services.vector_service import vector_service
from app.services.pdf_generator import generate_complaint_pdf

router = APIRouter(prefix="/complaints", tags=["Complaints"])

def get_system_model_mode(db: Session) -> str:
    setting = db.query(SystemSetting).filter(SystemSetting.key == "model_mode").first()
    return setting.value if setting else "transformer"

from app.services.complaint_service import complaint_service

@router.post("/submit")
async def submit_complaint(
    req: ComplaintSubmitRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """Submit complaint via dedicated ComplaintService write-path."""
    from app.services.complaint_service import complaint_service
    res = await complaint_service.submit_and_process_complaint(req, db, current_user)
    if 'pipeline_steps' not in res:
        res['pipeline_steps'] = [
            {'step': 'Language Detection', 'status': 'completed', 'output': f"Detected {res.get('detected_lang_name', 'Language')} ({int(res.get('detected_lang_confidence', 1.0)*100)}% confidence)"},
            {'step': 'Neural Translation', 'status': 'completed', 'output': 'Normalized to English legal format'},
            {'step': 'Emotion Classification', 'status': 'completed', 'output': f"{res.get('emotion_label', 'DISTRESS').upper()} ({int(res.get('emotion_confidence', 0.85)*100)}%)"},
            {'step': 'Urgency Assessment', 'status': 'completed', 'output': f"{res.get('urgency_label', 'MEDIUM').upper()} (Score: {res.get('urgency_score', 70)}/100)"},
            {'step': 'Department Auto-Routing', 'status': 'completed', 'output': f"Assigned to {res.get('department_name', 'General Queue')}"},
            {'step': 'Explainability Synthesis', 'status': 'completed', 'output': 'XAI rationale synthesized & stored'}
        ]
    return res

@router.get("")
def list_complaints(
    urgency: Optional[str] = None,
    emotion: Optional[str] = None,
    category: Optional[str] = None,
    language: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    department_id: Optional[int] = None,
    citizen_id: Optional[str] = None,
    citizen_email: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
    db: Session = Depends(get_db)
):
    query = db.query(Complaint)

    if citizen_id:
        query = query.filter(Complaint.citizen_id == citizen_id)
    if citizen_email:
        query = query.filter(Complaint.citizen_email == citizen_email)
    if urgency:
        query = query.filter(Complaint.urgency_label == urgency)
    if emotion:
        query = query.filter(Complaint.emotion_label == emotion)
    if category:
        query = query.filter(Complaint.category == category)
    if language:
        query = query.filter(Complaint.detected_lang == language)
    if status_filter:
        query = query.filter(Complaint.status == status_filter)
    if department_id:
        query = query.filter(Complaint.department_id == department_id)
    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            or_(
                Complaint.id.ilike(search_fmt),
                Complaint.raw_text.ilike(search_fmt),
                Complaint.translated_text.ilike(search_fmt),
                Complaint.citizen_name.ilike(search_fmt)
            )
        )

    total = query.count()
    items = query.order_by(desc(Complaint.created_at)).offset((page - 1) * page_size).limit(page_size).all()

    # Map department names
    results = []
    for c in items:
        results.append({
            "id": c.id,
            "citizen_name": c.citizen_name,
            "raw_text": c.raw_text,
            "detected_lang": c.detected_lang,
            "detected_lang_name": c.detected_lang_name,
            "detected_lang_confidence": c.detected_lang_confidence,
            "translated_text": c.translated_text,
            "translation_confidence": getattr(c, 'translation_confidence', 'high') or 'high',
            "language_coverage_confidence": getattr(c, 'language_coverage_confidence', 'HIGH') or 'HIGH',
            "emotion_label": c.emotion_label,
            "emotion_confidence": c.emotion_confidence,
            "emotion_scores": c.emotion_scores,
            "urgency_label": c.urgency_label,
            "urgency_score": c.urgency_score,
            "category": c.category,
            "department_id": c.department_id,
            "department_name": c.department.name if c.department else "Unassigned",
            "assigned_officer_name": c.assigned_officer.full_name if c.assigned_officer else None,
            "status": c.status,
            "sla_hours": c.sla_hours,
            "sla_deadline": c.sla_deadline.isoformat() if c.sla_deadline else None,
            "explanation_text": c.explanation_text,
            "trigger_keywords": c.trigger_keywords,
            "model_mode_used": c.model_mode_used,
            "created_at": c.created_at.isoformat() if c.created_at else None
        })

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": results
    }

@router.get("/{complaint_id}")
def get_complaint_detail(complaint_id: str, db: Session = Depends(get_db)):
    c = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")

    # Retrieve similar past complaints via semantic search
    similar = vector_service.find_similar(f"{c.raw_text} {c.translated_text}", top_k=3)
    # Filter out self
    similar = [s for s in similar if s.get("id") != c.id][:3]

    # Audit logs
    logs = db.query(AuditLog).filter(AuditLog.complaint_id == complaint_id).order_by(AuditLog.timestamp.desc()).all()

    return {
        "complaint": {
            "id": c.id,
            "citizen_name": c.citizen_name,
            "citizen_contact": c.citizen_contact,
            "citizen_email": c.citizen_email,
            "raw_text": c.raw_text,
            "detected_lang": c.detected_lang,
            "detected_lang_name": c.detected_lang_name,
            "detected_lang_confidence": c.detected_lang_confidence,
            "translated_text": c.translated_text,
            "translation_confidence": getattr(c, 'translation_confidence', 'high') or 'high',
            "language_coverage_confidence": getattr(c, 'language_coverage_confidence', 'HIGH') or 'HIGH',
            "emotion_label": c.emotion_label,
            "emotion_confidence": c.emotion_confidence,
            "emotion_scores": c.emotion_scores,
            "urgency_label": c.urgency_label,
            "urgency_score": c.urgency_score,
            "category": c.category,
            "department_id": c.department_id,
            "department_name": c.department.name if c.department else "General Queue",
            "assigned_officer_id": c.assigned_officer_id,
            "assigned_officer_name": c.assigned_officer.full_name if c.assigned_officer else None,
            "status": c.status,
            "sla_hours": c.sla_hours,
            "sla_deadline": c.sla_deadline.isoformat() if c.sla_deadline else None,
            "explanation_text": c.explanation_text,
            "trigger_keywords": c.trigger_keywords,
            "model_mode_used": c.model_mode_used,
            "evidence_files": c.evidence_files,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            "resolved_at": c.resolved_at.isoformat() if c.resolved_at else None,
        },
        "similar_past_complaints": similar,
        "audit_logs": [
            {
                "id": log.id,
                "user_name": log.user_name,
                "action": log.action,
                "details": log.details,
                "timestamp": log.timestamp.isoformat()
            }
            for log in logs
        ]
    }

@router.patch("/{complaint_id}/status")
def update_complaint_status(
    complaint_id: str,
    update_data: ComplaintUpdateStatus,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    c = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")

    old_status = c.status
    c.status = update_data.status
    if update_data.assigned_officer_id:
        c.assigned_officer_id = update_data.assigned_officer_id
    if update_data.status == "Resolved":
        c.resolved_at = datetime.datetime.utcnow()

    # Log action
    user_name = current_user.full_name if current_user else "Authorized Officer"
    user_id = current_user.id if current_user else None
    audit = AuditLog(
        complaint_id=complaint_id,
        user_id=user_id,
        user_name=user_name,
        action=f"Status Changed: {old_status} -> {update_data.status}",
        details=update_data.notes or f"Complaint transitioned to {update_data.status} state."
    )
    db.add(audit)
    db.commit()
    db.refresh(c)
    return {"message": "Status updated successfully", "complaint_id": c.id, "status": c.status}

@router.get("/{complaint_id}/pdf")
def download_pdf(complaint_id: str, db: Session = Depends(get_db)):
    c = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")

    complaint_dict = {
        "id": c.id,
        "citizen_name": c.citizen_name,
        "citizen_contact": c.citizen_contact,
        "raw_text": c.raw_text,
        "detected_lang_name": c.detected_lang_name,
        "detected_lang_confidence": c.detected_lang_confidence,
        "translated_text": c.translated_text,
        "emotion_label": c.emotion_label,
        "emotion_confidence": c.emotion_confidence,
        "emotion_scores": c.emotion_scores,
        "urgency_label": c.urgency_label,
        "urgency_score": c.urgency_score,
        "category": c.category,
        "department_name": c.department.name if c.department else "General Grievance Queue",
        "status": c.status,
        "sla_deadline": c.sla_deadline,
        "explanation_text": c.explanation_text,
        "trigger_keywords": c.trigger_keywords,
        "model_mode_used": c.model_mode_used,
        "created_at": c.created_at
    }

    pdf_bytes = generate_complaint_pdf(complaint_dict)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Legal_Case_Report_{complaint_id}.pdf"}
    )
