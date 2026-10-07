# Backend Configuration
import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(ROOT_DIR, ".env"))
DEFAULT_DB_PATH = os.path.join(ROOT_DIR, "legal_complaints.db").replace("\\", "/")

class Settings(BaseSettings):
    PROJECT_NAME: str = "NLP-Based Legal Complaint Emotion & Urgency Classification System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-jwt-key-for-legal-complaint-system-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    # Database: Anchored to project root database
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")

    # Supabase Configuration
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    # Ollama settings
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3.1")

    # NLP Model Mode: "transformer" or "llm" (can be toggled at runtime via admin settings)
    DEFAULT_MODEL_MODE: str = os.getenv("DEFAULT_MODEL_MODE", "transformer")

    class Config:
        case_sensitive = True

settings = Settings()
