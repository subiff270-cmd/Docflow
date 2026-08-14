from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..schemas import ContactRequest, ContactResponse
from ..services.email_service import send_contact_email
from ..models import ContactMessage

router = APIRouter(prefix="/api/contact", tags=["contact"])

@router.post("", response_model=ContactResponse)
def submit_contact_form(req: ContactRequest, db: Session = Depends(get_db)):
    if not req.name.strip() or not req.email.strip() or not req.subject.strip() or not req.message.strip():
        raise HTTPException(status_code=400, detail="All fields are required.")

    success, message, resend_id = send_contact_email(req.name, req.email, req.subject, req.message)

    msg_record = ContactMessage(
        name=req.name,
        email=req.email,
        subject=req.subject,
        message=req.message,
        resend_id=resend_id,
        status="SENT" if success else "FAILED"
    )
    db.add(msg_record)
    db.commit()

    if not success:
        raise HTTPException(status_code=500, detail=message)

    return ContactResponse(success=True, message=message)
