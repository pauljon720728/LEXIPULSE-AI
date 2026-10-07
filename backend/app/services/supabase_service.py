import datetime
import logging
from typing import Optional, List, Dict, Any
from app.config import settings

logger = logging.getLogger(__name__)

class SupabaseService:
    def __init__(self):
        self.client = None
        self.anon_client = None
        self._init_client()

    def _init_client(self):
        url = settings.SUPABASE_URL
        key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY
        anon_key = settings.SUPABASE_ANON_KEY

        if url and key and url.startswith("https://") and "your-project" not in url:
            try:
                from supabase import create_client
                self.client = create_client(url, key)
                if anon_key:
                    self.anon_client = create_client(url, anon_key)
                else:
                    self.anon_client = self.client
                logger.info("Supabase client initialized successfully on backend.")
            except Exception as e:
                logger.warning(f"Could not initialize Supabase client: {e}")
                self.client = None
                self.anon_client = None
        else:
            self.client = None
            self.anon_client = None

    @property
    def is_configured(self) -> bool:
        return self.client is not None

    def verify_user_credentials(self, email: str, password: str) -> Optional[Dict[str, Any]]:
        """Verify user login against Supabase Auth directly."""
        client_to_use = self.anon_client or self.client
        if not client_to_use:
            return None
        try:
            res = client_to_use.auth.sign_in_with_password({"email": email, "password": password})
            if res and res.user:
                return {
                    "id": res.user.id,
                    "email": res.user.email,
                    "user_metadata": res.user.user_metadata or {}
                }
        except Exception:
            return None
        return None

    def provision_auth_user(self, email: str, password: str, full_name: str, role: str = "citizen", language_pref: str = "en", phone: str = "") -> Optional[str]:
        """Provision user in Supabase Auth with auto email-confirmation and matching public.users row."""
        if not self.client:
            return None
        user_uid = None
        try:
            auth_res = self.client.auth.admin.create_user({
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {
                    "full_name": full_name,
                    "role": role,
                    "language_pref": language_pref,
                    "phone": phone
                }
            })
            if auth_res and hasattr(auth_res, "user") and auth_res.user:
                user_uid = auth_res.user.id
        except Exception as e:
            # User might already exist; update their password and confirm email
            try:
                for u in self.client.auth.admin.list_users():
                    if u.email == email:
                        self.client.auth.admin.update_user_by_id(u.id, {
                            "password": password,
                            "email_confirm": True,
                            "user_metadata": {
                                "full_name": full_name,
                                "role": role,
                                "language_pref": language_pref,
                                "phone": phone
                            }
                        })
                        user_uid = u.id
                        break
            except Exception:
                pass

        if user_uid:
            try:
                self.client.table("users").upsert({
                    "id": str(user_uid),
                    "name": full_name,
                    "email": email,
                    "role": role,
                    "language_pref": language_pref,
                    "phone": phone,
                    "is_active": True
                }, on_conflict="id").execute()
            except Exception as e:
                logger.warning(f"Could not upsert into public.users: {e}")

    def get_user_uuid_by_email(self, email: str) -> Optional[str]:
        if not self.client or not email:
            return None
        try:
            res = self.client.table("users").select("id").eq("email", email.strip()).limit(1).execute()
            if res.data and len(res.data) > 0:
                return str(res.data[0]["id"])
            for u in self.client.auth.admin.list_users():
                if u.email == email.strip():
                    return str(u.id)
        except Exception:
            pass
        return None

    @staticmethod
    def _sanitize_uuid(val: Any) -> Optional[str]:
        if not val:
            return None
        s = str(val).strip()
        try:
            import uuid
            uuid.UUID(s)
            return s
        except (ValueError, AttributeError):
            return None

    def insert_complaint(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not self.client:
            return None
        try:
            clean_data = dict(data)
            # Ensure citizen_id is a valid UUID or looked up via citizen_email
            raw_cid = clean_data.get("citizen_id")
            valid_uuid = self._sanitize_uuid(raw_cid)
            if not valid_uuid and clean_data.get("citizen_email"):
                valid_uuid = self.get_user_uuid_by_email(clean_data["citizen_email"])
            clean_data["citizen_id"] = valid_uuid

            res = self.client.table("complaints").upsert(clean_data, on_conflict="id").execute()
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
            valid_off_id = self._sanitize_uuid(officer_id)
            if valid_off_id:
                payload["assigned_officer_id"] = valid_off_id
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
            valid_uid = self._sanitize_uuid(user_id)
            if valid_uid:
                payload["user_id"] = valid_uid
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
