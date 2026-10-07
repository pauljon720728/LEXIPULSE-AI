import random
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Department
from app.schemas import UserCreate, UserLogin, Token, UserOut
from app.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

# In-memory mock OTP store for password reset demo
MOCK_OTP_STORE = {}

import re
from app.services.supabase_service import supabase_service

@router.post("/register", response_model=Token)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    # 1. Email format check
    email_regex = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
    if not re.match(email_regex, user_in.email):
        raise HTTPException(status_code=400, detail="Invalid email format.")

    # 2. Password strength validation
    if len(user_in.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")
    if not any(char.isdigit() for char in user_in.password) or not any(char.isalpha() for char in user_in.password):
        raise HTTPException(status_code=400, detail="Password must contain both letters and numbers.")

    # 3. Role restriction: Public registration is Citizen only!
    if user_in.role in ["officer", "admin", "super_admin"]:
        raise HTTPException(
            status_code=403, 
            detail="Officer and Admin accounts cannot be self-registered. They must be provisioned by an Administrator."
        )

    # 4. Duplicate email check
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email address already exists.")

    new_user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=hash_password(user_in.password),
        role="citizen",
        language_pref=user_in.language_pref or "en",
        department_id=None,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # If Supabase is active, register in Supabase Auth & public.users table
    if supabase_service.is_configured:
        try:
            supabase_service.client.auth.admin.create_user({
                "email": user_in.email,
                "password": user_in.password,
                "email_confirm": True,
                "user_metadata": {
                    "full_name": user_in.full_name,
                    "role": "citizen",
                    "language_pref": user_in.language_pref or "en"
                }
            })
        except Exception:
            pass

    token = create_access_token({"sub": new_user.email, "role": new_user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": new_user
    }

@router.post("/login", response_model=Token)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="User account is deactivated")

    # If role specified, verify or switch demo role if admin
    token = create_access_token({"sub": user.email, "role": user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return current_user

@router.post("/forgot-password/send-otp")
def send_otp(email: str):
    otp = str(random.randint(100000, 999999))
    MOCK_OTP_STORE[email] = otp
    return {"message": f"Verification OTP sent to {email}", "mock_otp": otp}

@router.post("/forgot-password/verify-otp")
def verify_otp(email: str, otp: str, new_password: str, db: Session = Depends(get_db)):
    saved_otp = MOCK_OTP_STORE.get(email)
    if not saved_otp or saved_otp != otp:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP.")

    user = db.query(User).filter(User.email == email).first()
    if user:
        user.hashed_password = hash_password(new_password)
        db.commit()
        MOCK_OTP_STORE.pop(email, None)
        return {"message": "Password successfully reset. You can now log in."}
    raise HTTPException(status_code=404, detail="User not found.")
