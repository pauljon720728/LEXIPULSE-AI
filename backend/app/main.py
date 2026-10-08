import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import engine, Base
from app.routers import auth_routes, complaint_routes, analytics_routes, admin_routes, assistant_routes

# Create DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Multilingual Legal Complaint Emotion & Urgency Classification System with Explainable AI"
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers (registered both with /api and root for 100% URL flexibility)
for r in [auth_routes.router, complaint_routes.router, analytics_routes.router, admin_routes.router, assistant_routes.router]:
    app.include_router(r, prefix=settings.API_V1_STR)
    app.include_router(r)

@app.get("/")
def root():
    return {
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "documentation": "/docs",
        "supported_languages": ["English", "Hindi", "Telugu", "Tamil", "Bengali", "Urdu"],
        "emotion_classes": ["anger", "fear", "distress", "neutral", "desperation", "frustration", "sadness"],
        "urgency_levels": ["Critical", "High", "Medium", "Low"]
    }

@app.get("/health")
def health_check():
    return {"status": "healthy", "database": "connected"}
