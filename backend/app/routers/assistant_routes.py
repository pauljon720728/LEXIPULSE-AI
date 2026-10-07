from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models import Complaint
from app.schemas import AssistantQueryRequest, AssistantQueryResponse
from app.services.llm_service import llm_service

router = APIRouter(prefix="/assistant", tags=["AI Assistant"])

@router.post("/chat", response_model=AssistantQueryResponse)
async def query_ai_assistant(req: AssistantQueryRequest, db: Session = Depends(get_db)):
    query_lower = req.query.lower()
    
    # 1. Search for specific complaint reference if mentioned
    relevant = []
    context = ""

    if req.complaint_id or "cmp-" in query_lower:
        target_id = req.complaint_id
        if not target_id:
            # extract CMP-YYYY-XXXX from query
            import re
            m = re.search(r'cmp-\d{4}-\d{4}', query_lower)
            if m:
                target_id = m.group(0).upper()

        if target_id:
            complaint = db.query(Complaint).filter(Complaint.id == target_id).first()
            if complaint:
                context = (
                    f"Complaint {complaint.id}: Status is '{complaint.status}'. "
                    f"Urgency is {complaint.urgency_label} (Score: {complaint.urgency_score}). "
                    f"Category: {complaint.category}. Department: {complaint.department.name if complaint.department else 'General'}. "
                    f"Filed on {complaint.created_at.strftime('%Y-%m-%d')}. "
                    f"Explanation: {complaint.explanation_text}"
                )
                relevant.append({
                    "id": complaint.id,
                    "status": complaint.status,
                    "urgency": complaint.urgency_label,
                    "category": complaint.category
                })

    # 2. Officer queries like "summarize critical cybercrime" or "overview"
    if req.user_role in ["officer", "admin", "super_admin"]:
        if "critical" in query_lower or "cybercrime" in query_lower or "summary" in query_lower:
            criticals = db.query(Complaint).filter(
                Complaint.urgency_label == "Critical",
                Complaint.status != "Resolved"
            ).limit(5).all()

            context += f"\nActive Critical Grievances ({len(criticals)} found):\n"
            for c in criticals:
                context += f"- [{c.id}] {c.category}: {c.raw_text[:100]}... (SLA Deadline: {c.sla_deadline})\n"
                relevant.append({"id": c.id, "status": c.status, "urgency": c.urgency_label, "category": c.category})

    # 3. Query LLM Service
    llm_reply = await llm_service.query_assistant(req.query, context, role=req.user_role)
    
    # 4. Action suggestion if applicable
    action = None
    if "escalate" in query_lower:
        action = "Escalate Priority"
    elif "pdf" in query_lower or "report" in query_lower:
        action = "Download Case Dossier"

    return AssistantQueryResponse(
        response=llm_reply,
        relevant_complaints=relevant if relevant else None,
        action_suggested=action
    )
