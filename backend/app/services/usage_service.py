import datetime
from sqlalchemy.orm import Session
from ..models import User, ConversionHistory

FREE_LIMIT = 100
FREE_MAX_SIZE = 50
PRO_MAX_SIZE = 500

def get_or_create_user(db: Session, firebase_uid: str, email: str = None, display_name: str = None) -> User:
    user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
    if not user:
        user = User(
            firebase_uid=firebase_uid,
            email=email,
            display_name=display_name,
            plan="FREE",
            period_start=datetime.datetime.utcnow(),
            period_usage=0,
            total_conversions=0
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if email and user.email != email:
            user.email = email
        if display_name and user.display_name != display_name:
            user.display_name = display_name
        db.commit()
        db.refresh(user)
    
    # Check daily period reset (resets every 24 hours / new calendar day)
    now = datetime.datetime.utcnow()
    if user.period_start.date() < now.date() or (now - user.period_start).total_seconds() >= 86400:
        user.period_start = now
        user.period_usage = 0
        db.commit()
        db.refresh(user)

    return user

def check_user_quota(db: Session, firebase_uid: str, file_size_mb: float):
    user = get_or_create_user(db, firebase_uid)
    
    max_size = PRO_MAX_SIZE if user.plan in ["PRO_MONTHLY", "PRO_YEARLY"] else FREE_MAX_SIZE
    if file_size_mb > max_size:
        return False, f"File size ({file_size_mb:.1f} MB) exceeds the Free limit of {max_size} MB. Please upgrade to DocFlow Pro for files up to 500 MB."
    
    if user.plan in ["PRO_MONTHLY", "PRO_YEARLY"]:
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
