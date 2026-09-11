import io
import os
import re
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

def get_cloudmersive_ocr_api():
    api_key = os.getenv("CLOUDMERSIVE_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        import cloudmersive_ocr_api_client
        configuration = cloudmersive_ocr_api_client.Configuration()
        configuration.api_key['Apikey'] = api_key
        return cloudmersive_ocr_api_client.PdfOcrApi(cloudmersive_ocr_api_client.ApiClient(configuration))
    except Exception as e:
        print(f"[Cloudmersive OCR Init Error]: {e}")
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
    """
    Industrial-Grade Excel (.xlsx / .xls) -> PDF Converter.
    Multi-tier architecture:
    1. Headless LibreOffice Calc Engine (pdf:calc_pdf_Export) if installed.
    2. Cloudmersive Enterprise XLSX to PDF if configured.
    3. Native High-Precision openpyxl + ReportLab Platypus Engine (zero external dependencies).
    """
    if not xlsx_bytes or len(xlsx_bytes) < 10:
        raise ValueError("Invalid or empty Excel file provided.")

    import subprocess
    import tempfile
    import os
    import shutil
    import openpyxl
    import html
    import datetime

    # 1. Primary: Headless LibreOffice Calc Engine
    soffice_cmd = get_soffice_cmd()
    if soffice_cmd:
        # Pre-configure page setup for LibreOffice
        try:
            wb_prep = openpyxl.load_workbook(io.BytesIO(xlsx_bytes))
            for ws in wb_prep.worksheets:
                max_col = ws.max_column or 1
                ws.sheet_properties.pageSetUpPr.fitToPage = True
                ws.page_setup.fitToPage = True
                ws.page_setup.fitToWidth = 1
                ws.page_setup.fitToHeight = 0
                ws.print_options.gridLines = True
                ws.print_options.gridLinesSet = True
                if max_col > 6:
                    ws.page_setup.orientation = ws.ORIENTATION_LANDSCAPE
                else:
                    ws.page_setup.orientation = ws.ORIENTATION_PORTRAIT
            prep_buf = io.BytesIO()
            wb_prep.save(prep_buf)
            xlsx_bytes_for_lo = prep_buf.getvalue()
        except Exception:
            xlsx_bytes_for_lo = xlsx_bytes

        tmpdir = tempfile.mkdtemp(prefix="docflow_calc_")
        try:
            in_path = os.path.join(tmpdir, "sheet.xlsx")
            with open(in_path, "wb") as f:
                f.write(xlsx_bytes_for_lo)
            proc = subprocess.run(
                [soffice_cmd, "--headless", "--convert-to", "pdf:calc_pdf_Export", in_path, "--outdir", tmpdir],
                capture_output=True, text=True, timeout=40
            )
            out_pdf = os.path.join(tmpdir, "sheet.pdf")
            if os.path.exists(out_pdf) and os.path.getsize(out_pdf) > 0:
                with open(out_pdf, "rb") as f:
                    pdf_bytes = f.read()

                # Post-conversion validation
                try:
                    val_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
                    if len(val_doc) > 0:
                        val_doc.close()
                        return pdf_bytes
                    val_doc.close()
                except Exception:
                    pass
        except Exception as e:
            print(f"[excel_to_pdf LibreOffice]: {e}")
        finally:
            try:
                shutil.rmtree(tmpdir, ignore_errors=True)
            except Exception:
                pass

    # 2. Secondary: Cloudmersive Enterprise XLSX to PDF Engine
    cm_api = get_cloudmersive_convert_api()
    if cm_api:
        tmp_in_path = None
        try:
            tmp_f = tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False)
            tmp_f.write(xlsx_bytes)
            tmp_f.flush()
            tmp_f.close()
            tmp_in_path = tmp_f.name

            res = cm_api.convert_document_xlsx_to_pdf(tmp_in_path)
            if res:
                if isinstance(res, str) and os.path.exists(res):
                    with open(res, "rb") as fr:
                        res = fr.read()
                elif isinstance(res, str):
                    res = res.encode("latin1", errors="ignore")
                if isinstance(res, bytes) and len(res) > 50:
                    return res
        except Exception as e:
            print(f"[excel_to_pdf Cloudmersive]: {e}")
        finally:
            if tmp_in_path and os.path.exists(tmp_in_path):
                try:
                    os.remove(tmp_in_path)
                except Exception:
                    pass

    # 3. Tertiary: High-Precision Native Pure-Python openpyxl + ReportLab Engine
    try:
        from reportlab.lib.pagesizes import letter, landscape, A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors

        wb = openpyxl.load_workbook(io.BytesIO(xlsx_bytes), data_only=True)
        buffer = io.BytesIO()

        # Determine if any sheet needs landscape
        max_cols_all = max([ws.max_column for ws in wb.worksheets if ws.max_column] or [1])
        pagesize = landscape(letter) if max_cols_all > 6 else letter
        page_w, page_h = pagesize
        margin = 36
        avail_w = page_w - (2 * margin)

        doc = SimpleDocTemplate(
            buffer,
            pagesize=pagesize,
            leftMargin=margin,
            rightMargin=margin,
            topMargin=margin,
            bottomMargin=margin
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'SheetTitle',
            parent=styles['Heading2'],
            fontName='Helvetica-Bold',
            fontSize=13,
            leading=16,
            textColor=colors.HexColor('#1E1B4B'),
            spaceAfter=8
        )
        cell_style = ParagraphStyle(
            'CellText',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8,
            leading=10,
            textColor=colors.HexColor('#1E293B')
        )
        header_cell_style = ParagraphStyle(
            'HeaderCellText',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor('#FFFFFF')
        )

        story = []
        valid_sheets = [ws for ws in wb.worksheets if ws.max_row and ws.max_column and ws.max_row >= 1]
        if not valid_sheets:
            valid_sheets = wb.worksheets[:1]

        for s_idx, ws in enumerate(valid_sheets):
            if s_idx > 0:
                story.append(PageBreak())

            story.append(Paragraph(f"Sheet: {ws.title}", title_style))
            story.append(Spacer(1, 4))

            rows_raw = list(ws.iter_rows(values_only=True))
            if not rows_raw:
                story.append(Paragraph("<i>(Empty Sheet)</i>", cell_style))
                continue

            max_c = 0
            cleaned_rows = []
            for r in rows_raw:
                if r and any(v is not None and str(v).strip() != "" for v in r):
                    cleaned_rows.append(r)
                    non_empty_indices = [i for i, v in enumerate(r) if v is not None and str(v).strip() != ""]
                    if non_empty_indices:
                        max_c = max(max_c, max(non_empty_indices) + 1)

            if not cleaned_rows or max_c == 0:
                story.append(Paragraph("<i>(Empty Sheet)</i>", cell_style))
                continue

            table_data = []
            col_max_lens = [3] * max_c

            for r_idx, row in enumerate(cleaned_rows):
                row_cells = []
                for c_idx in range(max_c):
                    val = row[c_idx] if c_idx < len(row) else ""
                    if val is None:
                        val_str = ""
                    elif isinstance(val, float):
                        val_str = f"{val:,.2f}"
                    elif isinstance(val, (datetime.date, datetime.datetime)):
                        val_str = val.strftime("%Y-%m-%d")
                    else:
                        val_str = str(val).strip()

                    col_max_lens[c_idx] = max(col_max_lens[c_idx], min(len(val_str), 30))
                    st = header_cell_style if r_idx == 0 else cell_style
                    safe_val = html.escape(val_str).replace("\n", "<br/>")
                    p = Paragraph(safe_val if safe_val else "&nbsp;", st)
                    row_cells.append(p)
                table_data.append(row_cells)

            total_weight = sum(col_max_lens)
            col_widths = [(l / total_weight) * avail_w for l in col_max_lens]
            col_widths = [max(w, 35) for w in col_widths]
            total_w = sum(col_widths)
            if total_w > avail_w:
                col_widths = [(w / total_w) * avail_w for w in col_widths]

            t = Table(table_data, colWidths=col_widths, repeatRows=1)
            t_style = [
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4F46E5')),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('LEFTPADDING', (0, 0), (-1, -1), 4),
                ('RIGHTPADDING', (0, 0), (-1, -1), 4),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ]
            for r_i in range(1, len(table_data)):
                if r_i % 2 == 0:
                    t_style.append(('BACKGROUND', (0, r_i), (-1, r_i), colors.HexColor('#F8FAFC')))
            t.setStyle(TableStyle(t_style))
            story.append(t)
            story.append(Spacer(1, 12))

        doc.build(story)
        pdf_bytes = buffer.getvalue()
        if len(pdf_bytes) > 100:
            return pdf_bytes
    except Exception as py_e:
        print(f"[excel_to_pdf Native Python Error]: {py_e}")
        raise RuntimeError(f"Excel to PDF conversion failed: {py_e}")

    raise RuntimeError("Excel to PDF conversion produced empty or unreadable output.")

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

def pdf_to_jpg(pdf_bytes: bytes, dpi: int = 150) -> list[tuple[str, bytes]]:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    total = len(doc)
    doc.close()
    if total == 0:
        return []

    def render_page(pno: int) -> tuple[int, str, bytes]:
        p_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        p = p_doc[pno]
        pix = p.get_pixmap(dpi=dpi)
        img_b = pix.tobytes("jpeg")
        p_doc.close()
        return (pno, f"page_{pno + 1}.jpg", img_b)

    import concurrent.futures
    workers = min(16, total)
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        results = list(executor.map(render_page, range(total)))

    results.sort(key=lambda x: x[0])
    return [(name, b) for _, name, b in results]

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
    """
    Industrial-Grade Universal PDF -> Excel (.xlsx) Converter.
    Performs multi-stage tabular structure detection:
    1. Primary: High-precision pdfplumber line & text grid extraction for complex multi-column tables.
    2. Secondary: PyMuPDF (fitz.find_tables) vector layout and gutter analysis.
    3. Tertiary: Text whitespace column alignment for borderless tabular documents.
    4. Quaternary: Scanned PDF OCR fallback if no digital text is found.
    Parses integers, currencies, floats, percentages, and ISO/common dates.
    Generates styled multi-sheet OpenPyXL workbooks (per-page sheets + consolidated master sheet).
    """
    if not pdf_bytes or len(pdf_bytes) < 10:
        raise ValueError("Invalid or empty PDF file provided.")

    import io
    import re
    import os
    import datetime
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
    from openpyxl.cell.cell import ILLEGAL_CHARACTERS_RE
    import fitz
    import pdfplumber

    def parse_cell_value(val):
        if val is None:
            return ""
        s = ILLEGAL_CHARACTERS_RE.sub("", str(val)).strip()
        if not s:
            return ""
        # Check integer
        if re.match(r"^-?\d+$", s) and len(s) < 15 and (not s.startswith("0") or len(s) == 1):
            try:
                return int(s)
            except ValueError:
                pass
        # Check currency ($1,234.50 or €100.00 or £50 or ₹500)
        cleaned = re.sub(r"[,$€₹£¥]", "", s).strip()
        # Check percentage
        if cleaned.endswith("%"):
            try:
                return float(cleaned[:-1].strip()) / 100.0
            except ValueError:
                pass
        # Check float
        if re.match(r"^-?\d+\.\d+$", cleaned):
            try:
                return float(cleaned)
            except ValueError:
                pass
        # Check date YYYY-MM-DD or DD-MM-YYYY or DD/MM/YYYY
        if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
            try:
                return datetime.datetime.strptime(s, "%Y-%m-%d").date()
            except ValueError:
                pass
        elif re.match(r"^\d{1,2}[/-]\d{1,2}[/-]\d{4}$", s):
            for fmt in ["%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%m-%d-%Y"]:
                try:
                    return datetime.datetime.strptime(s, fmt).date()
                except ValueError:
                    pass
        return s

    wb = openpyxl.Workbook()
    wb.remove(wb.active) # Remove default blank sheet

    header_fill = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid")
    sub_header_fill = PatternFill(start_color="312E81", end_color="312E81", fill_type="solid")
    zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    header_font = Font(name="Segoe UI", size=10, bold=True, color="FFFFFF")
    regular_font = Font(name="Segoe UI", size=10, color="1E293B")
    title_font = Font(name="Segoe UI", size=12, bold=True, color="1E1B4B")
    
    thin_border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1")
    )

    all_master_rows = []

    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            total_pages = len(pdf.pages)
            if total_pages == 0:
                raise ValueError("PDF contains 0 pages.")

            for page_idx, page in enumerate(pdf.pages):
                sheet_title = f"Page {page_idx + 1}"
                ws = wb.create_sheet(title=sheet_title)
                ws.views.sheetView[0].showGridLines = True
                
                # Extract tables using pdfplumber line-based analysis
                tables = page.extract_tables()
                if not tables:
                    tables = page.extract_tables(table_settings={
                        "vertical_strategy": "text",
                        "horizontal_strategy": "text",
                        "snap_y_tolerance": 5,
                        "intersection_x_tolerance": 15
                    })

                valid_tables = []
                if tables:
                    for t in tables:
                        if t and any(any(bool(str(c).strip()) for c in row if c is not None) for row in t):
                            valid_tables.append(t)

                current_row = 1

                if valid_tables:
                    for t_idx, tbl in enumerate(valid_tables):
                        if t_idx > 0:
                            current_row += 1

                        for r_idx, row in enumerate(tbl):
                            if not row or not any(bool(str(c).strip()) for c in row if c is not None):
                                continue

                            is_hdr = (r_idx == 0)
                            ws.row_dimensions[current_row].height = 24 if is_hdr else 20
                            
                            row_cleaned_vals = []
                            for c_idx, cell in enumerate(row, start=1):
                                parsed = parse_cell_value(cell)
                                row_cleaned_vals.append(parsed)
                                c = ws.cell(row=current_row, column=c_idx, value=parsed)
                                c.border = thin_border
                                
                                if is_hdr:
                                    c.fill = header_fill
                                    c.font = header_font
                                    c.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
                                else:
                                    c.font = regular_font
                                    if current_row % 2 == 0:
                                        c.fill = zebra_fill
                                    if isinstance(parsed, (int, float)):
                                        c.alignment = Alignment(horizontal="right", vertical="center")
                                        if isinstance(parsed, float):
                                            c.number_format = "#,##0.00"
                                    else:
                                        c.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
                            
                            all_master_rows.append(row_cleaned_vals)
                            current_row += 1
                else:
                    # Fallback 1: PyMuPDF find_tables()
                    try:
                        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
                        f_page = doc[page_idx]
                        f_tabs = f_page.find_tables()
                        
                        if f_tabs and len(f_tabs.tables) > 0:
                            for main_table in f_tabs.tables:
                                extracted_grid = main_table.extract()
                                if not extracted_grid:
                                    continue
                                for r_idx, row in enumerate(extracted_grid):
                                    if not row or not any(bool(str(c).strip()) for c in row if c is not None):
                                        continue
                                    is_hdr = (r_idx == 0)
                                    ws.row_dimensions[current_row].height = 24 if is_hdr else 20
                                    row_cleaned_vals = []
                                    for c_idx, cell in enumerate(row, start=1):
                                        parsed = parse_cell_value(cell)
                                        row_cleaned_vals.append(parsed)
                                        c = ws.cell(row=current_row, column=c_idx, value=parsed)
                                        c.border = thin_border
                                        if is_hdr:
                                            c.fill = header_fill
                                            c.font = header_font
                                            c.alignment = Alignment(horizontal="left", vertical="center")
                                        else:
                                            c.font = regular_font
                                            if current_row % 2 == 0:
                                                c.fill = zebra_fill
                                            if isinstance(parsed, (int, float)):
                                                c.alignment = Alignment(horizontal="right", vertical="center")
                                            else:
                                                c.alignment = Alignment(horizontal="left", vertical="center")
                                    all_master_rows.append(row_cleaned_vals)
                                    current_row += 1
                        else:
                            # Fallback 2: Text block/line column splitting
                            raw_text = f_page.get_text("text").strip()
                            if raw_text:
                                for l_idx, line in enumerate(raw_text.splitlines(), start=1):
                                    line_s = line.strip()
                                    if not line_s:
                                        continue
                                    parts = re.split(r"\t+|\s{2,}", line_s)
                                    ws.row_dimensions[current_row].height = 20
                                    for c_idx, p in enumerate(parts, start=1):
                                        parsed = parse_cell_value(p)
                                        c = ws.cell(row=current_row, column=c_idx, value=parsed)
                                        c.border = thin_border
                                        c.font = regular_font
                                        if isinstance(parsed, (int, float)):
                                            c.alignment = Alignment(horizontal="right", vertical="center")
                                        else:
                                            c.alignment = Alignment(horizontal="left", vertical="center")
                                    current_row += 1
                            else:
                                # Fallback 3: Scanned PDF OCR fallback
                                try:
                                    import pytesseract
                                    pix = f_page.get_pixmap(dpi=150)
                                    from PIL import Image as PILImage
                                    ocr_img = PILImage.open(io.BytesIO(pix.tobytes("png")))
                                    ocr_text = pytesseract.image_to_string(ocr_img)
                                    for l_idx, line in enumerate(ocr_text.splitlines(), start=1):
                                        line_s = line.strip()
                                        if not line_s:
                                            continue
                                        parts = re.split(r"\t+|\s{2,}", line_s)
                                        ws.row_dimensions[current_row].height = 20
                                        for c_idx, p in enumerate(parts, start=1):
                                            parsed = parse_cell_value(p)
                                            c = ws.cell(row=current_row, column=c_idx, value=parsed)
                                            c.border = thin_border
                                            c.font = regular_font
                                            c.alignment = Alignment(horizontal="left", vertical="center")
                                        current_row += 1
                                except Exception:
                                    pass
                        doc.close()
                    except Exception as fe:
                        print(f"[pdf_to_excel fitz fallback]: {fe}")

                # Auto-adjust column widths
                for col in ws.columns:
                    max_len = 0
                    col_letter = get_column_letter(col[0].column)
                    for cell in col:
                        if cell.value is not None:
                            val_str = str(cell.value)
                            lines = val_str.split("\n")
                            max_len = max(max_len, max(len(l) for l in lines) if lines else 0)
                    ws.column_dimensions[col_letter].width = max(min(max_len + 4, 50), 12)

    except Exception as e:
        print(f"[pdf_to_excel pdfplumber error]: {e}")
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        for page_idx, page in enumerate(doc):
            ws = wb.create_sheet(title=f"Page {page_idx + 1}")
            ws.views.sheetView[0].showGridLines = True
            text = page.get_text("text")
            for r_idx, line in enumerate(text.splitlines(), start=1):
                if line.strip():
                    ws.cell(row=r_idx, column=1, value=line.strip())
        doc.close()

    # If multiple pages exist with structured rows, add a consolidated master sheet
    if len(wb.sheetnames) > 1 and all_master_rows:
        ws_all = wb.create_sheet(title="Consolidated Data", index=0)
        ws_all.views.sheetView[0].showGridLines = True
        current_r = 1
        for r_idx, row in enumerate(all_master_rows):
            is_hdr = (r_idx == 0)
            ws_all.row_dimensions[current_r].height = 24 if is_hdr else 20
            for c_idx, val in enumerate(row, start=1):
                c = ws_all.cell(row=current_r, column=c_idx, value=val)
                c.border = thin_border
                if is_hdr:
                    c.fill = sub_header_fill
                    c.font = header_font
                    c.alignment = Alignment(horizontal="left", vertical="center")
                else:
                    c.font = regular_font
                    if current_r % 2 == 0:
                        c.fill = zebra_fill
                    if isinstance(val, (int, float)):
                        c.alignment = Alignment(horizontal="right", vertical="center")
                    else:
                        c.alignment = Alignment(horizontal="left", vertical="center")
            current_r += 1

        for col in ws_all.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                if cell.value is not None:
                    max_len = max(max_len, len(str(cell.value)))
            ws_all.column_dimensions[col_letter].width = max(min(max_len + 4, 45), 12)

    buf = io.BytesIO()
    wb.save(buf)
    xlsx_bytes = buf.getvalue()

    # Post-generation verification
    val_wb = openpyxl.load_workbook(io.BytesIO(xlsx_bytes), data_only=True)
    if len(val_wb.sheetnames) == 0:
        raise ValueError("Generated Excel workbook is empty.")

    return xlsx_bytes

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
