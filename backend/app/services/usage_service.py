import os
import datetime
from sqlalchemy.orm import Session
from ..models import User, ConversionHistory

FREE_LIMIT = int(os.getenv("FREE_CONVERSION_LIMIT", "10"))
FREE_MAX_SIZE = int(os.getenv("FREE_MAX_SIZE_MB", "25"))
PRO_MAX_SIZE = 500

def get_or_create_user(db: Session, firebase_uid: str, email: str = None, display_name: str = None) -> User:
    # 1. Match by firebase_uid first
    user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
    
    # 2. If not found by UID, match by email
    if not user and email:
        user = db.query(User).filter(User.email == email.strip().lower()).first()
        if user:
            user.firebase_uid = firebase_uid
            db.commit()
            db.refresh(user)

    now = datetime.datetime.utcnow()

    if not user:
        user = User(
            firebase_uid=firebase_uid,
            email=email.strip().lower() if email else None,
            display_name=display_name,
            plan="FREE",
            period_start=now,
            period_usage=0,
            total_conversions=0
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if email and (not user.email or user.email != email.strip().lower()):
            user.email = email.strip().lower()
        if display_name and user.display_name != display_name:
            user.display_name = display_name
        db.commit()
        db.refresh(user)

    # 3. Auto-Heal / Reconcile with Razorpay Live API if plan is FREE or expired
    check_email = user.email or (email.strip().lower() if email else None)
    if user.plan == "FREE" and check_email:
        from .payment_service import check_razorpay_active_subscription
        active_sub = check_razorpay_active_subscription(check_email)
        if active_sub and active_sub.get("expires_at") and now < active_sub["expires_at"]:
            user.plan = active_sub["plan"]
            user.plan_expires_at = active_sub["expires_at"]
            user.period_usage = 0
            db.commit()
            db.refresh(user)

    # 4. Check Pro Subscription Expiration
    if user.plan in ["PRO_MONTHLY", "PRO_YEARLY", "PRO"] and user.plan_expires_at:
        if now >= user.plan_expires_at:
            # Check Razorpay once more before downgrading
            if check_email:
                from .payment_service import check_razorpay_active_subscription
                active_sub = check_razorpay_active_subscription(check_email)
                if active_sub and active_sub.get("expires_at") and now < active_sub["expires_at"]:
                    user.plan = active_sub["plan"]
                    user.plan_expires_at = active_sub["expires_at"]
                    db.commit()
                    db.refresh(user)
                else:
                    user.plan = "FREE"
                    user.plan_expires_at = None
                    user.period_usage = 0
                    db.commit()
                    db.refresh(user)
            else:
                user.plan = "FREE"
                user.plan_expires_at = None
                user.period_usage = 0
                db.commit()
                db.refresh(user)

    # 5. Check daily period reset (resets every 24 hours / new calendar day for Free tier)
    if user.period_start.date() < now.date() or (now - user.period_start).total_seconds() >= 86400:
        user.period_start = now
        user.period_usage = 0
        db.commit()
        db.refresh(user)

    return user

def check_user_quota(db: Session, firebase_uid: str, file_size_mb: float):
    user = get_or_create_user(db, firebase_uid)
    
    is_pro = user.plan in ["PRO_MONTHLY", "PRO_YEARLY", "PRO"]
    max_size = PRO_MAX_SIZE if is_pro else FREE_MAX_SIZE
    if file_size_mb > max_size:
        if is_pro:
            return False, f"File size ({file_size_mb:.1f} MB) exceeds the Pro limit of 500 MB."
        return False, f"File size ({file_size_mb:.1f} MB) exceeds the Free limit of 25 MB. Please upgrade to DocFlow Pro for files up to 500 MB."
    
    if is_pro:
        return True, "OK"
    
    if user.period_usage >= FREE_LIMIT:
        return False, "You've reached your free daily limit of 10 conversions today. Please upgrade to Pro for unlimited conversions or wait for tomorrow's reset."
    
    return True, "OK"

def record_conversion_success(db: Session, firebase_uid: str, filename: str, tool: str, orig_size: int, result_size: int, download_key: str):
    user = get_or_create_user(db, firebase_uid)
    user.period_usage += 1
    user.total_conversions += 1
    db.commit()

    history = ConversionHistory(
        firebase_uid=firebase_uid,
        filename=filename,
        tool=tool,
        status="SUCCESS",
        original_size=orig_size,
        result_size=result_size,
        download_key=download_key
    )
    db.add(history)
    db.commit()
    db.refresh(history)
    return history
