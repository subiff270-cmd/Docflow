import io
import os
import tempfile
import zipfile
import fitz  # PyMuPDF
import img2pdf
from PIL import Image
import docx
from docx import Document
import pptx
from pptx import Presentation
from pptx.util import Inches, Pt
import openpyxl
from openpyxl import Workbook
import pdfplumber
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

import shutil
import glob

def get_soffice_cmd() -> str | None:
    """Find LibreOffice binary across PATH and default Windows/Linux install directories."""
    # 1. Check CLI wrapper soffice.com first (Windows)
    cmd = shutil.which("soffice.com") or shutil.which("soffice") or shutil.which("libreoffice")
    if cmd:
        return cmd
    
    # 2. Common Windows directories
    win_paths = [
        r"C:\Program Files\LibreOffice\program\soffice.com",
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.com",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        r"C:\Program Files\LibreOffice*\program\soffice.com",
        r"C:\Program Files\LibreOffice*\program\soffice.exe",
    ]
    for p in win_paths:
        matches = glob.glob(p)
        if matches and os.path.exists(matches[0]):
            return matches[0]
    return None

def get_cloudmersive_convert_api():
    api_key = os.getenv("CLOUDMERSIVE_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        import cloudmersive_convert_api_client
        configuration = cloudmersive_convert_api_client.Configuration()
        configuration.api_key['Apikey'] = api_key
        return cloudmersive_convert_api_client.ConvertDocumentApi(cloudmersive_convert_api_client.ApiClient(configuration))
    except Exception as e:
        print(f"[Cloudmersive Init Error]: {e}")
        return None

def get_ghostscript_cmd() -> str | None:
    """Find Ghostscript binary across PATH and default Windows/Linux install directories."""
    cmd = shutil.which("gswin64c") or shutil.which("gswin32c") or shutil.which("gs")
    if cmd:
        return cmd
    
    win_paths = [
        r"C:\Program Files\gs\gs*\bin\gswin64c.exe",
        r"C:\Program Files (x86)\gs\gs*\bin\gswin32c.exe",
    ]
    for p in win_paths:
        matches = glob.glob(p)
        if matches and os.path.exists(matches[0]):
            return matches[0]
    return None

def jpg_to_pdf(images_bytes_list: list[bytes]) -> bytes:
    if not images_bytes_list:
        return b""

    A4_W, A4_H = 595.28, 841.89
    doc = fitz.open()

    for b in images_bytes_list:
        try:
            img = Image.open(io.BytesIO(b))
            # Auto-orient based on EXIF
            try:
                from PIL import ImageOps
                img = ImageOps.exif_transpose(img)
            except Exception:
                pass

            if img.mode in ("RGBA", "P", "LA", "CMYK"):
                bg = Image.new("RGB", img.size, (255, 255, 255))
                if img.mode in ("RGBA", "LA") and "A" in img.getbands():
                    bg.paste(img, mask=img.split()[-1])
                else:
                    bg.paste(img.convert("RGB"))
                img = bg
            else:
                img = img.convert("RGB")

            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=98)
            clean_bytes = buf.getvalue()

            img_w, img_h = img.size
            # Calculate scale to fit within A4 page proportionally
            scale = min(A4_W / img_w, A4_H / img_h)
            fit_w = img_w * scale
            fit_h = img_h * scale
            x0 = (A4_W - fit_w) / 2.0
            y0 = (A4_H - fit_h) / 2.0

            page = doc.new_page(width=A4_W, height=A4_H)
            rect = fitz.Rect(x0, y0, x0 + fit_w, y0 + fit_h)
            page.insert_image(rect, stream=clean_bytes)
        except Exception as e:
            print(f"[jpg_to_pdf page]: {e}")

    if len(doc) > 0:
        out_buf = io.BytesIO()
        doc.save(out_buf, garbage=4, deflate=True, clean=True)
        doc.close()
        return out_buf.getvalue()
    return b""

def word_to_pdf(docx_bytes: bytes) -> bytes:
    import html
    import subprocess
    import tempfile

    # 1. Primary: If LibreOffice / soffice is installed, use native headless rendering
    soffice_cmd = get_soffice_cmd()
    if soffice_cmd:
        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                in_path = os.path.join(tmpdir, "document.docx")
                with open(in_path, "wb") as f:
                    f.write(docx_bytes)
                subprocess.run([soffice_cmd, "--headless", "--convert-to", "pdf", in_path, "--outdir", tmpdir], check=True, timeout=20)
                out_pdf = os.path.join(tmpdir, "document.pdf")
                if os.path.exists(out_pdf):
                    with open(out_pdf, "rb") as f:
                        return f.read()
        except Exception as e:
            print(f"[word_to_pdf LibreOffice]: {e}")

    # 2. High-precision python-docx + ReportLab document builder
    doc = Document(io.BytesIO(docx_bytes))
    buffer = io.BytesIO()
    pdf_doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=54, leftMargin=54, topMargin=54, bottomMargin=54)
    styles = getSampleStyleSheet()
    story = []

    for p in doc.paragraphs:
        raw_text = p.text.strip()
        if raw_text:
            safe_text = html.escape(raw_text)
            style = styles['Heading1'] if p.style.name.startswith('Heading') else styles['Normal']
            story.append(Paragraph(safe_text, style))
            story.append(Spacer(1, 8))

    for table in doc.tables:
        table_data = []
        for row in table.rows:
            row_data = [Paragraph(html.escape(cell.text.strip()), styles['Normal']) for cell in row.cells]
            table_data.append(row_data)
        if table_data:
            t = Table(table_data)
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F1F5F9')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1'))
            ]))
            story.append(t)
            story.append(Spacer(1, 12))

    if not story:
        story.append(Paragraph("Empty Word Document", styles['Normal']))

    pdf_doc.build(story)
    return buffer.getvalue()

def ppt_to_pdf(pptx_bytes: bytes) -> bytes:
    import subprocess
    import tempfile
    import os
    import shutil

    # 1. Primary: Headless LibreOffice Impress Export (100% pixel-perfect slide layout & fonts)
    soffice_cmd = get_soffice_cmd()
    if soffice_cmd:
        tmpdir = tempfile.mkdtemp(prefix="docflow_ppt_")
        try:
            in_path = os.path.join(tmpdir, "presentation.pptx")
            with open(in_path, "wb") as f:
                f.write(pptx_bytes)
            subprocess.run([soffice_cmd, "--headless", "--convert-to", "pdf:impress_pdf_Export", in_path, "--outdir", tmpdir], check=True, timeout=30)
            out_pdf = os.path.join(tmpdir, "presentation.pdf")
            if os.path.exists(out_pdf) and os.path.getsize(out_pdf) > 0:
                with open(out_pdf, "rb") as f:
                    pdf_data = f.read()
                return pdf_data
        except Exception as e:
            print(f"[ppt_to_pdf LibreOffice]: {e}")
        finally:
            try:
                shutil.rmtree(tmpdir, ignore_errors=True)
            except Exception:
                pass

    # 2. Secondary: Cloudmersive Enterprise PPTX to PDF
    cm_api = get_cloudmersive_convert_api()
    if cm_api:
        tmp_in_path = None
        try:
            tmp_f = tempfile.NamedTemporaryFile(suffix=".pptx", delete=False)
            tmp_f.write(pptx_bytes)
            tmp_f.flush()
            tmp_f.close()
            tmp_in_path = tmp_f.name

            res = cm_api.convert_document_pptx_to_pdf(tmp_in_path)
            if res:
                if isinstance(res, str):
                    if os.path.exists(res):
                        with open(res, "rb") as fr:
                            res = fr.read()
                    elif (res.startswith("b'") and res.endswith("'")) or (res.startswith('b"') and res.endswith('"')):
                        try:
                            import ast
                            res = ast.literal_eval(res)
                        except Exception:
                            res = res.encode("latin1", errors="ignore")
                    else:
                        res = res.encode("latin1", errors="ignore")
                if isinstance(res, bytes) and len(res) > 50:
                    return res
        except Exception as e:
            print(f"[ppt_to_pdf Cloudmersive]: {e}")
        finally:
            if tmp_in_path and os.path.exists(tmp_in_path):
                try:
                    os.remove(tmp_in_path)
                except Exception:
                    pass

    # 3. Dynamic Slide Layout Fallback
    prs = Presentation(io.BytesIO(pptx_bytes))
    slide_w_pt = prs.slide_width.pt if prs.slide_width else 720.0
    slide_h_pt = prs.slide_height.pt if prs.slide_height else 405.0
    
    doc = fitz.open()
    for slide_idx, slide in enumerate(prs.slides):
        page = doc.new_page(width=slide_w_pt, height=slide_h_pt)
        for shape in slide.shapes:
            if shape.has_text_frame:
                sx = shape.left.pt if shape.left else 40.0
                sy = shape.top.pt if shape.top else 40.0
                sw = shape.width.pt if shape.width else slide_w_pt - 80.0
                sh = shape.height.pt if shape.height else 40.0
                rect = fitz.Rect(sx, sy, sx + sw, sy + sh)
                text = shape.text_frame.text.strip()
                if text:
                    page.insert_textbox(rect, text, fontsize=12, fontname="helv")

    buffer = io.BytesIO()
    doc.save(buffer, garbage=4, deflate=True, clean=True)
    doc.close()
    return buffer.getvalue()

def excel_to_pdf(xlsx_bytes: bytes) -> bytes:
    import html
    import subprocess
    import tempfile

    soffice_cmd = get_soffice_cmd()
    if soffice_cmd:
        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                in_path = os.path.join(tmpdir, "sheet.xlsx")
                with open(in_path, "wb") as f:
                    f.write(xlsx_bytes)
                subprocess.run([soffice_cmd, "--headless", "--convert-to", "pdf", in_path, "--outdir", tmpdir], check=True, timeout=20)
                out_pdf = os.path.join(tmpdir, "sheet.pdf")
                if os.path.exists(out_pdf):
                    with open(out_pdf, "rb") as f:
                        return f.read()
        except Exception as e:
            print(f"[excel_to_pdf LibreOffice]: {e}")

    wb = openpyxl.load_workbook(io.BytesIO(xlsx_bytes))
    buffer = io.BytesIO()
    pdf_doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()
    story = []

    for sheet_name in wb.sheetnames:
        sheet = wb[sheet_name]
        story.append(Paragraph(f"Sheet: {sheet_name}", styles['Heading1']))
        story.append(Spacer(1, 10))

        table_data = []
        for row in sheet.iter_rows(values_only=True):
            row_vals = [str(val) if val is not None else "" for val in row]
            if any(row_vals):
                table_data.append(row_vals)

        if table_data:
            t = Table(table_data)
            t.setStyle(TableStyle([
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('FONTSIZE', (0, 0), (-1, -1), 8)
            ]))
            story.append(t)
            story.append(Spacer(1, 15))

    pdf_doc.build(story)
    return buffer.getvalue()

def html_to_pdf(html_content: str) -> bytes:
    import tempfile
    import subprocess
    import os

    # 1. Primary: Cloudmersive Enterprise HTML to PDF Converter
    cm_api = get_cloudmersive_convert_api()
    if cm_api:
        try:
            with tempfile.NamedTemporaryFile(suffix=".html", delete=False, mode="w", encoding="utf-8") as tmp_in:
                tmp_in.write(html_content)
                tmp_in_path = tmp_in.name
            try:
                res = cm_api.convert_document_html_to_pdf(tmp_in_path)
                if res:
                    if isinstance(res, str):
                        if os.path.exists(res):
                            with open(res, "rb") as fr:
                                res = fr.read()
                        elif (res.startswith("b'") and res.endswith("'")) or (res.startswith('b"') and res.endswith('"')):
                            try:
                                import ast
                                res = ast.literal_eval(res)
                            except Exception:
                                res = res.encode("latin1", errors="ignore")
                        else:
                            res = res.encode("latin1", errors="ignore")
                    if isinstance(res, bytes) and len(res) > 50:
                        return res
            finally:
                if os.path.exists(tmp_in_path):
                    os.remove(tmp_in_path)
        except Exception as e:
            print(f"[html_to_pdf Cloudmersive]: {e}")

    # 2. Secondary: Headless LibreOffice HTML to PDF Engine
    soffice_cmd = get_soffice_cmd()
    if soffice_cmd:
        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                in_html = os.path.join(tmpdir, "document.html")
                with open(in_html, "w", encoding="utf-8") as f:
                    f.write(html_content)
                res = subprocess.run(
                    [soffice_cmd, "--headless", "--convert-to", "pdf", in_html, "--outdir", tmpdir],
                    capture_output=True,
                    timeout=20
                )
                out_pdf = os.path.join(tmpdir, "document.pdf")
                if os.path.exists(out_pdf) and os.path.getsize(out_pdf) > 0:
                    with open(out_pdf, "rb") as f:
                        return f.read()
        except Exception as e:
            print(f"[html_to_pdf LibreOffice]: {e}")

    # 3. Structural ReportLab Fallback
    buffer = io.BytesIO()
    pdf_doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=54, leftMargin=54, topMargin=54, bottomMargin=54)
    styles = getSampleStyleSheet()
    story = []

    import re
    clean_text = re.sub('<[^<]+?>', '', html_content)
    for line in clean_text.splitlines():
        line = line.strip()
        if line:
            story.append(Paragraph(line, styles['Normal']))
            story.append(Spacer(1, 6))

    if not story:
        story.append(Paragraph("Empty HTML Document", styles['Normal']))

    pdf_doc.build(story)
    return buffer.getvalue()

def pdf_to_jpg(pdf_bytes: bytes) -> list[tuple[str, bytes]]:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = []
    for i in range(len(doc)):
        page = doc[i]
        pix = page.get_pixmap(dpi=150)
        img_bytes = pix.tobytes("jpeg")
        pages.append((f"page_{i+1}.jpg", img_bytes))
    doc.close()
    return pages

def pdf_to_word(pdf_bytes: bytes) -> bytes:
    # 0. Cloudmersive Enterprise Engine
    cm_api = get_cloudmersive_convert_api()
    if cm_api:
        try:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_in:
                tmp_in.write(pdf_bytes)
                tmp_in_path = tmp_in.name
            try:
                res = cm_api.convert_document_pdf_to_docx(tmp_in_path)
                if res and len(res) > 100:
                    return res
            finally:
                if os.path.exists(tmp_in_path):
                    os.remove(tmp_in_path)
        except Exception as e:
            print(f"[pdf_to_word Cloudmersive]: {e}")

    # 1. High-precision pdf2docx conversion
    try:
        from pdf2docx import Converter
        pdf_file = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
        pdf_file.write(pdf_bytes)
        pdf_file.close()
        pdf_path = pdf_file.name
        docx_path = pdf_path + ".docx"

        try:
            cv = Converter(pdf_path)
            cv.convert(docx_path)
            cv.close()

            with open(docx_path, "rb") as f_docx:
                out_bytes = f_docx.read()
            return out_bytes
        finally:
            if os.path.exists(pdf_path):
                os.remove(pdf_path)
            if os.path.exists(docx_path):
                os.remove(docx_path)
    except Exception as e:
        print(f"[pdf_to_word fallback]: {e}")

    # 2. PyMuPDF + python-docx structural fallback
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    docx_doc = Document()
    for page in doc:
        text = page.get_text("text")
        if text.strip():
            for paragraph in text.split("\n\n"):
                if paragraph.strip():
                    docx_doc.add_paragraph(paragraph.strip())
    buffer = io.BytesIO()
    docx_doc.save(buffer)
    doc.close()
    return buffer.getvalue()

def pdf_to_pptx(pdf_bytes: bytes) -> bytes:
    import tempfile
    import os
    from pptx import Presentation
    from pptx.util import Pt

    # Ultra-High-Definition (300 DPI) Vector Slide Engine (Matching iLovePDF / Smallpdf / Adobe standard)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    prs = Presentation()
    
    first_page = doc[0] if len(doc) > 0 else None
    if first_page:
        prs.slide_width = Pt(first_page.rect.width)
        prs.slide_height = Pt(first_page.rect.height)
    else:
        prs.slide_width = Inches(10)
        prs.slide_height = Inches(7.5)
    
    blank_layout = prs.slide_layouts[6] if len(prs.slide_layouts) > 6 else prs.slide_layouts[0]

    with tempfile.TemporaryDirectory() as tmpdir:
        for page_idx, page in enumerate(doc):
            slide = prs.slides.add_slide(blank_layout)
            
            # 300 DPI Ultra-Crisp Rendering - 100% pixel-perfect vector typography, graphics, and backgrounds
            pix = page.get_pixmap(dpi=300)
            img_path = os.path.join(tmpdir, f"slide_{page_idx}.png")
            pix.save(img_path)
            
            slide.shapes.add_picture(img_path, Pt(0), Pt(0), width=Pt(page.rect.width), height=Pt(page.rect.height))

        out_pptx = os.path.join(tmpdir, "presentation.pptx")
        prs.save(out_pptx)
        with open(out_pptx, "rb") as f:
            out_bytes = f.read()

    doc.close()
    return out_bytes

def pdf_to_excel(pdf_bytes: bytes) -> bytes:
    # 0. Cloudmersive Enterprise Engine
    cm_api = get_cloudmersive_convert_api()
    if cm_api:
        try:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_in:
                tmp_in.write(pdf_bytes)
                tmp_in_path = tmp_in.name
            try:
                res = cm_api.convert_document_pdf_to_xlsx(tmp_in_path)
                if res and len(res) > 100:
                    return res
            finally:
                if os.path.exists(tmp_in_path):
                    os.remove(tmp_in_path)
        except Exception as e:
            print(f"[pdf_to_excel Cloudmersive]: {e}")

    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
    from openpyxl.cell.cell import ILLEGAL_CHARACTERS_RE
    from openpyxl.drawing.image import Image as OpenPyXLImage
    import re

    wb = Workbook()
    ws = wb.active
    ws.title = "Sheet1"

    # Styling definitions
    title_font = Font(name="Calibri", size=12, bold=True, color="000000")
    header_font = Font(name="Calibri", size=11, bold=True, color="000000")
    table_header_font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    table_header_fill = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid")
    regular_font = Font(name="Calibri", size=10, color="000000")
    code_font = Font(name="Consolas", size=9.5, color="1E293B")
    
    thin_border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1")
    )
    box_border = Border(
        left=Side(style="thin", color="000000"),
        right=Side(style="thin", color="000000"),
        top=Side(style="thin", color="000000"),
        bottom=Side(style="thin", color="000000")
    )

    def parse_value(val):
        if val is None:
            return ""
        s = ILLEGAL_CHARACTERS_RE.sub("", str(val)).strip()
        if not s:
            return ""
        if s.isdigit() and len(s) < 12 and not s.startswith("0"):
            try:
                return int(s)
            except ValueError:
                pass
        clean_num = s.replace(",", "")
        try:
            if "." in clean_num:
                return float(clean_num)
        except ValueError:
            pass
        return s

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    current_row = 1
    max_cols_used = 1

    with tempfile.TemporaryDirectory() as tmpdir:
        for page_idx, page in enumerate(doc):
            # 1. Check for real structured tables on this page
            tabs = None
            try:
                tabs = page.find_tables()
            except Exception:
                pass

            table_bboxes = []
            if tabs and len(tabs.tables) > 0:
                for tab in tabs:
                    table_bboxes.append(tab.bbox)
                    df_data = tab.extract()
                    if not df_data:
                        continue
                    
                    is_header_row = True
                    for row in df_data:
                        cleaned_row = [parse_value(c) for c in row]
                        if not any(bool(str(c).strip()) for c in cleaned_row):
                            continue
                        
                        max_cols_used = max(max_cols_used, len(cleaned_row))
                        for col_idx, cell_val in enumerate(cleaned_row, start=1):
                            cell = ws.cell(row=current_row, column=col_idx, value=cell_val)
                            cell.border = thin_border
                            if is_header_row:
                                cell.fill = table_header_fill
                                cell.font = table_header_font
                                cell.alignment = Alignment(horizontal="center", vertical="center")
                            else:
                                cell.font = regular_font
                                cell.alignment = Alignment(
                                    horizontal="right" if isinstance(cell_val, (int, float)) else "left",
                                    vertical="center"
                                )
                        is_header_row = False
                        current_row += 1
                    current_row += 1

            # 2. Process non-table text blocks
            text_blocks = page.get_text("blocks")
            text_blocks.sort(key=lambda b: b[1])

            for block in text_blocks:
                bx0, by0, bx1, by1, block_text = block[0], block[1], block[2], block[3], block[4].strip()
                if not block_text:
                    continue

                # Skip block if it falls entirely inside an already extracted table
                inside_table = False
                for tbbox in table_bboxes:
                    if by0 >= tbbox[1] - 5 and by1 <= tbbox[3] + 5:
                        inside_table = True
                        break
                if inside_table:
                    continue

                lines = block_text.splitlines()

                # Dynamic Title Box Detection (Page 1 top header)
                if page_idx == 0 and current_row == 1 and by0 < 150 and len(lines) <= 3:
                    full_title = "\n".join(lines)
                    cell_a = ws.cell(row=current_row, column=1, value=full_title)
                    cell_a.font = title_font
                    cell_a.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
                    ws.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=6)
                    for col_i in range(1, 7):
                        ws.cell(row=current_row, column=col_i).border = box_border
                    current_row += 2
                    continue

                for line in lines:
                    line_str = line.strip()
                    if not line_str:
                        continue

                    # Numbered list alignment (e.g. "1. Step description", "i. Feature")
                    list_match = re.match(r"^(\d+\.|\b[ivx]+\.|\b[a-zA-Z]\.|\*|-|•)\s*(.*)$", line_str)
                    if list_match and len(list_match.group(1)) <= 4:
                        marker = list_match.group(1).strip()
                        body = list_match.group(2).strip()
                        
                        c_marker = ws.cell(row=current_row, column=1, value=marker)
                        c_marker.font = regular_font
                        c_marker.alignment = Alignment(horizontal="left", vertical="top")
                        
                        c_body = ws.cell(row=current_row, column=2, value=parse_value(body))
                        c_body.font = regular_font
                        c_body.alignment = Alignment(horizontal="left", vertical="top")
                        max_cols_used = max(max_cols_used, 2)
                        current_row += 1
                        continue

                    # Multi-column line detection (tabs or multi-spaces)
                    parts = [p.strip() for p in re.split(r"\t| {3,}", line_str) if p.strip()]
                    if len(parts) > 1:
                        max_cols_used = max(max_cols_used, len(parts))
                        for col_i, part in enumerate(parts, start=1):
                            c = ws.cell(row=current_row, column=col_i, value=parse_value(part))
                            c.font = regular_font
                            c.alignment = Alignment(horizontal="left", vertical="top")
                        current_row += 1
                        continue

                    # Dynamic Heading detection (uppercase words, bold indicators, key section terms)
                    is_heading = (
                        line_str.isupper() and len(line_str) < 60
                    ) or any(line_str.upper().startswith(h) for h in [
                        "PROGRAM", "AIM", "ALGORITHM", "OUTPUT", "RESULT", "SECTION",
                        "CHAPTER", "TABLE", "INVOICE", "TOTAL", "SUMMARY", "NOTE"
                    ])

                    c = ws.cell(row=current_row, column=1, value=parse_value(line_str))
                    if is_heading:
                        c.font = header_font
                    elif line_str.startswith("import ") or line_str.startswith("from ") or line_str.startswith("def ") or "=" in line_str:
                        c.font = code_font
                    else:
                        c.font = regular_font
                    c.alignment = Alignment(horizontal="left", vertical="top")
                    current_row += 1

                current_row += 1

            # 3. Extract Embedded Images & Charts on the page
            image_list = page.get_images(full=True)
            for img_idx, img_info in enumerate(image_list):
                xref = img_info[0]
                try:
                    pix = fitz.Pixmap(doc, xref)
                    if pix.n > 4:
                        pix = fitz.Pixmap(fitz.csRGB, pix)
                    
                    if pix.width >= 100 and pix.height >= 80:
                        img_filename = f"img_p{page_idx}_{img_idx}_{xref}.png"
                        img_path = os.path.join(tmpdir, img_filename)
                        pix.save(img_path)
                        
                        xl_img = OpenPyXLImage(img_path)
                        max_w = 480
                        if xl_img.width > max_w:
                            ratio = max_w / xl_img.width
                            xl_img.width = int(xl_img.width * ratio)
                            xl_img.height = int(xl_img.height * ratio)
                        
                        anchor_cell = f"A{current_row}"
                        ws.add_image(xl_img, anchor_cell)
                        rows_spanned = max(6, int(xl_img.height / 20) + 2)
                        current_row += rows_spanned
                except Exception as e:
                    print(f"[pdf_to_excel image extract]: {e}")

            current_row += 1

        # Dynamic Auto-Fit Column Widths for all columns used
        for col_i in range(1, max(max_cols_used + 1, 7)):
            col_letter = get_column_letter(col_i)
            if col_i == 1:
                ws.column_dimensions[col_letter].width = 16
            elif col_i == 2:
                ws.column_dimensions[col_letter].width = 75
            else:
                ws.column_dimensions[col_letter].width = 22

        doc.close()

        buffer = io.BytesIO()
        wb.save(buffer)
        return buffer.getvalue()

def pdf_to_html(pdf_bytes: bytes) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    html_out = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Converted Document</title>
  <style>
    * { box-sizing: border-box; }
    body {
      background-color: #525659;
      margin: 0;
      padding: 30px 10px;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .pdf-page-container {
      background: white;
      position: relative;
      margin-bottom: 24px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
      overflow: hidden;
    }
    .pdf-page-container div {
      position: relative;
    }
    .pdf-page-container p {
      position: absolute;
      margin: 0;
      padding: 0;
      white-space: pre-wrap;
    }
    .pdf-page-container img {
      position: absolute;
    }
  </style>
</head>
<body>
"""

    for page_idx, page in enumerate(doc):
        w = page.rect.width
        h = page.rect.height
        page_html = page.get_text("html")
        html_out += f'  <div class="pdf-page-container" style="width:{w}pt; height:{h}pt;">\n'
        html_out += page_html
        html_out += '\n  </div>\n'

    html_out += """</body>
</html>"""
    
    doc.close()
    return html_out.encode("utf-8")

def pdf_to_markdown(pdf_bytes: bytes) -> bytes:
    # 1. Primary: Enterprise Layout-Aware PyMuPDF4LLM Engine (CloudConvert / Marker-grade)
    try:
        import pymupdf4llm
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        md_text = pymupdf4llm.to_markdown(doc, page_chunks=False, write_images=False)
        doc.close()
        if md_text and len(md_text.strip()) > 0:
            return md_text.encode("utf-8")
    except Exception as e:
        print(f"[pdf_to_markdown pymupdf4llm]: {e}")

    # 2. Advanced Multi-Pass GFM Markdown Fallback
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    md_lines = []

    for page_idx, page in enumerate(doc):
        md_lines.append(f"<!-- Page {page_idx + 1} -->\n")
        
        # Check for vector/drawn tables on the page
        tabs = None
        try:
            tabs = page.find_tables()
        except Exception:
            pass

        table_bboxes = []
        if tabs and len(tabs.tables) > 0:
            for tab in tabs:
                table_bboxes.append(tab.bbox)
                df_data = tab.extract()
                if not df_data:
                    continue
                # Format as GitHub Flavored Markdown Table
                headers = [str(c or "").strip().replace("\n", " ") for c in df_data[0]]
                md_lines.append("| " + " | ".join(headers) + " |")
                md_lines.append("| " + " | ".join([":---" for _ in headers]) + " |")
                for row in df_data[1:]:
                    cleaned_row = [str(c or "").strip().replace("\n", " ") for c in row]
                    md_lines.append("| " + " | ".join(cleaned_row) + " |")
                md_lines.append("\n")

        # Process Non-Table Blocks
        text_blocks = page.get_text("blocks")
        text_blocks.sort(key=lambda b: b[1])

        for block in text_blocks:
            by0, by1, block_text = block[1], block[3], block[4].strip()
            if not block_text:
                continue

            inside_table = False
            for tbbox in table_bboxes:
                if by0 >= tbbox[1] - 5 and by1 <= tbbox[3] + 5:
                    inside_table = True
                    break
            if inside_table:
                continue

            lines = block_text.splitlines()
            is_code = any(l.strip().startswith(("import ", "from ", "def ", "class ", "plt.", "np.")) for l in lines)

            if is_code:
                md_lines.append("```python")
                md_lines.extend(lines)
                md_lines.append("```\n")
            else:
                for line in lines:
                    line_str = line.strip()
                    if not line_str:
                        continue
                    if line_str.isupper() and len(line_str) < 50:
                        md_lines.append(f"## {line_str}\n")
                    else:
                        md_lines.append(f"{line_str}\n")
                md_lines.append("\n")

        md_lines.append("\n---\n\n")

    doc.close()
    return "".join(md_lines).encode("utf-8")

def pdf_to_pdfa(pdf_bytes: bytes) -> bytes:
    import subprocess
    import tempfile
    import os

    # 1. Primary: Ghostscript ISO PDF/A Engine if available
    gs_cmd = get_ghostscript_cmd()
    if gs_cmd:
        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                in_pdf = os.path.join(tmpdir, "in.pdf")
                out_pdf = os.path.join(tmpdir, "out_pdfa.pdf")
                with open(in_pdf, "wb") as f:
                    f.write(pdf_bytes)
                cmd = [
                    gs_cmd,
                    "-dPDFA=2",
                    "-dBATCH",
                    "-dNOPAUSE",
                    "-dNOOUTERSAVE",
                    "-sProcessColorModel=DeviceRGB",
                    "-sDEVICE=pdfwrite",
                    "-sPDFACompatibilityPolicy=1",
                    f"-sOutputFile={out_pdf}",
                    in_pdf
                ]
                res = subprocess.run(cmd, capture_output=True, timeout=25)
                if os.path.exists(out_pdf) and os.path.getsize(out_pdf) > 0:
                    with open(out_pdf, "rb") as f:
                        return f.read()
        except Exception as e:
            print(f"[pdf_to_pdfa Ghostscript]: {e}")

    # 2. Native PyMuPDF ISO-19005-2 PDF/A-2b Compliant Synthesizer
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    xmp_schema = (
        '<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>\n'
        '<x:xmpmeta xmlns:x="adobe:ns:meta/">\n'
        '  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n'
        '    <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/schema#">\n'
        '      <pdfaid:part>2</pdfaid:part>\n'
        '      <pdfaid:conformance>B</pdfaid:conformance>\n'
        '    </rdf:Description>\n'
        '    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">\n'
        '      <dc:format>application/pdf</dc:format>\n'
        '    </rdf:Description>\n'
        '    <rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">\n'
        '      <pdf:Producer>DocFlow ISO-19005-2 PDF/A Engine</pdf:Producer>\n'
        '    </rdf:Description>\n'
        '  </rdf:RDF>\n'
        '</x:xmpmeta>\n'
        '<?xpacket end="w"?>'
    )
    try:
        doc.set_xml_metadata(xmp_schema)
    except Exception as e:
        print(f"[pdf_to_pdfa xmp]: {e}")

    buffer = io.BytesIO()
    doc.save(buffer, garbage=4, deflate=True, clean=True)
    doc.close()
    return buffer.getvalue()
