import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    firebase_uid = Column(String(128), unique=True, index=True, nullable=False)
    email = Column(String(255), index=True, nullable=True)
    display_name = Column(String(255), nullable=True)
    plan = Column(String(50), default="FREE")  # "FREE", "PRO_MONTHLY", "PRO_YEARLY"
    period_start = Column(DateTime, default=datetime.datetime.utcnow)
    period_usage = Column(Integer, default=0)
    total_conversions = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    conversions = relationship("ConversionHistory", back_populates="user", cascade="all, delete-orphan")
    subscriptions = relationship("Subscription", back_populates="user", cascade="all, delete-orphan")

class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    firebase_uid = Column(String(128), ForeignKey("users.firebase_uid"), nullable=False)
    razorpay_order_id = Column(String(255), nullable=False)
    razorpay_payment_id = Column(String(255), nullable=True)
    razorpay_signature = Column(String(255), nullable=True)
    plan = Column(String(50), nullable=False) # "PRO_MONTHLY", "PRO_YEARLY"
    amount = Column(Integer, nullable=False) # in paise (e.g. 9900 = ₹99)
    status = Column(String(50), default="CREATED") # "CREATED", "ACTIVE", "FAILED"
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="subscriptions")

class ConversionHistory(Base):
    __tablename__ = "conversion_history"

    id = Column(Integer, primary_key=True, index=True)
    firebase_uid = Column(String(128), ForeignKey("users.firebase_uid"), nullable=True)
    filename = Column(String(255), nullable=False)
    tool = Column(String(100), nullable=False)
    status = Column(String(50), default="SUCCESS") # "SUCCESS", "FAILED"
    original_size = Column(Integer, default=0)
    result_size = Column(Integer, default=0)
    download_key = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="conversions")

class DocumentItem(Base):
    __tablename__ = "document_items"

    id = Column(Integer, primary_key=True, index=True)
    firebase_uid = Column(String(128), nullable=True, index=True)
    file_key = Column(String(255), unique=True, index=True, nullable=False)
    original_name = Column(String(255), nullable=False)
    stored_path = Column(String(500), nullable=False)
    file_size = Column(Integer, default=0)
    mime_type = Column(String(100), default="application/octet-stream")
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class ContactMessage(Base):
    __tablename__ = "contact_messages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    resend_id = Column(String(255), nullable=True)
    status = Column(String(50), default="SENT")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
