import io
import os
import sys

from app.database import SessionLocal, Base, engine
from app.models import User, ConversionHistory
from app.services import pdf_service, conversion_service, usage_service, payment_service, email_service

Base.metadata.create_all(bind=engine)

def run_tests():
    print("==========================================")
    print("DOCFLOW PRODUCTION SYSTEM INTEGRATION TEST")
    print("==========================================")

    db = SessionLocal()
    test_uid = "test_user_firebase_uid_123"

    # 1. User Auth & Quota Test
    user = usage_service.get_or_create_user(db, test_uid, "test@docflow.com", "Test User")
    assert user.firebase_uid == test_uid
    print("[PASS] User Sync & Account Isolation: OK")

    # 2. Generate Real Test Files
    # Test PDF 1 & 2
    import fitz
    doc1 = fitz.open()
    page1 = doc1.new_page()
    page1.insert_text((50, 50), "DocFlow Test Document Page 1", fontsize=12)
    pdf1_bytes = doc1.tobytes()
    doc1.close()

    doc2 = fitz.open()
    page2 = doc2.new_page()
    page2.insert_text((50, 50), "DocFlow Test Document Page 2", fontsize=12)
    pdf2_bytes = doc2.tobytes()
    doc2.close()

    # 3. Test Merge PDF
    merged_bytes = pdf_service.merge_pdfs([pdf1_bytes, pdf2_bytes])
    res_doc = fitz.open(stream=merged_bytes, filetype="pdf")
    assert len(res_doc) == 2
    res_doc.close()
    print("[PASS] Merge PDF Real Processing: OK (2 pages merged)")

    # 4. Test Compress PDF
    comp_bytes, orig_sz, comp_sz = pdf_service.compress_pdf(merged_bytes, "medium")
    assert len(comp_bytes) > 0
    print(f"[PASS] Compress PDF Real Processing: OK ({orig_sz} -> {comp_sz} bytes)")

    # 5. Test Split PDF
    split_results = pdf_service.split_pdf(merged_bytes, "individual")
    assert len(split_results) == 2
    print("[PASS] Split PDF Real Processing: OK (2 output PDFs generated)")

    # 6. Test Word to PDF & PDF to Word
    from docx import Document
    docx_doc = Document()
    docx_doc.add_paragraph("DocFlow Word Conversion Test Paragraph")
    buf = io.BytesIO()
    docx_doc.save(buf)
    word_bytes = buf.getvalue()

    converted_pdf = conversion_service.word_to_pdf(word_bytes)
    assert len(converted_pdf) > 0
    print("[PASS] Word to PDF Real Processing: OK")

    converted_word = conversion_service.pdf_to_word(pdf1_bytes)
    assert len(converted_word) > 0
    print("[PASS] PDF to Word Real Processing: OK")

    # 7. Test PDF to JPG
    jpg_pages = conversion_service.pdf_to_jpg(pdf1_bytes)
    assert len(jpg_pages) == 1
    print("[PASS] PDF to JPG Real Processing: OK")

    # 8. Test Quota Tracking & Record Conversion
    usage_service.record_conversion_success(db, test_uid, "test.pdf", "Merge PDF", orig_sz, len(merged_bytes), "mock_key")
    db.refresh(user)
    assert user.total_conversions >= 1
    assert user.period_usage >= 1
    print(f"[PASS] Account Quota & Total Conversions: OK (Conversions={user.total_conversions}, Period={user.period_usage}/10)")

    # 9. Test Razorpay Payment Signature
    order = payment_service.create_razorpay_order(9900)
    assert order["order_id"] is not None
    sig_valid = payment_service.verify_razorpay_signature(order["order_id"], "pay_test_123", "test_sig")
    assert sig_valid is True
    print("[PASS] Razorpay Order & Signature Verification: OK")

    # 10. Test Resend Contact Email
    success, msg, res_id = email_service.send_contact_email("Test Sender", "sender@test.com", "Test Subject", "Test Message Body")
    assert success is True
    print("[PASS] Resend Contact Email: OK")

    db.close()
    print("==========================================")
    print("ALL INTEGRATION TESTS PASSED SUCCESSFULLY!")
    print("==========================================")

if __name__ == "__main__":
    run_tests()
