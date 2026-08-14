from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List, Optional
import datetime
from ..database import get_db
from ..schemas import UserProfileResponse, ConversionHistoryItem
from ..services.usage_service import get_or_create_user, FREE_LIMIT, FREE_MAX_SIZE, PRO_MAX_SIZE
from ..models import ConversionHistory

router = APIRouter(prefix="/api/user", tags=["user"])

@router.get("/profile", response_model=UserProfileResponse)
def get_user_profile(x_firebase_uid: Optional[str] = Header(None), db: Session = Depends(get_db)):
    if not x_firebase_uid:
        raise HTTPException(status_code=401, detail="Authentication header missing.")
    
    user = get_or_create_user(db, x_firebase_uid)
    is_pro = user.plan in ["PRO_MONTHLY", "PRO_YEARLY"]
    max_quota = -1 if is_pro else FREE_LIMIT
    max_file_size = PRO_MAX_SIZE if is_pro else FREE_MAX_SIZE
    
    now = datetime.datetime.utcnow()
    days_left = max(0, 30 - (now - user.period_start).days)

    return UserProfileResponse(
        firebase_uid=user.firebase_uid,
        email=user.email,
        display_name=user.display_name,
        plan=user.plan,
        total_conversions=user.total_conversions,
        period_usage=user.period_usage,
        max_quota=max_quota,
        max_file_size_mb=max_file_size,
        days_until_reset=days_left
    )

@router.get("/history", response_model=List[ConversionHistoryItem])
def get_user_history(x_firebase_uid: Optional[str] = Header(None), db: Session = Depends(get_db)):
    if not x_firebase_uid:
        raise HTTPException(status_code=401, detail="Authentication header missing.")
    
    history = db.query(ConversionHistory).filter(ConversionHistory.firebase_uid == x_firebase_uid).order_by(ConversionHistory.created_at.desc()).all()
    return history
