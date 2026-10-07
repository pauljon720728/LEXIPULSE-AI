import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Float, DateTime, ForeignKey, Boolean, JSON
)
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), default="citizen", nullable=False)  # citizen, officer, admin, super_admin
    language_pref = Column(String(10), default="en")
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    department = relationship("Department", back_populates="officers")
    complaints = relationship("Complaint", back_populates="citizen", foreign_keys="Complaint.citizen_id")
    assigned_complaints = relationship("Complaint", back_populates="assigned_officer", foreign_keys="Complaint.assigned_officer_id")
    audit_logs = relationship("AuditLog", back_populates="user")


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    category_focus = Column(String(255), nullable=False)  # e.g., "cybercrime, fraud"
    description = Column(Text, nullable=True)
    contact_email = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    officers = relationship("User", back_populates="department")
    complaints = relationship("Complaint", back_populates="department")


class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(String(64), primary_key=True, index=True)  # e.g., "CMP-2026-0042"
    citizen_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    citizen_name = Column(String(255), nullable=True)
    citizen_contact = Column(String(100), nullable=True)
    citizen_email = Column(String(255), nullable=True)

    # Core NLP Inputs & Detection
    raw_text = Column(Text, nullable=False)
    detected_lang = Column(String(20), default="en", nullable=True)
    detected_lang_name = Column(String(50), default="English")
    detected_lang_confidence = Column(Float, default=1.0)
    translated_text = Column(Text, default="", nullable=True)
    translation_confidence = Column(String(20), default="high")  # high, medium, low
    language_coverage_confidence = Column(String(20), default="HIGH")  # HIGH, MEDIUM, LOW

    # Classification Outputs
    emotion_label = Column(String(50), default="Pending", nullable=True)  # anger, fear, distress, neutral, desperation, frustration, sadness
    emotion_confidence = Column(Float, default=0.0)
    emotion_scores = Column(JSON, default=dict)  # {"anger": 0.12, "fear": 0.88, ...}

    urgency_label = Column(String(50), default="Pending", nullable=True)  # Critical, High, Medium, Low
    urgency_score = Column(Float, default=0.0)  # 0 to 100

    category = Column(String(100), default="Pending Classification", nullable=True)  # Cybercrime, Domestic Violence, etc.

    # Explainable AI
    explanation_text = Column(Text, nullable=True)
    trigger_keywords = Column(JSON, default=list)  # ["immediate threat", "repeated assault", "kill"]

    # Routing and SLA
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    assigned_officer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(50), default="processing")  # processing, classified, needs_review, Submitted, Under Review, Escalated, In Investigation, Resolved, Dismissed
    sla_hours = Column(Integer, default=24)
    sla_deadline = Column(DateTime, nullable=True)

    # Metadata & Files
    evidence_files = Column(JSON, default=list)
    model_mode_used = Column(String(50), default="transformer")  # "transformer" or "llm"
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    citizen = relationship("User", foreign_keys=[citizen_id], back_populates="complaints")
    assigned_officer = relationship("User", foreign_keys=[assigned_officer_id], back_populates="assigned_complaints")
    department = relationship("Department", back_populates="complaints")
    audit_logs = relationship("AuditLog", back_populates="complaint", cascade="all, delete-orphan")
    predictions = relationship("ModelPrediction", back_populates="complaint", cascade="all, delete-orphan")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(String(64), ForeignKey("complaints.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_name = Column(String(255), default="System")
    action = Column(String(100), nullable=False)  # e.g., "Created", "Viewed", "Escalated", "Status Changed", "Reassigned"
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)

    complaint = relationship("Complaint", back_populates="audit_logs")
    user = relationship("User", back_populates="audit_logs")


class ModelPrediction(Base):
    __tablename__ = "model_predictions"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(String(64), ForeignKey("complaints.id"), nullable=False)
    model_used = Column(String(100), nullable=False)  # "Fine-Tuned Transformer", "Ollama LLM (llama3.1)"
    raw_llm_response = Column(Text, nullable=True)
    explanation_text = Column(Text, nullable=True)
    latency_ms = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    complaint = relationship("Complaint", back_populates="predictions")


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, index=True, nullable=False)
    value = Column(String(255), nullable=False)
    description = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
