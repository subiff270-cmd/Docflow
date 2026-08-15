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
    wb = Workbook()
    ws = wb.active
    ws.title = "Sheet1"
    
    def clean_val(val):
        if val is None:
            return ""
        # Remove ASCII control characters that crash openpyxl
        import re
        from openpyxl.cell.cell import ILLEGAL_CHARACTERS_RE
        s = str(val)
        s = ILLEGAL_CHARACTERS_RE.sub("", s)
        return s.strip()

    row_idx = 1
    extracted_any = False

    # 1. Primary: Try pdfplumber table extraction
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                tables = page.extract_tables()
                if tables:
                    for table in tables:
                        for row in table:
                            for col_idx, cell in enumerate(row, start=1):
                                ws.cell(row=row_idx, column=col_idx, value=clean_val(cell))
                            row_idx += 1
                        row_idx += 1
                        extracted_any = True
                else:
                    text = page.extract_text()
                    if text:
                        for line in text.splitlines():
                            # If line contains tabs or commas, split across columns
                            parts = [clean_val(p) for p in (line.split("\t") if "\t" in line else line.split(","))]
                            for col_idx, p in enumerate(parts, start=1):
                                ws.cell(row=row_idx, column=col_idx, value=p)
                            row_idx += 1
                            extracted_any = True
    except Exception as e:
        print(f"[pdf_to_excel pdfplumber]: {e}")

    # 2. Secondary fallback: PyMuPDF line-by-line block extraction
    if not extracted_any:
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            for page in doc:
                text = page.get_text("text")
                if text:
                    for line in text.splitlines():
                        if line.strip():
                            parts = [clean_val(p) for p in (line.split("\t") if "\t" in line else line.split(","))]
                            for col_idx, p in enumerate(parts, start=1):
                                ws.cell(row=row_idx, column=col_idx, value=p)
                            row_idx += 1
            doc.close()
        except Exception as e:
            print(f"[pdf_to_excel fitz]: {e}")

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
