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
    doc = Document(io.BytesIO(docx_bytes))
    buffer = io.BytesIO()
    pdf_doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []

    for p in doc.paragraphs:
        text = p.text.strip()
        if text:
            style = styles['Heading1'] if p.style.name.startswith('Heading') else styles['Normal']
            story.append(Paragraph(text, style))
            story.append(Spacer(1, 8))

    for table in doc.tables:
        table_data = []
        for row in table.rows:
            row_data = [cell.text.strip() for cell in row.cells]
            table_data.append(row_data)
        if table_data:
            t = Table(table_data)
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(t)
            story.append(Spacer(1, 12))

    pdf_doc.build(story)
    return buffer.getvalue()

def ppt_to_pdf(pptx_bytes: bytes) -> bytes:
    prs = Presentation(io.BytesIO(pptx_bytes))
    buffer = io.BytesIO()
    pdf_doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []

    slide_num = 1
    for slide in prs.slides:
        story.append(Paragraph(f"Slide {slide_num}", styles['Heading1']))
        story.append(Spacer(1, 10))
        for shape in slide.shapes:
            if shape.has_text_frame:
                for paragraph in shape.text_frame.paragraphs:
                    if paragraph.text.strip():
                        story.append(Paragraph(paragraph.text.strip(), styles['Normal']))
                        story.append(Spacer(1, 4))
        story.append(Spacer(1, 15))
        slide_num += 1

    pdf_doc.build(story)
    return buffer.getvalue()

def excel_to_pdf(xlsx_bytes: bytes) -> bytes:
    wb = openpyxl.load_workbook(io.BytesIO(xlsx_bytes))
    buffer = io.BytesIO()
    pdf_doc = SimpleDocTemplate(buffer, pagesize=A4)
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
    # 1. Try high-precision pdf2docx conversion
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
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    prs = Presentation()
    # Standard 16:9 widescreen
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    for page in doc:
        slide = prs.slides.add_slide(blank_layout)
        
        # High resolution page rendering
        pix = page.get_pixmap(dpi=150)
        img_bytes = pix.tobytes("png")
        image_stream = io.BytesIO(img_bytes)
        
        page_w = page.rect.width
        page_h = page.rect.height
        
        # Fit nicely into slide
        slide_w = 13.333
        slide_h = 7.5
        
        # Calculate aspect ratio scaling
        scale = min(slide_w / (page_w / 72.0), slide_h / (page_h / 72.0))
        target_w = (page_w / 72.0) * scale
        target_h = (page_h / 72.0) * scale
        left = (slide_w - target_w) / 2
        top = (slide_h - target_h) / 2
        
        slide.shapes.add_picture(image_stream, Inches(left), Inches(top), width=Inches(target_w), height=Inches(target_h))

    buffer = io.BytesIO()
    prs.save(buffer)
    doc.close()
    return buffer.getvalue()

def pdf_to_excel(pdf_bytes: bytes) -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
    from openpyxl.cell.cell import ILLEGAL_CHARACTERS_RE

    wb = Workbook()
    default_sheet = wb.active

    header_fill = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    
    sub_header_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    sub_header_font = Font(name="Calibri", size=10, bold=True, color="1E293B")
    
    regular_font = Font(name="Calibri", size=10, color="1E293B")
    
    thin_border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1")
    )

    def parse_value(val):
        if val is None:
            return ""
        s = ILLEGAL_CHARACTERS_RE.sub("", str(val)).strip()
        if not s:
            return ""
        
        # Try integer
        if s.isdigit() and len(s) < 12 and not s.startswith("0"):
            try:
                return int(s)
            except ValueError:
                pass
        
        # Try float / number
        clean_num = s.replace(",", "")
        try:
            if "." in clean_num:
                return float(clean_num)
        except ValueError:
            pass
            
        return s

    def auto_fit_sheet(ws):
        ws.views.sheetView[0].showGridLines = True
        for col in ws.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                if cell.value is not None:
                    val_str = str(cell.value)
                    max_len = max(max_len, len(val_str))
            ws.column_dimensions[col_letter].width = min(max(max_len + 4, 12), 65)

    sheets_created = 0

    # 1. Primary Strategy: pdfplumber with multiple line & text tolerances
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page_idx, page in enumerate(pdf.pages, start=1):
                tables = page.extract_tables({
                    "vertical_strategy": "lines",
                    "horizontal_strategy": "lines",
                    "snap_tolerance": 4,
                    "join_tolerance": 4,
                })
                
                if not tables:
                    tables = page.extract_tables({
                        "vertical_strategy": "text",
                        "horizontal_strategy": "text",
                        "snap_tolerance": 3,
                    })

                if tables:
                    ws = wb.create_sheet(title=f"Page {page_idx}" if len(pdf.pages) > 1 else "Sheet1")
                    sheets_created += 1
                    current_row = 1

                    for t_idx, table in enumerate(tables):
                        if not table:
                            continue
                        
                        is_first_row = True
                        for row in table:
                            cleaned_row = [parse_value(c) for c in row]
                            if not any(bool(str(c).strip()) for c in cleaned_row):
                                continue

                            for col_idx, cell_val in enumerate(cleaned_row, start=1):
                                cell = ws.cell(row=current_row, column=col_idx, value=cell_val)
                                cell.border = thin_border
                                
                                if is_first_row:
                                    cell.fill = header_fill if t_idx == 0 and current_row == 1 else sub_header_fill
                                    cell.font = header_font if t_idx == 0 and current_row == 1 else sub_header_font
                                    cell.alignment = Alignment(horizontal="center" if isinstance(cell_val, (int, float)) else "left", vertical="center")
                                else:
                                    cell.font = regular_font
                                    if isinstance(cell_val, (int, float)):
                                        cell.alignment = Alignment(horizontal="right", vertical="center")
                                    else:
                                        cell.alignment = Alignment(horizontal="left", vertical="center")
                            
                            is_first_row = False
                            current_row += 1

                        current_row += 2

                    auto_fit_sheet(ws)
    except Exception as e:
        print(f"[pdf_to_excel pdfplumber error]: {e}")

    # 2. Secondary Strategy: PyMuPDF table finder and block parsing
    if sheets_created == 0:
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            for page_idx, page in enumerate(doc, start=1):
                ws = wb.create_sheet(title=f"Page {page_idx}" if len(doc) > 1 else "Sheet1")
                sheets_created += 1

                # Check if PyMuPDF table finder is available
                tabs = None
                try:
                    tabs = page.find_tables()
                except Exception:
                    pass

                if tabs and len(tabs.tables) > 0:
                    current_row = 1
                    for tab in tabs:
                        df_data = tab.extract()
                        is_header = True
                        for row in df_data:
                            for col_idx, val in enumerate(row, start=1):
                                c = ws.cell(row=current_row, column=col_idx, value=parse_value(val))
                                c.border = thin_border
                                if is_header:
                                    c.fill = header_fill
                                    c.font = header_font
                                else:
                                    c.font = regular_font
                            is_header = False
                            current_row += 1
                        current_row += 2
                else:
                    lines = page.get_text("text").splitlines()
                    current_row = 1
                    for line in lines:
                        if not line.strip():
                            continue
                        parts = line.split("\t") if "\t" in line else (line.split("   ") if "   " in line else [line])
                        for col_idx, p in enumerate(parts, start=1):
                            c = ws.cell(row=current_row, column=col_idx, value=parse_value(p))
                            c.font = regular_font
                        current_row += 1

                auto_fit_sheet(ws)
            doc.close()
        except Exception as e:
            print(f"[pdf_to_excel fitz error]: {e}")

    # Remove blank default sheet if we added pages
    if len(wb.sheetnames) > 1 and default_sheet in wb.worksheets:
        wb.remove(default_sheet)

    if not wb.sheetnames:
        wb.create_sheet(title="Sheet1")

    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()

def pdf_to_html(pdf_bytes: bytes) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    html_out = "<html><head><meta charset='utf-8'></head><body style='font-family:sans-serif; padding:20px;'>"
    for i, page in enumerate(doc):
        html_out += f"<div style='border:1px solid #ccc; padding:15px; margin-bottom:15px;'><h3>Page {i+1}</h3>"
        html_out += page.get_text("html")
        html_out += "</div>"
    html_out += "</body></html>"
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
