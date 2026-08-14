from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

class UserSyncRequest(BaseModel):
    firebase_uid: str
    email: Optional[str] = None
    display_name: Optional[str] = None

class UserProfileResponse(BaseModel):
    firebase_uid: str
    email: Optional[str]
    display_name: Optional[str]
    plan: str
    total_conversions: int
    period_usage: int
    max_quota: int # 10 for FREE, -1 (unlimited) for PRO
    max_file_size_mb: int # 25 for FREE, 500 for PRO
    days_until_reset: int

class ConversionHistoryItem(BaseModel):
    id: int
    filename: str
    tool: str
    status: str
    original_size: int
    result_size: int
    download_key: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class CreateOrderRequest(BaseModel):
    plan: str # "PRO_MONTHLY" or "PRO_YEARLY"

class CreateOrderResponse(BaseModel):
    order_id: str
    amount: int
    currency: str
    key_id: str

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan: str

class VerifyPaymentResponse(BaseModel):
    success: bool
    message: str
    plan: str

class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    subject: str
    message: str

class ContactResponse(BaseModel):
    success: bool
    message: str
