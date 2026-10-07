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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_routes.router, prefix=settings.API_V1_STR)
app.include_router(complaint_routes.router, prefix=settings.API_V1_STR)
app.include_router(complaint_routes.router)  # Allow direct access e.g. /complaints/submit
app.include_router(analytics_routes.router, prefix=settings.API_V1_STR)
app.include_router(admin_routes.router, prefix=settings.API_V1_STR)
app.include_router(assistant_routes.router, prefix=settings.API_V1_STR)

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
