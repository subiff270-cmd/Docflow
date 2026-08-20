import io
import os
import fitz  # PyMuPDF
import pypdf
from pypdf import PdfReader, PdfWriter
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

def merge_pdfs(file_bytes_list: list[bytes]) -> bytes:
    writer = PdfWriter()
    for b in file_bytes_list:
        reader = PdfReader(io.BytesIO(b))
        for page in reader.pages:
            writer.add_page(page)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()

def split_pdf(file_bytes: bytes, split_mode: str = "ranges", ranges: str = "", every_n: int = 1) -> list[tuple[str, bytes]]:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    num_pages = len(doc)
    results = []

    if split_mode == "individual":
        for i in range(num_pages):
            new_doc = fitz.open()
            new_doc.insert_pdf(doc, from_page=i, to_page=i)
            results.append((f"page_{i+1}.pdf", new_doc.tobytes()))
            new_doc.close()
    elif split_mode == "every_n" and every_n > 0:
        chunk_idx = 1
        for i in range(0, num_pages, every_n):
            new_doc = fitz.open()
            end_page = min(i + every_n - 1, num_pages - 1)
            new_doc.insert_pdf(doc, from_page=i, to_page=end_page)
            results.append((f"split_part_{chunk_idx}_pages_{i+1}_to_{end_page+1}.pdf", new_doc.tobytes()))
            new_doc.close()
            chunk_idx += 1
    else:  # ranges e.g. "1-2, 3-5, 8-10"
        parts = [p.strip() for p in ranges.split(",") if p.strip()]
        if not parts:
            parts = [f"1-{num_pages}"]

        for r_idx, part in enumerate(parts, start=1):
            if "-" in part:
                sub = part.split("-")
                if len(sub) == 2 and sub[0].isdigit() and sub[1].isdigit():
                    start = max(1, int(sub[0]))
                    end = min(num_pages, int(sub[1]))
                    if start <= end:
                        new_doc = fitz.open()
                        new_doc.insert_pdf(doc, from_page=start - 1, to_page=end - 1)
                        fname = f"split_{r_idx}_pages_{start}-{end}.pdf" if len(parts) > 1 else f"split_pages_{start}-{end}.pdf"
                        results.append((fname, new_doc.tobytes()))
                        new_doc.close()
            elif part.isdigit():
                val = int(part)
                if 1 <= val <= num_pages:
                    new_doc = fitz.open()
                    new_doc.insert_pdf(doc, from_page=val - 1, to_page=val - 1)
                    fname = f"split_{r_idx}_page_{val}.pdf" if len(parts) > 1 else f"split_page_{val}.pdf"
                    results.append((fname, new_doc.tobytes()))
                    new_doc.close()

        if not results:
            new_doc = fitz.open()
            new_doc.insert_pdf(doc, from_page=0, to_page=num_pages - 1)
            results.append(("split_document.pdf", new_doc.tobytes()))
            new_doc.close()

    doc.close()
    return results

def parse_page_ranges(ranges_str: str, max_pages: int) -> list[int]:
    indices = []
    parts = ranges_str.split(",")
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            sub = part.split("-")
            if len(sub) == 2 and sub[0].isdigit() and sub[1].isdigit():
                start = max(1, int(sub[0]))
                end = min(max_pages, int(sub[1]))
                for i in range(start, end + 1):
                    indices.append(i - 1)
        elif part.isdigit():
            val = int(part)
            if 1 <= val <= max_pages:
                indices.append(val - 1)
    return sorted(list(set(indices)))

def remove_pages(file_bytes: bytes, pages_to_remove: list[int]) -> bytes:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages_to_remove_0 = [p - 1 for p in pages_to_remove if 1 <= p <= len(doc)]
    
    new_doc = fitz.open()
    for i in range(len(doc)):
        if i not in pages_to_remove_0:
            new_doc.insert_pdf(doc, from_page=i, to_page=i)
    
    out = new_doc.tobytes()
    new_doc.close()
    doc.close()
    return out

def extract_pages(file_bytes: bytes, pages_range_str: str) -> bytes:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    indices = parse_page_ranges(pages_range_str, len(doc))
    if not indices:
        indices = list(range(len(doc)))
    
    new_doc = fitz.open()
    for idx in indices:
        new_doc.insert_pdf(doc, from_page=idx, to_page=idx)
    
    out = new_doc.tobytes()
    new_doc.close()
    doc.close()
    return out

def organize_pdf(file_bytes: bytes, page_orders: list[dict]) -> bytes:
    """
    page_orders e.g. [{"original_page": 1, "rotation": 90, "delete": False}, ...]
    """
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    new_doc = fitz.open()

    for item in page_orders:
        if item.get("delete"):
            continue
        orig_idx = item["original_page"] - 1
        if 0 <= orig_idx < len(doc):
            page_idx = new_doc.page_count
            new_doc.insert_pdf(doc, from_page=orig_idx, to_page=orig_idx)
            rot = item.get("rotation", 0)
            if rot:
                page = new_doc[page_idx]
                page.set_rotation((page.rotation + rot) % 360)

    out = new_doc.tobytes()
    new_doc.close()
    doc.close()
    return out

def compress_pdf(file_bytes: bytes, level: str = "medium") -> tuple[bytes, int, int]:
    import subprocess
    import tempfile
    from .conversion_service import get_ghostscript_cmd

    orig_size = len(file_bytes)

    # 1. Primary Ghostscript Engine if available
    gs_cmd = get_ghostscript_cmd()
    if gs_cmd:
        try:
            pdf_settings = "/screen" if level == "high" else "/ebook" if level == "medium" else "/printer"
            with tempfile.TemporaryDirectory() as tmpdir:
                in_pdf = os.path.join(tmpdir, "input.pdf")
                out_pdf = os.path.join(tmpdir, "output.pdf")
                with open(in_pdf, "wb") as f:
                    f.write(file_bytes)
                cmd = [
                    gs_cmd,
                    "-sDEVICE=pdfwrite",
                    "-dCompatibilityLevel=1.4",
                    f"-dPDFSETTINGS={pdf_settings}",
                    "-dNOPAUSE",
                    "-dQUIET",
                    "-dBATCH",
                    f"-sOutputFile={out_pdf}",
                    in_pdf
                ]
                subprocess.run(cmd, check=True, timeout=25)
                if os.path.exists(out_pdf) and os.path.getsize(out_pdf) > 0:
                    with open(out_pdf, "rb") as f:
                        comp_bytes = f.read()
                        return comp_bytes, orig_size, len(comp_bytes)
        except Exception as e:
            print(f"[compress_pdf Ghostscript]: {e}")

    # 2. Native High-Precision PyMuPDF Deflate Engine
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    deflate = True
    garbage = 4 # maximum garbage collection
    
    if level == "high":
        for page in doc:
            img_list = page.get_images()
            for img_info in img_list:
                xref = img_info[0]
                try:
                    pix = fitz.Pixmap(doc, xref)
                    if pix.n > 4:
                        pix = fitz.Pixmap(fitz.csRGB, pix)
                    if pix.width > 1200 or pix.height > 1200:
                        pix_small = fitz.Pixmap(pix, int(pix.width * 0.6), int(pix.height * 0.6), 0)
                        doc.update_stream(xref, pix_small.tobytes("jpeg"))
                except Exception:
                    pass

    out_bytes = doc.tobytes(garbage=garbage, deflate=deflate, clean=True)
    doc.close()
    comp_size = len(out_bytes)
    return out_bytes, orig_size, comp_size

def repair_pdf(file_bytes: bytes) -> bytes:
    import subprocess
    import tempfile
    import shutil
    from .conversion_service import get_ghostscript_cmd

    # 1. Primary Ghostscript / pdftocairo Repair
    gs_cmd = get_ghostscript_cmd()
    if gs_cmd:
        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                in_pdf = os.path.join(tmpdir, "corrupt.pdf")
                out_pdf = os.path.join(tmpdir, "repaired.pdf")
                with open(in_pdf, "wb") as f:
                    f.write(file_bytes)
                cmd = [
                    gs_cmd,
                    "-sDEVICE=pdfwrite",
                    "-dNOPAUSE",
                    "-dQUIET",
                    "-dBATCH",
                    f"-sOutputFile={out_pdf}",
                    in_pdf
                ]
                subprocess.run(cmd, check=True, timeout=25)
                if os.path.exists(out_pdf) and os.path.getsize(out_pdf) > 0:
                    with open(out_pdf, "rb") as f:
                        return f.read()
        except Exception as e:
            print(f"[repair_pdf Ghostscript]: {e}")

    # pdftocairo check
    cairo_cmd = shutil.which("pdftocairo")
    if cairo_cmd:
        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                in_pdf = os.path.join(tmpdir, "corrupt.pdf")
                out_pdf = os.path.join(tmpdir, "repaired.pdf")
                with open(in_pdf, "wb") as f:
                    f.write(file_bytes)
                subprocess.run([cairo_cmd, "-pdf", in_pdf, out_pdf], check=True, timeout=25)
                if os.path.exists(out_pdf) and os.path.getsize(out_pdf) > 0:
                    with open(out_pdf, "rb") as f:
                        return f.read()
        except Exception as e:
            print(f"[repair_pdf pdftocairo]: {e}")

    # 2. Native PyMuPDF Xref Stream Reconstruction
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        if doc.is_encrypted:
            raise ValueError("Encrypted PDF cannot be repaired without password.")
        out_bytes = doc.tobytes(garbage=4, clean=True, deflate=True)
        doc.close()
        return out_bytes
    except Exception as e:
        raise ValueError(f"Unable to repair corrupted PDF: {str(e)}")

def rotate_pdf(file_bytes: bytes, angle: int = 90, pages: str = "all") -> bytes:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    num_pages = len(doc)

    target_indices = parse_page_ranges(pages, num_pages) if pages != "all" else list(range(num_pages))

    for idx in target_indices:
        if 0 <= idx < num_pages:
            page = doc[idx]
            page.set_rotation((page.rotation + angle) % 360)

    out = doc.tobytes()
    doc.close()
    return out

def add_page_numbers(file_bytes: bytes, position: str = "bottom-center", start_number: int = 1) -> bytes:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    num_pages = len(doc)

    for i in range(num_pages):
        page = doc[i]
        rect = page.rect
        page_num_str = str(start_number + i)
        
        # Position logic
        x, y = rect.width / 2, rect.height - 30
        align_mode = fitz.TEXT_ALIGN_CENTER
        
        if "top" in position:
            y = 30
        if "left" in position:
            x = 50
            align_mode = fitz.TEXT_ALIGN_LEFT
        elif "right" in position:
            x = rect.width - 50
            align_mode = fitz.TEXT_ALIGN_RIGHT

        box_rect = fitz.Rect(x - 60, y - 12, x + 60, y + 12)
        page.insert_textbox(box_rect, page_num_str, fontsize=10, fontname="helv", color=(0.2, 0.2, 0.2), align=align_mode)

    out = doc.tobytes()
    doc.close()
    return out

def add_watermark(file_bytes: bytes, text: str = "CONFIDENTIAL", opacity: float = 0.3, rotation: float = 45, font_size: float = 40) -> bytes:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    
    for page in doc:
        rect = page.rect
        center = fitz.Point(rect.width / 4, rect.height / 2)
        
        page.insert_text(
            center,
            text,
            fontsize=font_size,
            fontname="helv",
            color=(0.5, 0.5, 0.5),
            fill_opacity=opacity,
            morph=(center, fitz.Matrix(float(rotation)))
        )

    out = doc.tobytes()
    doc.close()
    return out

def crop_pdf(file_bytes: bytes, crop_x: float, crop_y: float, crop_w: float, crop_h: float) -> bytes:
    """Crop bounds provided in normalized percentages (0-100) or points."""
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    for page in doc:
        rect = page.rect
        # convert normalized 0-100 to actual coordinates
        x0 = (crop_x / 100.0) * rect.width
        y0 = (crop_y / 100.0) * rect.height
        x1 = x0 + (crop_w / 100.0) * rect.width
        y1 = y0 + (crop_h / 100.0) * rect.height
        page.set_cropbox(fitz.Rect(x0, y0, x1, y1))
        
    out = doc.tobytes()
    doc.close()
    return out

def unlock_pdf(file_bytes: bytes, password: str) -> bytes:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    if doc.is_encrypted:
        success = doc.authenticate(password)
        if not success:
            doc.close()
            raise ValueError("Incorrect password.")
    out = doc.tobytes()
    doc.close()
    return out

def protect_pdf(file_bytes: bytes, password: str) -> bytes:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    out = doc.tobytes(
        encryption=fitz.PDF_ENCRYPT_AES_256,
        user_pw=password,
        owner_pw=password,
        permissions=fitz.PDF_PERM_ACCESSIBILITY | fitz.PDF_PERM_PRINT
    )
    doc.close()
    return out

def sign_pdf(file_bytes: bytes, signature_image_bytes: bytes, page_num: int, x: float, y: float, w: float, h: float) -> bytes:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    if 1 <= page_num <= len(doc):
        page = doc[page_num - 1]
        rect = page.rect
        
        # Coordinates in points
        rx0 = (x / 100.0) * rect.width
        ry0 = (y / 100.0) * rect.height
        rx1 = rx0 + (w / 100.0) * rect.width
        ry1 = ry0 + (h / 100.0) * rect.height
        
        img_rect = fitz.Rect(rx0, ry0, rx1, ry1)
        page.insert_image(img_rect, stream=signature_image_bytes)

    out = doc.tobytes()
    doc.close()
    return out

def redact_pdf(file_bytes: bytes, search_text: str = "", redact_rects: list[dict] = None) -> bytes:
    """True PDF redaction removing underlying text/content streams."""
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    
    for page in doc:
        if search_text:
            text_instances = page.search_for(search_text)
            for inst in text_instances:
                page.add_redact_annot(inst, text="[REDACTED]", fill=(0, 0, 0))
        
        if redact_rects:
            rect = page.rect
            for r in redact_rects:
                if r.get("page", 1) == page.number + 1:
                    rx0 = (r["x"] / 100.0) * rect.width
                    ry0 = (r["y"] / 100.0) * rect.height
                    rx1 = rx0 + (r["w"] / 100.0) * rect.width
                    ry1 = ry0 + (r["h"] / 100.0) * rect.height
                    page.add_redact_annot(fitz.Rect(rx0, ry0, rx1, ry1), fill=(0, 0, 0))

        page.apply_redactions()

    out = doc.tobytes()
    doc.close()
    return out

def compare_pdfs(pdf_a_bytes: bytes, pdf_b_bytes: bytes) -> dict:
    doc_a = fitz.open(stream=pdf_a_bytes, filetype="pdf")
    doc_b = fitz.open(stream=pdf_b_bytes, filetype="pdf")

    text_a = "\n".join([p.get_text() for p in doc_a])
    text_b = "\n".join([p.get_text() for p in doc_b])

    doc_a_pages = len(doc_a)
    doc_b_pages = len(doc_b)

    import difflib
    diff = list(difflib.unified_diff(
        text_a.splitlines(),
        text_b.splitlines(),
        fromfile="PDF_A",
        tofile="PDF_B",
        lineterm=""
    ))

    added_count = sum(1 for line in diff if line.startswith("+") and not line.startswith("+++"))
    removed_count = sum(1 for line in diff if line.startswith("-") and not line.startswith("---"))

    doc_a.close()
    doc_b.close()

    return {
        "pdf_a_pages": doc_a_pages,
        "pdf_b_pages": doc_b_pages,
        "added_lines": added_count,
        "removed_lines": removed_count,
        "diff_summary": diff[:100]
    }

def edit_pdf(file_bytes: bytes, text_inserts: list[dict] = None, annotations: list[dict] = None) -> bytes:
    """Add annotations, text layers, and markings into real PDF."""
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    
    if text_inserts:
        for item in text_inserts:
            page_num = item.get("page", 1) - 1
            if 0 <= page_num < len(doc):
                page = doc[page_num]
                text = item.get("text", "")
                x = item.get("x", 50)
                y = item.get("y", 50)
                size = item.get("size", 12)
                page.insert_text(fitz.Point(x, y), text, fontsize=size, color=(0, 0, 0))

    if annotations:
        for ann in annotations:
            page_num = ann.get("page", 1) - 1
            if 0 <= page_num < len(doc):
                page = doc[page_num]
                rect = fitz.Rect(ann.get("x0", 50), ann.get("y0", 50), ann.get("x1", 200), ann.get("y1", 100))
                ann_type = ann.get("type", "highlight")
                if ann_type == "highlight":
                    page.add_highlight_annot(rect)
                elif ann_type == "rect":
                    page.add_rect_annot(rect)

    out = doc.tobytes()
    doc.close()
    return out

def fill_pdf_forms(file_bytes: bytes, form_data: dict = None) -> tuple[bytes, list[dict]]:
    """Detect and complete interactive PDF form fields."""
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    fields = []

    for page in doc:
        for widget in page.widgets():
            fields.append({
                "name": widget.field_name,
                "type": widget.field_type_string,
                "value": widget.field_value
            })
            if form_data and widget.field_name in form_data:
                widget.field_value = str(form_data[widget.field_name])
                widget.update()

    out = doc.tobytes()
    doc.close()
    return out, fields

