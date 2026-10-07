import csv
import io
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Department, User, SystemSetting, Complaint
from app.schemas import DepartmentOut, DepartmentCreate
from app.auth import get_current_user, require_role
from app.services.llm_service import llm_service
from app.services.evaluator import evaluator_service

router = APIRouter(prefix="/admin", tags=["Admin & System Settings"])

@router.get("/departments", response_model=List[DepartmentOut])
def list_departments(db: Session = Depends(get_db)):
    return db.query(Department).all()

@router.post("/departments", response_model=DepartmentOut)
def create_department(dept_in: DepartmentCreate, db: Session = Depends(get_db)):
    dept = Department(**dept_in.dict())
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept

from app.services.supabase_service import supabase_service
from app.models import AuditLog

@router.get("/users")
def list_all_users(role: Optional[str] = None, db: Session = Depends(get_db)):
    """List all registered users (Citizens, Officers, Admins) from DB or Supabase."""
    query = db.query(User)
    if role and role != "all":
        query = query.filter(User.role == role)
    users = query.order_by(User.created_at.desc()).all()

    return [
        {
            "id": str(u.id),
            "name": u.full_name,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "language_pref": u.language_pref,
            "department_id": u.department_id,
            "department_name": u.department.name if u.department else "Unassigned",
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "last_login": getattr(u, 'last_sign_in_at', None) or (u.created_at.isoformat() if u.created_at else None),
        }
        for u in users
    ]

@router.post("/users/create")
def create_staff_user(payload: dict, db: Session = Depends(get_db)):
    """Admin creates new Officer or Admin accounts."""
    email = payload.get("email")
    full_name = payload.get("name") or payload.get("full_name")
    password = payload.get("password", "SecureTempPass123!")
    role = payload.get("role", "officer")
    dept_id = payload.get("department_id")
    lang = payload.get("language_pref", "en")

    if not email or not full_name:
        raise HTTPException(status_code=400, detail="Name and email are required.")

    if role not in ["officer", "admin", "citizen"]:
        raise HTTPException(status_code=400, detail="Invalid role specified.")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email is already registered.")

    from app.auth import hash_password
    new_user = User(
        email=email,
        full_name=full_name,
        hashed_password=hash_password(password),
        role=role,
        department_id=dept_id,
        language_pref=lang,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Sync with Supabase Auth & public.users table if Supabase service configured
    if supabase_service.is_configured:
        try:
            supabase_service.client.auth.admin.create_user({
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {"full_name": full_name, "role": role, "language_pref": lang}
            })
        except Exception as e:
            pass

    return {
        "message": f"Successfully created {role.capitalize()} account for {email}",
        "user": {
            "id": str(new_user.id),
            "name": new_user.full_name,
            "email": new_user.email,
            "role": new_user.role,
            "department_id": new_user.department_id,
            "is_active": new_user.is_active
        }
    }

@router.patch("/users/{user_id}/role")
def update_user_role(user_id: int, payload: dict, db: Session = Depends(get_db)):
    """Promote citizen to officer or change role."""
    new_role = payload.get("role")
    dept_id = payload.get("department_id")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if new_role:
        user.role = new_role
    if dept_id is not None:
        user.department_id = dept_id

    db.commit()
    db.refresh(user)

    if supabase_service.is_configured:
        supabase_service.update_user_role(str(user_id), new_role, dept_id)

    return {"message": f"User role updated to {new_role}", "role": user.role, "department_id": user.department_id}

@router.patch("/users/{user_id}/status")
def toggle_user_status(user_id: int, payload: dict, db: Session = Depends(get_db)):
    """Suspend or reactivate user account."""
    is_active = payload.get("is_active", True)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = is_active
    db.commit()
    db.refresh(user)

    if supabase_service.is_configured:
        supabase_service.toggle_user_active(str(user_id), is_active)

    return {"message": f"User status set to {'Active' if is_active else 'Suspended'}", "is_active": user.is_active}

@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    """Delete a user account."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()

    if supabase_service.is_configured:
        supabase_service.delete_user(str(user_id))

    return {"message": "User account permanently removed"}

@router.get("/users/{user_id}/activity")
def get_user_activity(user_id: int, db: Session = Depends(get_db)):
    """Retrieve audit and activity history for a specific user."""
    logs = db.query(AuditLog).filter(AuditLog.user_id == user_id).order_by(AuditLog.timestamp.desc()).limit(50).all()
    return [
        {
            "id": l.id,
            "complaint_id": l.complaint_id,
            "action": l.action,
            "details": l.details,
            "timestamp": l.timestamp.isoformat() if l.timestamp else None
        }
        for l in logs
    ]

@router.get("/officers")
def list_officers(db: Session = Depends(get_db)):
    officers = db.query(User).filter(User.role.in_(["officer", "admin", "super_admin"])).all()
    return [
        {
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "department_id": u.department_id,
            "department_name": u.department.name if u.department else "Unassigned",
            "is_active": u.is_active
        }
        for u in officers
    ]

@router.get("/settings")
def get_settings(db: Session = Depends(get_db)):
    settings_items = db.query(SystemSetting).all()
    return {s.key: s.value for s in settings_items}

@router.post("/settings/toggle-model")
def toggle_model_mode(mode: str, db: Session = Depends(get_db)):
    if mode not in ["transformer", "llm"]:
        raise HTTPException(status_code=400, detail="Mode must be 'transformer' or 'llm'")

    setting = db.query(SystemSetting).filter(SystemSetting.key == "model_mode").first()
    if not setting:
        setting = SystemSetting(key="model_mode", value=mode, description="NLP Classification Engine")
        db.add(setting)
    else:
        setting.value = mode
    db.commit()
    return {"message": f"Classification model mode updated to '{mode}'", "active_mode": mode}

@router.get("/languages-config")
def get_languages_config():
    """Get current dynamic supported languages list and few-shot examples config."""
    import os, json
    config_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "few_shot_languages.json"))
    if os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"curated_languages": [], "few_shot_examples": []}

@router.post("/languages-config")
def update_languages_config(payload: dict):
    """Update supported languages or add new few-shot examples without code modification."""
    import os, json
    config_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "few_shot_languages.json"))
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    return {"message": "Languages & Few-Shot configuration updated successfully."}

@router.get("/llm-health")
async def check_llm_status():
    """Check if local Ollama server is accessible."""
    return await llm_service.check_health()

@router.get("/evaluation")
def get_evaluation_metrics():
    """Return Confusion Matrix, Precision, Recall, Macro-F1 across 50 benchmark cases."""
    return evaluator_service.evaluate_model()

@router.get("/export/csv")
def export_complaints_csv(db: Session = Depends(get_db)):
    """Export complaint records to CSV for administrative archiving and reporting."""
    complaints = db.query(Complaint).order_by(Complaint.created_at.desc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        "Complaint ID", "Citizen Name", "Detected Language", "Original Text",
        "Translated Text", "Emotion Label", "Emotion Confidence",
        "Urgency Level", "Urgency Score", "Category", "Department",
        "Status", "SLA Hours", "Model Mode", "Created At"
    ])

    for c in complaints:
        writer.writerow([
            c.id,
            c.citizen_name or "Anonymous",
            c.detected_lang_name,
            c.raw_text.replace("\n", " "),
            c.translated_text.replace("\n", " "),
            c.emotion_label,
            c.emotion_confidence,
            c.urgency_label,
            c.urgency_score,
            c.category,
            c.department.name if c.department else "Unassigned",
            c.status,
            c.sla_hours,
            c.model_mode_used,
            c.created_at.isoformat() if c.created_at else ""
        ])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=Legal_Complaints_Export.csv"}
    )
