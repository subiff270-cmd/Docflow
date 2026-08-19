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
    pil_images = []
    for b in images_bytes_list:
        img = Image.open(io.BytesIO(b))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        pil_images.append(img)
    
    output = io.BytesIO()
    if pil_images:
        pil_images[0].save(output, format="PDF", save_all=True, append_images=pil_images[1:])
    return output.getvalue()

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
    import html
    import subprocess
    import tempfile

    soffice_cmd = get_soffice_cmd()
    if soffice_cmd:
        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                in_path = os.path.join(tmpdir, "presentation.pptx")
                with open(in_path, "wb") as f:
                    f.write(pptx_bytes)
                subprocess.run([soffice_cmd, "--headless", "--convert-to", "pdf", in_path, "--outdir", tmpdir], check=True, timeout=20)
                out_pdf = os.path.join(tmpdir, "presentation.pdf")
                if os.path.exists(out_pdf):
                    with open(out_pdf, "rb") as f:
                        return f.read()
        except Exception as e:
            print(f"[ppt_to_pdf LibreOffice]: {e}")

    prs = Presentation(io.BytesIO(pptx_bytes))
    buffer = io.BytesIO()
    pdf_doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=54, leftMargin=54, topMargin=54, bottomMargin=54)
    styles = getSampleStyleSheet()
    story = []

    slide_num = 1
    for slide in prs.slides:
        story.append(Paragraph(f"Slide {slide_num}", styles['Heading1']))
        story.append(Spacer(1, 10))
        for shape in slide.shapes:
            if shape.has_text_frame:
                for paragraph in shape.text_frame.paragraphs:
                    raw_text = paragraph.text.strip()
                    if raw_text:
                        story.append(Paragraph(html.escape(raw_text), styles['Normal']))
                        story.append(Spacer(1, 4))
        story.append(Spacer(1, 15))
        slide_num += 1

    if not story:
        story.append(Paragraph("Empty Presentation", styles['Normal']))

    pdf_doc.build(story)
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
    buffer = io.BytesIO()
    pdf_doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []

    import re
    clean_text = re.sub('<[^<]+?>', '', html_content)
    for line in clean_text.splitlines():
        line = line.strip()
        if line:
            story.append(Paragraph(line, styles['Normal']))
            story.append(Spacer(1, 6))

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
    # 0. Cloudmersive Enterprise Engine
    cm_api = get_cloudmersive_convert_api()
    if cm_api:
        try:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_in:
                tmp_in.write(pdf_bytes)
                tmp_in_path = tmp_in.name
            try:
                res = cm_api.convert_document_pdf_to_pptx(tmp_in_path)
                if res and len(res) > 100:
                    return res
            finally:
                if os.path.exists(tmp_in_path):
                    os.remove(tmp_in_path)
        except Exception as e:
            print(f"[pdf_to_pptx Cloudmersive]: {e}")

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    prs = Presentation()
    # Standard 16:9 widescreen presentation
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    
    # Use blank slide layout (index 6 in default template, fallback to 0)
    layout = prs.slide_layouts[6] if len(prs.slide_layouts) > 6 else prs.slide_layouts[0]

    with tempfile.TemporaryDirectory() as tmpdir:
        for page_idx, page in enumerate(doc):
            slide = prs.slides.add_slide(layout)
            
            # High-resolution 200 DPI rendering for crisp presentation
            pix = page.get_pixmap(dpi=200)
            img_path = os.path.join(tmpdir, f"page_{page_idx}.png")
            pix.save(img_path)
            
            page_w = page.rect.width
            page_h = page.rect.height
            
            slide_w = 13.333
            slide_h = 7.5
            
            # Calculate aspect ratio scaling
            scale = min(slide_w / (page_w / 72.0), slide_h / (page_h / 72.0))
            target_w = (page_w / 72.0) * scale
            target_h = (page_h / 72.0) * scale
            left = (slide_w - target_w) / 2.0
            top = (slide_h - target_h) / 2.0
            
            slide.shapes.add_picture(img_path, Inches(left), Inches(top), width=Inches(target_w), height=Inches(target_h))

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
    import base64
    import html
    import re
    import subprocess
    import tempfile

    # 1. Primary: LibreOffice Headless HTML Export if available
    soffice_cmd = get_soffice_cmd()
    if soffice_cmd:
        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                in_pdf = os.path.join(tmpdir, "document.pdf")
                with open(in_pdf, "wb") as f:
                    f.write(pdf_bytes)
                res = subprocess.run(
                    [soffice_cmd, "--headless", "--convert-to", "html", in_pdf, "--outdir", tmpdir],
                    capture_output=True,
                    timeout=20
                )
                out_html = os.path.join(tmpdir, "document.html")
                if os.path.exists(out_html) and os.path.getsize(out_html) > 0:
                    with open(out_html, "rb") as f:
                        return f.read()
        except Exception as e:
            print(f"[pdf_to_html LibreOffice]: {e}")

    # 2. Modern Responsive HTML5 Document Builder with Embedded Base64 Images
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    html_out = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Converted Document</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #4F46E5;
      --bg: #F8FAFC;
      --card-bg: #FFFFFF;
      --text: #1E293B;
      --text-muted: #64748B;
      --border: #E2E8F0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 30px 15px;
    }
    .container {
      max-width: 860px;
      margin: 0 auto;
    }
    .page-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 40px;
      margin-bottom: 30px;
      box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05);
    }
    .page-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--primary);
      background: #EEF2FF;
      padding: 4px 10px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    h1, h2, h3, h4 {
      color: #0F172A;
      font-weight: 700;
      margin-top: 1.2em;
      margin-bottom: 0.6em;
      line-height: 1.3;
    }
    h1 { font-size: 1.6rem; }
    h2 { font-size: 1.3rem; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
    h3 { font-size: 1.1rem; }
    p { margin-bottom: 0.8em; font-size: 14px; color: #334155; }
    pre {
      background: #0F172A;
      color: #F8FAFC;
      font-family: 'Fira Code', monospace;
      font-size: 13px;
      padding: 16px 20px;
      border-radius: 12px;
      overflow-x: auto;
      margin: 15px 0;
      line-height: 1.5;
    }
    code {
      font-family: 'Fira Code', monospace;
      font-size: 13px;
      background: #F1F5F9;
      color: #0F172A;
      padding: 2px 6px;
      border-radius: 6px;
    }
    pre code { background: none; color: inherit; padding: 0; }
    .img-container {
      margin: 20px 0;
      text-align: center;
    }
    .img-container img {
      max-width: 100%;
      height: auto;
      border-radius: 12px;
      border: 1px solid var(--border);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 13px;
    }
    th, td {
      border: 1px solid var(--border);
      padding: 10px 14px;
      text-align: left;
    }
    th {
      background: #F8FAFC;
      font-weight: 600;
      color: #0F172A;
    }
    @media (max-width: 640px) {
      .page-card { padding: 20px 16px; border-radius: 12px; }
      body { padding: 15px 8px; }
    }
  </style>
</head>
<body>
  <div class="container">
"""

    for page_idx, page in enumerate(doc):
        html_out += f'    <div class="page-card">\n'
        html_out += f'      <div class="page-badge">Page {page_idx + 1} of {len(doc)}</div>\n'
        
        # 1. Process Text and Code
        text_blocks = page.get_text("blocks")
        text_blocks.sort(key=lambda b: b[1])

        for block in text_blocks:
            block_text = block[4].strip()
            if not block_text:
                continue

            lines = block_text.splitlines()
            is_code_block = any(line.strip().startswith(("import ", "from ", "def ", "class ", "plt.", "np.")) for line in lines)
            
            if is_code_block:
                escaped_code = "\n".join(html.escape(l) for l in lines)
                html_out += f'      <pre><code>{escaped_code}</code></pre>\n'
            else:
                for line in lines:
                    line_str = line.strip()
                    if not line_str:
                        continue
                    
                    is_h = line_str.isupper() and len(line_str) < 60
                    if is_h or any(line_str.upper().startswith(h) for h in ["PROGRAM", "AIM", "ALGORITHM", "OUTPUT", "RESULT"]):
                        html_out += f'      <h2>{html.escape(line_str)}</h2>\n'
                    else:
                        html_out += f'      <p>{html.escape(line_str)}</p>\n'

        # 2. Process Embedded Images / Charts as Base64
        image_list = page.get_images(full=True)
        for img_info in image_list:
            xref = img_info[0]
            try:
                pix = fitz.Pixmap(doc, xref)
                if pix.n > 4:
                    pix = fitz.Pixmap(fitz.csRGB, pix)
                if pix.width >= 100 and pix.height >= 80:
                    img_bytes = pix.tobytes("png")
                    b64_str = base64.b64encode(img_bytes).decode("ascii")
                    html_out += f'      <div class="img-container"><img src="data:image/png;base64,{b64_str}" alt="Document Figure" /></div>\n'
            except Exception as e:
                print(f"[pdf_to_html img b64]: {e}")

        html_out += f'    </div>\n'

    html_out += """  </div>
</body>
</html>"""
    
    doc.close()
    return html_out.encode("utf-8")

def pdf_to_markdown(pdf_bytes: bytes) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    md_lines = []
    for i, page in enumerate(doc):
        md_lines.append(f"# Page {i+1}\n")
        text = page.get_text("text")
        md_lines.append(text)
        md_lines.append("\n---\n")
    doc.close()
    return "\n".join(md_lines).encode("utf-8")

def pdf_to_pdfa(pdf_bytes: bytes) -> bytes:
    # PyMuPDF PDF/A compliance clean stream rewrite
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    buffer = io.BytesIO()
    doc.save(buffer, garbage=4, deflate=True, clean=True)
    doc.close()
    return buffer.getvalue()
