import os
import uuid
import datetime
from fastapi import UploadFile
from sqlalchemy.orm import Session
from ..models import DocumentItem

STORAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "storage_files")
os.makedirs(STORAGE_DIR, exist_ok=True)

RETENTION_MINUTES = int(os.getenv("FILE_RETENTION_MINUTES", "30"))

def save_uploaded_file(db: Session, file: UploadFile, firebase_uid: str = None) -> DocumentItem:
    file_key = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1]
    stored_name = f"{file_key}{ext}"
    stored_path = os.path.join(STORAGE_DIR, stored_name)

    content = file.file.read()
    file_size = len(content)

    with open(stored_path, "wb") as f:
        f.write(content)

    expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=RETENTION_MINUTES)

    doc_item = DocumentItem(
        firebase_uid=firebase_uid,
        file_key=file_key,
        original_name=file.filename,
        stored_path=stored_path,
        file_size=file_size,
        mime_type=file.content_type or "application/octet-stream",
        expires_at=expires_at
    )
    db.add(doc_item)
    db.commit()
    db.refresh(doc_item)
    return doc_item

def save_generated_bytes(db: Session, content: bytes, original_name: str, mime_type: str = "application/pdf", firebase_uid: str = None) -> DocumentItem:
    file_key = str(uuid.uuid4())
    ext = os.path.splitext(original_name)[1] or ".pdf"
    stored_name = f"{file_key}{ext}"
    stored_path = os.path.join(STORAGE_DIR, stored_name)

    with open(stored_path, "wb") as f:
        f.write(content)

    expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=RETENTION_MINUTES)

    doc_item = DocumentItem(
        firebase_uid=firebase_uid,
        file_key=file_key,
        original_name=original_name,
        stored_path=stored_path,
        file_size=len(content),
        mime_type=mime_type,
        expires_at=expires_at
    )
    db.add(doc_item)
    db.commit()
    db.refresh(doc_item)
    return doc_item

def get_file_by_key(db: Session, file_key: str) -> DocumentItem:
    return db.query(DocumentItem).filter(DocumentItem.file_key == file_key).first()

def purge_expired_files(db: Session):
    now = datetime.datetime.utcnow()
    expired_items = db.query(DocumentItem).filter(DocumentItem.expires_at <= now).all()
    for item in expired_items:
        if os.path.exists(item.stored_path):
            try:
                os.remove(item.stored_path)
            except Exception:
                pass
        db.delete(item)
    db.commit()
