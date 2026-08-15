import io
import fitz
import docx
import openpyxl
import pptx
from PIL import Image

def validate_pdf_bytes(pdf_bytes: bytes) -> bool:
    """Validate that bytes represent a readable, uncorrupted PDF."""
    if not pdf_bytes or len(pdf_bytes) < 32:
        return False
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        valid = len(doc) >= 0
        doc.close()
        return valid
    except Exception:
        return False

def validate_docx_bytes(docx_bytes: bytes) -> bool:
    """Validate that bytes represent a valid Word document."""
    if not docx_bytes or len(docx_bytes) < 32:
        return False
    try:
        doc = docx.Document(io.BytesIO(docx_bytes))
        return doc is not None
    except Exception:
        return False

def validate_xlsx_bytes(xlsx_bytes: bytes) -> bool:
    """Validate that bytes represent a valid Excel spreadsheet."""
    if not xlsx_bytes or len(xlsx_bytes) < 32:
        return False
    try:
        wb = openpyxl.load_workbook(io.BytesIO(xlsx_bytes))
        return len(wb.sheetnames) > 0
    except Exception:
        return False

def validate_pptx_bytes(pptx_bytes: bytes) -> bool:
    """Validate that bytes represent a valid PowerPoint presentation."""
    if not pptx_bytes or len(pptx_bytes) < 32:
        return False
    try:
        prs = pptx.Presentation(io.BytesIO(pptx_bytes))
        return len(prs.slides) >= 0
    except Exception:
        return False

def validate_image_bytes(img_bytes: bytes) -> bool:
    """Validate that bytes represent a decodable image."""
    if not img_bytes or len(img_bytes) < 16:
        return False
    try:
        img = Image.open(io.BytesIO(img_bytes))
        img.verify()
        return True
    except Exception:
        return False

def validate_output(content: bytes, expected_type: str) -> bool:
    """Multi-format output validator."""
    t = expected_type.lower().replace(".", "").strip()
    if t == "pdf":
        return validate_pdf_bytes(content)
    elif t in ("docx", "doc", "word"):
        return validate_docx_bytes(content)
    elif t in ("xlsx", "xls", "excel"):
        return validate_xlsx_bytes(content)
    elif t in ("pptx", "ppt", "powerpoint"):
        return validate_pptx_bytes(content)
    elif t in ("jpg", "jpeg", "png", "webp", "bmp", "tiff", "image"):
        return validate_image_bytes(content)
    elif t in ("txt", "md", "html", "json", "csv"):
        return len(content) > 0
    elif t in ("zip", "archive"):
        import zipfile
        try:
            with zipfile.ZipFile(io.BytesIO(content), "r") as zf:
                return len(zf.namelist()) > 0
        except Exception:
            return False
    return len(content) > 0
