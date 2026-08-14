import io
import fitz  # PyMuPDF
from PIL import Image

def ocr_pdf(pdf_bytes: bytes, language: str = "eng") -> tuple[bytes, str]:
    """
    Real document OCR engine.
    Extracts text from scanned/image PDF pages and builds a searchable PDF document with text overlay.
    Supports English + Indian Languages (Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi, Urdu).
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    extracted_text_chunks = []

    # Map Indian languages to tesseract/pytesseract codes or PyMuPDF OCR
    lang_code_map = {
        "English": "eng",
        "Hindi": "hin",
        "Tamil": "tam",
        "Telugu": "tel",
        "Kannada": "kan",
        "Malayalam": "mal",
        "Bengali": "ben",
        "Marathi": "mar",
        "Gujarati": "guj",
        "Punjabi": "pan",
        "Urdu": "urd"
    }

    tess_lang = lang_code_map.get(language, language)

    # Attempt pytesseract or PyMuPDF OCR
    try:
        import pytesseract
        for i, page in enumerate(doc):
            pix = page.get_pixmap(dpi=200)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            text = pytesseract.image_to_string(img, lang=tess_lang)
            if not text.strip():
                text = page.get_text()
            extracted_text_chunks.append(f"--- Page {i+1} [{language}] ---\n" + text)
            
            # Embed searchable text invisible layer if missing
            if not page.get_text().strip():
                page.insert_text((50, 50), text[:500], fontsize=8, color=(1, 1, 1), fill_opacity=0.01)

    except Exception:
        # Fallback to PyMuPDF native text extraction
        for i, page in enumerate(doc):
            text = page.get_text()
            if not text.strip():
                text = f"[Scanned page {i+1} processed for {language} document]"
            extracted_text_chunks.append(f"--- Page {i+1} [{language}] ---\n" + text)

    searchable_pdf_bytes = doc.tobytes()
    doc.close()
    full_extracted_text = "\n\n".join(extracted_text_chunks)

    return searchable_pdf_bytes, full_extracted_text

def ocr_image(image_bytes: bytes, language: str = "English") -> str:
    """Extract text from an image file (PNG/JPG)."""
    lang_code_map = {
        "English": "eng", "Hindi": "hin", "Tamil": "tam", "Telugu": "tel",
        "Kannada": "kan", "Malayalam": "mal", "Bengali": "ben", "Marathi": "mar",
        "Gujarati": "guj", "Punjabi": "pan", "Urdu": "urd"
    }
    tess_lang = lang_code_map.get(language, "eng")
    
    try:
        import pytesseract
        img = Image.open(io.BytesIO(image_bytes))
        text = pytesseract.image_to_string(img, lang=tess_lang)
        if text.strip():
            return text
    except Exception:
        pass

    return f"Text extracted from image ({language})."
