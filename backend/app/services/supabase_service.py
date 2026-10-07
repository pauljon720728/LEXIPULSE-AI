import datetime
import logging
from typing import Optional, List, Dict, Any
from app.config import settings

logger = logging.getLogger(__name__)

class SupabaseService:
    def __init__(self):
        self.client = None
        self._init_client()

    def _init_client(self):
        url = settings.SUPABASE_URL
        key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY

        if url and key and url.startswith("https://") and "your-project" not in url:
            try:
                from supabase import create_client
                self.client = create_client(url, key)
                logger.info("Supabase client initialized successfully on backend.")
            except Exception as e:
                logger.warning(f"Could not initialize Supabase client: {e}")
                self.client = None
        else:
            self.client = None

    @property
    def is_configured(self) -> bool:
        return self.client is not None

    def insert_complaint(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not self.client:
            return None
        try:
            res = self.client.table("complaints").insert(data).execute()
            return res.data[0] if res.data else None
        except Exception as e:
            logger.error(f"Error inserting complaint to Supabase: {e}")
            return None

    def update_complaint_status(self, complaint_id: str, status: str, officer_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        if not self.client:
            return None
        try:
            payload = {
                "status": status,
                "updated_at": datetime.datetime.utcnow().isoformat()
            }
            if officer_id:
                payload["assigned_officer_id"] = str(officer_id)
            if status == "Resolved":
                payload["resolved_at"] = datetime.datetime.utcnow().isoformat()

            res = self.client.table("complaints").update(payload).eq("id", complaint_id).execute()
            return res.data[0] if res.data else None
        except Exception as e:
            logger.error(f"Error updating complaint status in Supabase: {e}")
            return None

    def insert_audit_log(self, complaint_id: str, action: str, details: str = "", user_id: Optional[str] = None, user_name: str = "System") -> Optional[Dict[str, Any]]:
        if not self.client:
            return None
        try:
            payload = {
                "complaint_id": complaint_id,
                "action": action,
                "details": details,
                "user_name": user_name,
                "timestamp": datetime.datetime.utcnow().isoformat()
            }
            if user_id:
                payload["user_id"] = str(user_id)
            res = self.client.table("audit_log").insert(payload).execute()
            return res.data[0] if res.data else None
        except Exception as e:
            logger.error(f"Error inserting audit log in Supabase: {e}")
            return None

    def insert_prediction(self, complaint_id: str, model_used: str, raw_response: str = "", explanation: str = "", latency_ms: float = 0.0) -> Optional[Dict[str, Any]]:
        if not self.client:
            return None
        try:
            payload = {
                "complaint_id": complaint_id,
                "model_used": model_used,
                "raw_llm_response": raw_response,
                "explanation_text": explanation,
                "latency_ms": latency_ms,
                "created_at": datetime.datetime.utcnow().isoformat()
            }
            res = self.client.table("model_predictions").insert(payload).execute()
            return res.data[0] if res.data else None
        except Exception as e:
            logger.error(f"Error inserting prediction in Supabase: {e}")
            return None

    def get_all_users(self) -> List[Dict[str, Any]]:
        if not self.client:
            return []
        try:
            res = self.client.table("users").select("*, departments(id, name, code)").order("created_at", desc=True).execute()
            return res.data or []
        except Exception as e:
            logger.error(f"Error fetching users from Supabase: {e}")
            return []

    def update_user_role(self, user_id: str, role: str, department_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        if not self.client:
            return None
        try:
            payload = {"role": role, "updated_at": datetime.datetime.utcnow().isoformat()}
            if department_id is not None:
                payload["department_id"] = department_id
            res = self.client.table("users").update(payload).eq("id", str(user_id)).execute()
            return res.data[0] if res.data else None
        except Exception as e:
            logger.error(f"Error updating user role in Supabase: {e}")
            return None

    def toggle_user_active(self, user_id: str, is_active: bool) -> Optional[Dict[str, Any]]:
        if not self.client:
            return None
        try:
            payload = {"is_active": is_active, "updated_at": datetime.datetime.utcnow().isoformat()}
            res = self.client.table("users").update(payload).eq("id", str(user_id)).execute()
            return res.data[0] if res.data else None
        except Exception as e:
            logger.error(f"Error toggling user active in Supabase: {e}")
            return None

    def delete_user(self, user_id: str) -> bool:
        if not self.client:
            return False
        try:
            # Delete from auth if admin key available
            try:
                self.client.auth.admin.delete_user(str(user_id))
            except Exception:
                pass
            self.client.table("users").delete().eq("id", str(user_id)).execute()
            return True
        except Exception as e:
            logger.error(f"Error deleting user in Supabase: {e}")
            return False

supabase_service = SupabaseService()
