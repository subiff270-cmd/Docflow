import os
import sys
import json
import fitz

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.services import pdf_service

def create_sample_pdf(prefix: str, num_pages: int) -> bytes:
    doc = fitz.open()
    for i in range(1, num_pages + 1):
        page = doc.new_page(width=595, height=842) # A4
        page.insert_text((72, 100), f"Document {prefix} - Page {i}", fontsize=24, color=(0.1, 0.2, 0.6))
        page.insert_text((72, 150), f"Content text for page {i} of document {prefix}. Vector elements & layout intact.", fontsize=14)
        page.draw_rect(fitz.Rect(72, 200, 500, 400), color=(0.2, 0.4, 0.8), width=2)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes

def test_organize_pdf_engine():
    print("=== Testing Organize PDF Engine ===")
    
    # 1. Create PDF A (5 pages) and PDF B (3 pages)
    pdf_a_bytes = create_sample_pdf("A", 5)
    pdf_b_bytes = create_sample_pdf("B", 3)
    
    doc_a = fitz.open(stream=pdf_a_bytes, filetype="pdf")
    doc_b = fitz.open(stream=pdf_b_bytes, filetype="pdf")
    assert len(doc_a) == 5, "PDF A should have 5 pages"
    assert len(doc_b) == 3, "PDF B should have 3 pages"
    doc_a.close()
    doc_b.close()
    print("[OK] Step 1: Created input PDF A (5 pages) and PDF B (3 pages)")

    # 2. Define operations:
    # Page 1: A4 (sourceDoc 0, orig 4, rot 0)
    # Page 2: A1 (sourceDoc 0, orig 1, rot 90)
    # Page 3: B1 (sourceDoc 1, orig 1, rot 0)
    # Page 4: A3 (sourceDoc 0, orig 3, excluded: True) -> should be omitted
    # Page 5: A5 (sourceDoc 0, orig 5, rot 180)
    # Page 6: A5 duplicate (sourceDoc 0, orig 5, rot 180)
    # Page 7: B3 (sourceDoc 1, orig 3, rot 270)
    page_orders = [
        {"id": "p-0-4", "sourceDocumentId": 0, "originalPageNumber": 4, "rotation": 0, "excluded": False},
        {"id": "p-0-1", "sourceDocumentId": 0, "originalPageNumber": 1, "rotation": 90, "excluded": False},
        {"id": "p-1-1", "sourceDocumentId": 1, "originalPageNumber": 1, "rotation": 0, "excluded": False},
        {"id": "p-0-3", "sourceDocumentId": 0, "originalPageNumber": 3, "rotation": 0, "excluded": True},
        {"id": "p-0-5", "sourceDocumentId": 0, "originalPageNumber": 5, "rotation": 180, "excluded": False},
        {"id": "p-0-5-dup", "sourceDocumentId": 0, "originalPageNumber": 5, "rotation": 180, "excluded": False},
        {"id": "p-1-3", "sourceDocumentId": 1, "originalPageNumber": 3, "rotation": 270, "excluded": False},
    ]
    
    out_bytes, metadata = pdf_service.organize_pdf([pdf_a_bytes, pdf_b_bytes], page_orders)
    
    assert metadata["exported_pages"] == 6, f"Expected 6 exported pages, got {metadata['exported_pages']}"
    assert metadata["excluded_pages"] == 1, f"Expected 1 excluded page, got {metadata['excluded_pages']}"
    assert metadata["original_total_pages"] == 8, f"Expected 8 original pages total, got {metadata['original_total_pages']}"
    print("[OK] Step 2: pdf_service.organize_pdf executed successfully with metadata:", metadata)

    # 3. Deeply inspect output PDF
    out_doc = fitz.open(stream=out_bytes, filetype="pdf")
    assert len(out_doc) == 6, f"Output PDF should have 6 pages, got {len(out_doc)}"

    # Verify Page 1 (A4)
    p1 = out_doc[0]
    p1_text = p1.get_text()
    assert "Document A - Page 4" in p1_text, f"Page 1 should be Document A - Page 4, got: {p1_text}"
    assert p1.rotation == 0, f"Page 1 rotation should be 0, got {p1.rotation}"

    # Verify Page 2 (A1 with 90° rotation)
    p2 = out_doc[1]
    p2_text = p2.get_text()
    assert "Document A - Page 1" in p2_text, f"Page 2 should be Document A - Page 1, got: {p2_text}"
    assert p2.rotation == 90, f"Page 2 rotation should be 90, got {p2.rotation}"

    # Verify Page 3 (B1 with 0° rotation)
    p3 = out_doc[2]
    p3_text = p3.get_text()
    assert "Document B - Page 1" in p3_text, f"Page 3 should be Document B - Page 1, got: {p3_text}"
    assert p3.rotation == 0, f"Page 3 rotation should be 0, got {p3.rotation}"

    # Verify Page 4 (A5 with 180° rotation)
    p4 = out_doc[3]
    p4_text = p4.get_text()
    assert "Document A - Page 5" in p4_text, f"Page 4 should be Document A - Page 5, got: {p4_text}"
    assert p4.rotation == 180, f"Page 4 rotation should be 180, got {p4.rotation}"

    # Verify Page 5 (A5 duplicated with 180° rotation)
    p5 = out_doc[4]
    p5_text = p5.get_text()
    assert "Document A - Page 5" in p5_text, f"Page 5 should be duplicated Document A - Page 5, got: {p5_text}"
    assert p5.rotation == 180, f"Page 5 rotation should be 180, got {p5.rotation}"

    # Verify Page 6 (B3 with 270° rotation)
    p6 = out_doc[5]
    p6_text = p6.get_text()
    assert "Document B - Page 3" in p6_text, f"Page 6 should be Document B - Page 3, got: {p6_text}"
    assert p6.rotation == 270, f"Page 6 rotation should be 270, got {p6.rotation}"

    # Verify excluded page A3 is nowhere in the document
    all_text = "".join([page.get_text() for page in out_doc])
    assert "Document A - Page 3" not in all_text, "Excluded page Document A - Page 3 must NOT exist in output PDF"

    out_doc.close()
    print("[OK] Step 3: All 6 output pages verified for text integrity, exact sequence, rotations, and excluded page absence!")
    print("\nALL TESTS PASSED: Organize PDF engine is production-ready!")

if __name__ == "__main__":
    test_organize_pdf_engine()
