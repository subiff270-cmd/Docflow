import io
import fitz  # PyMuPDF
import pdfplumber

def analyze_pdf(pdf_bytes: bytes) -> dict:
    """
    Exhaustive PDF Analysis Engine.
    Detects page structure, text density, image presence, tables, forms,
    scanned pages, links, and encryption.
    """
    analysis = {
        "page_count": 0,
        "has_text": False,
        "has_images": False,
        "has_tables": False,
        "has_scanned_pages": False,
        "has_links": False,
        "has_form_fields": False,
        "is_encrypted": False,
        "fonts": [],
        "dimensions": {"width": 0, "height": 0},
        "total_characters": 0,
        "image_count": 0,
        "table_count": 0,
        "file_size_bytes": len(pdf_bytes),
    }

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        analysis["page_count"] = len(doc)
        analysis["is_encrypted"] = doc.is_encrypted

        if doc.is_encrypted:
            doc.close()
            return analysis

        fonts_set = set()
        scanned_page_count = 0

        for page_idx, page in enumerate(doc):
            if page_idx == 0:
                analysis["dimensions"] = {
                    "width": round(page.rect.width, 2),
                    "height": round(page.rect.height, 2)
                }

            # Text analysis
            text = page.get_text("text").strip()
            analysis["total_characters"] += len(text)
            if len(text) > 20:
                analysis["has_text"] = True

            # Images
            imgs = page.get_images()
            analysis["image_count"] += len(imgs)
            if len(imgs) > 0:
                analysis["has_images"] = True

            # Scanned page detection (no text but has images)
            if len(text) < 10 and len(imgs) > 0:
                scanned_page_count += 1

            # Links
            links = list(page.get_links())
            if len(links) > 0:
                analysis["has_links"] = True

            # Form fields
            if len(list(page.widgets())) > 0:
                analysis["has_form_fields"] = True

            # Fonts
            for f in page.get_fonts():
                if len(f) > 3 and f[3]:
                    fonts_set.add(f[3])

        analysis["has_scanned_pages"] = scanned_page_count > 0
        analysis["fonts"] = sorted(list(fonts_set))[:10]

        # Table detection via pdfplumber
        try:
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                for p in pdf.pages:
                    tabs = p.extract_tables()
                    if tabs:
                        analysis["table_count"] += len(tabs)
                        analysis["has_tables"] = True
        except Exception:
            pass

        doc.close()
    except Exception as e:
        analysis["error"] = str(e)

    return analysis
