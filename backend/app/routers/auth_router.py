from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..schemas import UserSyncRequest, UserProfileResponse
from ..services.usage_service import get_or_create_user, FREE_LIMIT, FREE_MAX_SIZE, PRO_MAX_SIZE
import datetime

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/sync", response_model=UserProfileResponse)
def sync_user(req: UserSyncRequest, db: Session = Depends(get_db)):
    user = get_or_create_user(db, req.firebase_uid, req.email, req.display_name)
    
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
