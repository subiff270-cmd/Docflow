import io
import os
import fitz  # PyMuPDF
from PIL import Image
import docx
import pytesseract

TESSDATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "tessdata"))
if os.path.exists(TESSDATA_DIR):
    os.environ["TESSDATA_PREFIX"] = TESSDATA_DIR

LANG_CODE_MAP = {
    "Auto": "eng+hin+tam+tel+kan+mal+ben+mar+guj+pan+urd",
    "Auto-Detect": "eng+hin+tam+tel+kan+mal+ben+mar+guj+pan+urd",
    "English": "eng",
    "Hindi": "hin+eng",
    "Tamil": "tam+eng",
    "Telugu": "tel+eng",
    "Kannada": "kan+eng",
    "Malayalam": "mal+eng",
    "Bengali": "ben+eng",
    "Marathi": "mar+eng",
    "Gujarati": "guj+eng",
    "Punjabi": "pan+eng",
    "Urdu": "urd+eng"
}

def create_docx_from_text(text: str, title: str = "Extracted Document") -> bytes:
    """Generate an editable Microsoft Word (.docx) document containing Indian language and English text."""
    doc = docx.Document()
    
    # Title
    heading = doc.add_heading(title, level=1)
    heading.paragraph_format.space_after = docx.shared.Pt(12)
    
    # Body paragraphs
    paragraphs = text.split("\n\n")
    for p_text in paragraphs:
        clean_p = p_text.strip()
        if clean_p:
            if clean_p.startswith("--- Page"):
                p = doc.add_heading(clean_p, level=2)
                p.paragraph_format.space_before = docx.shared.Pt(14)
                p.paragraph_format.space_after = docx.shared.Pt(6)
            else:
                p = doc.add_paragraph(clean_p)
                p.paragraph_format.space_after = docx.shared.Pt(8)
                p.paragraph_format.line_spacing = 1.15
                
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()

def extract_ocr_from_page(page, tess_lang: str, tess_dir: str = None) -> str:
    """Extract OCR text from a single PyMuPDF page using multiple fallback mechanisms."""
    # 1. First attempt: PyMuPDF embedded Tesseract with textpage
    try:
        if tess_dir and os.path.exists(tess_dir):
            tp = page.get_textpage_ocr(language=tess_lang, tessdata=tess_dir, dpi=200)
            t = page.get_text("text", textpage=tp).strip()
            if t:
                return t
    except Exception as e:
        print(f"PyMuPDF textpage OCR notice: {e}")

    # 2. Second attempt: Render page to high-res image and run pytesseract
    try:
        pix = page.get_pixmap(dpi=200)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        config = f'--tessdata-dir "{tess_dir}"' if tess_dir and os.path.exists(tess_dir) else ""
        text = pytesseract.image_to_string(img, lang=tess_lang, config=config).strip()
        if text:
            return text
    except Exception as e:
        print(f"Pytesseract fallback notice: {e}")

    # 3. Third attempt: Native text layer
    try:
        native = page.get_text().strip()
        if native:
            return native
    except Exception:
        pass

    return ""

def ocr_pdf(
    file_bytes: bytes,
    language: str = "English",
    output_format: str = "pdf",
    password: str = None
) -> tuple[bytes, str, str, str]:
    """
    Real document OCR engine supporting English and 10 Indian Regional Languages:
    Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi, Urdu.
    
    Returns:
      (output_bytes, full_extracted_text, out_filename_ext, mime_type)
    """
    tess_lang = LANG_CODE_MAP.get(language, "eng")
    tess_dir = TESSDATA_DIR if os.path.exists(TESSDATA_DIR) else None

    # Handle image uploads by wrapping them into a PDF document
    is_pdf = file_bytes.startswith(b"%PDF")
    if is_pdf:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        if doc.is_encrypted:
            doc.authenticate("")
            if doc.is_encrypted and password:
                doc.authenticate(password.strip())
            if doc.is_encrypted:
                raise ValueError("This PDF document is password protected. Please unlock it using the 'Unlock PDF' tool or provide the correct password.")
    else:
        # It's an image file (PNG, JPG, TIFF, etc.)
        img = Image.open(io.BytesIO(file_bytes))
        doc = fitz.open()
        img_byte_arr = io.BytesIO()
        img.convert("RGB").save(img_byte_arr, format="JPEG", quality=95)
        img_bytes = img_byte_arr.getvalue()
        page = doc.new_page(width=img.width, height=img.height)
        page.insert_image(fitz.Rect(0, 0, img.width, img.height), stream=img_bytes)

    extracted_text_chunks = []
    
    for i, page in enumerate(doc):
        page_text = extract_ocr_from_page(page, tess_lang, tess_dir)
        if not page_text:
            # Check single language code if composite language failed
            single_lang = tess_lang.split("+")[0]
            if single_lang != tess_lang:
                page_text = extract_ocr_from_page(page, single_lang, tess_dir)

        if not page_text:
            page_text = f"[No readable text found on page {i+1}]"

        extracted_text_chunks.append(f"--- Page {i+1} [{language}] ---\n" + page_text)

    full_extracted_text = "\n\n".join(extracted_text_chunks)

    # Generate output based on requested format
    fmt = output_format.lower().strip()
    if fmt == "docx":
        out_bytes = create_docx_from_text(full_extracted_text, f"{language} Document OCR")
        out_ext = "docx"
        mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif fmt == "txt":
        out_bytes = full_extracted_text.encode("utf-8")
        out_ext = "txt"
        mime = "text/plain; charset=utf-8"
    else:
        # Default PDF format
        out_bytes = doc.tobytes()
        out_ext = "pdf"
        mime = "application/pdf"

    doc.close()
    return out_bytes, full_extracted_text, out_ext, mime

def ocr_image(image_bytes: bytes, language: str = "English") -> str:
    """Extract Indian language or English text from an image file."""
    tess_lang = LANG_CODE_MAP.get(language, "eng")
    tess_dir = TESSDATA_DIR if os.path.exists(TESSDATA_DIR) else None
    
    try:
        img = Image.open(io.BytesIO(image_bytes))
        config = f'--tessdata-dir "{tess_dir}"' if tess_dir and os.path.exists(tess_dir) else ""
        text = pytesseract.image_to_string(img, lang=tess_lang, config=config).strip()
        if text:
            return text
    except Exception as e:
        print(f"Pytesseract direct image OCR notice: {e}")

    try:
        # Fallback via PyMuPDF image page
        img = Image.open(io.BytesIO(image_bytes))
        doc = fitz.open()
        img_byte_arr = io.BytesIO()
        img.convert("RGB").save(img_byte_arr, format="JPEG", quality=95)
        page = doc.new_page(width=img.width, height=img.height)
        page.insert_image(fitz.Rect(0, 0, img.width, img.height), stream=img_byte_arr.getvalue())
        text = extract_ocr_from_page(page, tess_lang, tess_dir)
        doc.close()
        if text:
            return text
    except Exception as e:
        print(f"PyMuPDF fallback notice: {e}")

    return "No text could be recognized from the provided image."

