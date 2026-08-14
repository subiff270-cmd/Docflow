from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional
from ..database import get_db
from ..schemas import CreateOrderRequest, CreateOrderResponse, VerifyPaymentRequest, VerifyPaymentResponse
from ..services.payment_service import create_razorpay_order, verify_razorpay_signature
from ..services.usage_service import get_or_create_user
from ..models import Subscription

router = APIRouter(prefix="/api/payment", tags=["payment"])

PLAN_AMOUNTS = {
    "PRO_MONTHLY": 9900,  # ₹99.00
    "PRO_YEARLY": 99900   # ₹999.00
}

@router.post("/create-order", response_model=CreateOrderResponse)
def create_order(req: CreateOrderRequest, x_firebase_uid: Optional[str] = Header(None), db: Session = Depends(get_db)):
    if not x_firebase_uid:
        raise HTTPException(status_code=401, detail="Authentication required.")
    
    if req.plan not in PLAN_AMOUNTS:
        raise HTTPException(status_code=400, detail="Invalid plan selected.")
    
    amount = PLAN_AMOUNTS[req.plan]
    order_info = create_razorpay_order(amount)

    sub = Subscription(
        firebase_uid=x_firebase_uid,
        razorpay_order_id=order_info["order_id"],
        plan=req.plan,
        amount=amount,
        status="CREATED"
    )
    db.add(sub)
    db.commit()

    return CreateOrderResponse(
        order_id=order_info["order_id"],
        amount=order_info["amount"],
        currency=order_info["currency"],
        key_id=order_info["key_id"]
    )

@router.post("/verify", response_model=VerifyPaymentResponse)
def verify_payment(req: VerifyPaymentRequest, x_firebase_uid: Optional[str] = Header(None), db: Session = Depends(get_db)):
    if not x_firebase_uid:
        raise HTTPException(status_code=401, detail="Authentication required.")

    valid = verify_razorpay_signature(req.razorpay_order_id, req.razorpay_payment_id, req.razorpay_signature)
    if not valid:
        raise HTTPException(status_code=400, detail="Payment verification failed.")

    user = get_or_create_user(db, x_firebase_uid)
    user.plan = req.plan
    db.commit()

    sub = db.query(Subscription).filter(Subscription.razorpay_order_id == req.razorpay_order_id).first()
    if sub:
        sub.razorpay_payment_id = req.razorpay_payment_id
        sub.razorpay_signature = req.razorpay_signature
        sub.status = "ACTIVE"
        db.commit()

    return VerifyPaymentResponse(
        success=True,
        message="Subscription upgraded successfully to Pro!",
        plan=user.plan
    )
