import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

# User Schemas
class UserBase(BaseModel):
    email: str
    full_name: str
    role: str = "citizen"
    language_pref: str = "en"
    department_id: Optional[int] = None

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: str
    password: str
    role: Optional[str] = None

class UserOut(UserBase):
    id: int
    is_active: bool
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut

# Department Schemas
class DepartmentBase(BaseModel):
    name: str
    code: str
    category_focus: str
    description: Optional[str] = None
    contact_email: Optional[str] = None

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentOut(DepartmentBase):
    id: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True

# Complaint Schemas
class ComplaintSubmitRequest(BaseModel):
    raw_text: str = Field(..., min_length=10, description="Complaint text in any supported language")
    citizen_name: Optional[str] = "Anonymous Citizen"
    citizen_contact: Optional[str] = None
    citizen_email: Optional[str] = None
    manual_category: Optional[str] = None
    evidence_files: Optional[List[str]] = []
    preferred_model_mode: Optional[str] = None  # "transformer" or "llm"

class PipelineStepResult(BaseModel):
    step: str
    status: str
    message: str
    data: Optional[Dict[str, Any]] = None

class ComplaintDetailOut(BaseModel):
    model_config = {"protected_namespaces": (), "from_attributes": True}

    id: str
    citizen_id: Optional[int] = None
    citizen_name: Optional[str] = None
    citizen_contact: Optional[str] = None
    citizen_email: Optional[str] = None
    raw_text: str
    detected_lang: str
    detected_lang_name: str
    detected_lang_confidence: float
    translated_text: str
    translation_confidence: Optional[str] = "high"
    language_coverage_confidence: Optional[str] = "HIGH"
    emotion_label: str
    emotion_confidence: float
    emotion_scores: Dict[str, float]
    urgency_label: str
    urgency_score: float
    category: str
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    assigned_officer_id: Optional[int] = None
    assigned_officer_name: Optional[str] = None
    status: str
    sla_hours: int
    sla_deadline: Optional[datetime.datetime] = None
    explanation_text: Optional[str] = None
    trigger_keywords: List[str] = []
    evidence_files: List[str] = []
    model_mode_used: str
    created_at: datetime.datetime
    updated_at: datetime.datetime
    resolved_at: Optional[datetime.datetime] = None
    resolution_notes: Optional[str] = None
    resolved_by: Optional[str] = None

class ComplaintUpdateStatus(BaseModel):
    status: str  # Submitted, Under Review, Escalated, In Investigation, Resolved, Dismissed
    assigned_officer_id: Optional[int] = None
    notes: Optional[str] = None
    resolution_notes: Optional[str] = None
    resolved_by: Optional[str] = None

class ComplaintFilterParams(BaseModel):
    urgency: Optional[str] = None
    emotion: Optional[str] = None
    category: Optional[str] = None
    language: Optional[str] = None
    status: Optional[str] = None
    department_id: Optional[int] = None
    search: Optional[str] = None
    page: int = 1
    page_size: int = 20

# Analytics Schemas
class KPISummary(BaseModel):
    total_complaints: int
    critical_open: int
    high_open: int
    avg_resolution_hours: float
    resolved_count: int
    pending_count: int

class AnalyticsData(BaseModel):
    kpi: KPISummary
    urgency_distribution: Dict[str, int]
    emotion_distribution: Dict[str, int]
    category_distribution: Dict[str, int]
    language_distribution: Dict[str, int]
    department_load: List[Dict[str, Any]]
    time_series_urgency: List[Dict[str, Any]]
    top_trigger_words: List[Dict[str, Any]]
    fairness_metrics: List[Dict[str, Any]]

# Evaluation Schemas
class EvaluationMetrics(BaseModel):
    total_samples: int
    emotion_accuracy: float
    emotion_f1_macro: float
    urgency_accuracy: float
    urgency_f1_macro: float
    category_accuracy: float
    confusion_matrix_urgency: Dict[str, Any]
    confusion_matrix_emotion: Dict[str, Any]
    per_language_accuracy: Dict[str, Dict[str, float]]
    evaluated_at: datetime.datetime

# Assistant Schemas
class AssistantQueryRequest(BaseModel):
    query: str
    user_role: str = "citizen"
    complaint_id: Optional[str] = None
    language: str = "en"

class AssistantQueryResponse(BaseModel):
    response: str
    relevant_complaints: Optional[List[Dict[str, Any]]] = None
    action_suggested: Optional[str] = None
