import io
import os
import json
import base64
import zipfile
import fitz
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Header
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from ..models import ConversionHistory
from ..services.usage_service import check_user_quota, record_conversion_success
from ..services.storage_service import save_generated_bytes, get_file_by_key
from ..services import pdf_service, conversion_service, ocr_service, voice_service, image_service, validation_service, ai_service, translate_service

router = APIRouter(prefix="/api/tools", tags=["tools"])

def get_uid_from_header(x_firebase_uid: Optional[str] = Header(None)) -> str:
    return x_firebase_uid or "anonymous_guest"

@router.post("/merge-pdf")
async def api_merge_pdf(
    files: List[UploadFile] = File(...),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded.")
    
    total_bytes = 0
    file_bytes_list = []
    for f in files:
        content = await f.read()
        total_bytes += len(content)
        file_bytes_list.append(content)
    
    size_mb = total_bytes / (1024 * 1024)
    allowed, msg = check_user_quota(db, uid, size_mb)
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)
    
    try:
        merged_bytes = pdf_service.merge_pdfs(file_bytes_list)
        item = save_generated_bytes(db, merged_bytes, "merged_document.pdf", "application/pdf", uid)
        return {"success": True, "download_key": item.file_key, "filename": item.original_name, "size": item.file_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to merge PDFs: {str(e)}")

@router.post("/split-pdf")
async def api_split_pdf(
    file: UploadFile = File(...),
    split_mode: str = Form("ranges"),
    ranges: str = Form(""),
    every_n: int = Form(1),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        results = pdf_service.split_pdf(content, split_mode, ranges, every_n)
        if len(results) == 1:
            name, b = results[0]
            item = save_generated_bytes(db, b, name, "application/pdf", uid)
            return {"success": True, "download_key": item.file_key, "filename": name, "size": item.file_size}
        else:
            # Package ZIP
            zip_buffer = io.BytesIO()
            with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
                for fname, fb in results:
                    zf.writestr(fname, fb)
            zip_bytes = zip_buffer.getvalue()
            zip_name = f"split_{os.path.splitext(file.filename)[0]}.zip"
            item = save_generated_bytes(db, zip_bytes, zip_name, "application/zip", uid)
            return {"success": True, "download_key": item.file_key, "filename": zip_name, "size": item.file_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to split PDF: {str(e)}")

@router.post("/remove-pages")
async def api_remove_pages(
    file: UploadFile = File(...),
    pages: str = Form(...), # e.g. "1,3,5"
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        page_nums = [int(p.strip()) for p in pages.split(",") if p.strip().isdigit()]
        out_bytes = pdf_service.remove_pages(content, page_nums)
        out_name = f"removed_{file.filename}"
        item = save_generated_bytes(db, out_bytes, out_name, "application/pdf", uid)
        return {"success": True, "download_key": item.file_key, "filename": out_name, "size": item.file_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to remove pages: {str(e)}")

@router.post("/extract-pages")
async def api_extract_pages(
    file: UploadFile = File(...),
    ranges: str = Form(...), # e.g. "2,5,8-12"
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        out_bytes = pdf_service.extract_pages(content, ranges)
        out_name = f"extracted_{file.filename}"
        item = save_generated_bytes(db, out_bytes, out_name, "application/pdf", uid)
        return {"success": True, "download_key": item.file_key, "filename": out_name, "size": item.file_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract pages: {str(e)}")

@router.post("/organize-pdf")
async def api_organize_pdf(
    file: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None),
    page_orders_json: str = Form(...),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    all_files = []
    if files:
        all_files.extend(files)
    if file and file not in all_files:
        all_files.insert(0, file)

    if not all_files:
        raise HTTPException(status_code=400, detail="No PDF file provided.")

    file_bytes_list = []
    total_len = 0
    for f in all_files:
        content = await f.read()
        total_len += len(content)
        file_bytes_list.append(content)

    allowed, msg = check_user_quota(db, uid, total_len / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        page_orders = json.loads(page_orders_json)
        out_bytes, metadata = pdf_service.organize_pdf(file_bytes_list, page_orders)
        out_name = f"organized_{all_files[0].filename}"
        item = save_generated_bytes(db, out_bytes, out_name, "application/pdf", uid)
        return {
            "success": True,
            "download_key": item.file_key,
            "filename": out_name,
            "size": item.file_size,
            "metadata": metadata
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to organize PDF: {str(e)}")

@router.post("/pdf-thumbnails")
async def api_pdf_thumbnails(
    file: UploadFile = File(...)
):
    try:
        content = await file.read()
        doc = fitz.open(stream=content, filetype="pdf")
        thumbnails = []
        for idx, page in enumerate(doc):
            pix = page.get_pixmap(dpi=90)
            img_b64 = base64.b64encode(pix.tobytes("png")).decode("utf-8")
            thumbnails.append({
                "page_num": idx + 1,
                "width": page.rect.width,
                "height": page.rect.height,
                "thumbnail": f"data:image/png;base64,{img_b64}"
            })
        doc.close()
        return {"success": True, "total_pages": len(thumbnails), "thumbnails": thumbnails}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate thumbnails: {str(e)}")

@router.post("/scan-to-pdf")
async def api_scan_to_pdf(
    files: List[UploadFile] = File(...),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    image_bytes_list = []
    total_len = 0
    for f in files:
        b = await f.read()
        total_len += len(b)
        image_bytes_list.append(b)

    allowed, msg = check_user_quota(db, uid, total_len / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        pdf_bytes = conversion_service.jpg_to_pdf(image_bytes_list)
        item = save_generated_bytes(db, pdf_bytes, "scanned_document.pdf", "application/pdf", uid)
        return {"success": True, "download_key": item.file_key, "filename": item.original_name, "size": item.file_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to convert scan images to PDF: {str(e)}")

@router.post("/compress-pdf")
async def api_compress_pdf(
    file: UploadFile = File(...),
    level: str = Form("medium"),
    target_size_kb: Optional[int] = Form(None),
    quality_percent: Optional[int] = Form(None),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        out_bytes, orig_sz, comp_sz = pdf_service.compress_pdf(
            content,
            level=level,
            target_size_kb=target_size_kb,
            quality_percent=quality_percent
        )
        out_name = f"compressed_{file.filename}"
        item = save_generated_bytes(db, out_bytes, out_name, "application/pdf", uid)
        reduction_pct = max(0, int(((orig_sz - comp_sz) / orig_sz) * 100)) if orig_sz > 0 else 0
        return {
            "success": True,
            "download_key": item.file_key,
            "filename": out_name,
            "original_size": orig_sz,
            "compressed_size": comp_sz,
            "reduction_percentage": reduction_pct
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compress PDF: {str(e)}")

@router.post("/repair-pdf")
async def api_repair_pdf(
    file: UploadFile = File(...),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        repaired_bytes = pdf_service.repair_pdf(content)
        out_name = f"repaired_{file.filename}"
        item = save_generated_bytes(db, repaired_bytes, out_name, "application/pdf", uid)
        return {"success": True, "download_key": item.file_key, "filename": out_name, "size": item.file_size}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/ocr-pdf")
async def api_ocr_pdf(
    file: UploadFile = File(...),
    language: str = Form("English"),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        searchable_pdf, text = ocr_service.ocr_pdf(content, language)
        out_name = f"ocr_{file.filename}"
        item = save_generated_bytes(db, searchable_pdf, out_name, "application/pdf", uid)
        return {
            "success": True,
            "download_key": item.file_key,
            "filename": out_name,
            "extracted_text": text[:3000]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR failed: {str(e)}")

# Conversions To PDF
@router.post("/jpg-to-pdf")
async def api_jpg_to_pdf(
    files: List[UploadFile] = File(...),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    imgs = []
    total_len = 0
    for f in files:
        b = await f.read()
        total_len += len(b)
        imgs.append(b)
    
    allowed, msg = check_user_quota(db, uid, total_len / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        pdf_bytes = conversion_service.jpg_to_pdf(imgs)
        item = save_generated_bytes(db, pdf_bytes, "images.pdf", "application/pdf", uid)
        return {"success": True, "download_key": item.file_key, "filename": "images.pdf", "size": item.file_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to convert JPG to PDF: {str(e)}")

@router.post("/word-to-pdf")
async def api_word_to_pdf(
    file: UploadFile = File(...),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        pdf_bytes = conversion_service.word_to_pdf(content)
        out_name = f"{os.path.splitext(file.filename)[0]}.pdf"
        item = save_generated_bytes(db, pdf_bytes, out_name, "application/pdf", uid)
        return {"success": True, "download_key": item.file_key, "filename": out_name, "size": item.file_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Word to PDF conversion failed: {str(e)}")

@router.post("/ppt-to-pdf")
async def api_ppt_to_pdf(
    file: UploadFile = File(...),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        pdf_bytes = conversion_service.ppt_to_pdf(content)
        out_name = f"{os.path.splitext(file.filename)[0]}.pdf"
        item = save_generated_bytes(db, pdf_bytes, out_name, "application/pdf", uid)
        return {"success": True, "download_key": item.file_key, "filename": out_name, "size": item.file_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PowerPoint to PDF conversion failed: {str(e)}")

@router.post("/excel-to-pdf")
async def api_excel_to_pdf(
    file: UploadFile = File(...),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        pdf_bytes = conversion_service.excel_to_pdf(content)
        out_name = f"{os.path.splitext(file.filename)[0]}.pdf"
        item = save_generated_bytes(db, pdf_bytes, out_name, "application/pdf", uid)
        return {"success": True, "download_key": item.file_key, "filename": out_name, "size": item.file_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Excel to PDF conversion failed: {str(e)}")

@router.post("/html-to-pdf")
async def api_html_to_pdf(
    file: Optional[UploadFile] = File(None),
    html_text: Optional[str] = Form(None),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content_str = ""
    if file:
        b = await file.read()
        content_str = b.decode("utf-8", errors="ignore")
    elif html_text:
        content_str = html_text

    if not content_str:
        raise HTTPException(status_code=400, detail="No HTML file or content provided.")

    allowed, msg = check_user_quota(db, uid, len(content_str.encode("utf-8")) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        pdf_bytes = conversion_service.html_to_pdf(content_str)
        item = save_generated_bytes(db, pdf_bytes, "html_converted.pdf", "application/pdf", uid)
        return {"success": True, "download_key": item.file_key, "filename": "html_converted.pdf", "size": item.file_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"HTML to PDF failed: {str(e)}")

# Conversions From PDF
@router.post("/pdf-to-jpg")
async def api_pdf_to_jpg(
    file: UploadFile = File(...),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        pages = conversion_service.pdf_to_jpg(content)
        if len(pages) == 1:
            name, b = pages[0]
            item = save_generated_bytes(db, b, name, "image/jpeg", uid)
            return {"success": True, "download_key": item.file_key, "filename": name, "size": item.file_size}
        else:
            zip_buffer = io.BytesIO()
            with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
                for fname, fb in pages:
                    zf.writestr(fname, fb)
            zip_bytes = zip_buffer.getvalue()
            zip_name = f"{os.path.splitext(file.filename)[0]}_images.zip"
            item = save_generated_bytes(db, zip_bytes, zip_name, "application/zip", uid)
            return {"success": True, "download_key": item.file_key, "filename": zip_name, "size": item.file_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF to JPG failed: {str(e)}")

@router.post("/pdf-to-word")
async def api_pdf_to_word(
    file: UploadFile = File(...),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        docx_bytes = conversion_service.pdf_to_word(content)
        out_name = f"{os.path.splitext(file.filename)[0]}.docx"
        item = save_generated_bytes(db, docx_bytes, out_name, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", uid)
        return {"success": True, "download_key": item.file_key, "filename": out_name, "size": item.file_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF to Word failed: {str(e)}")

@router.post("/pdf-to-ppt")
async def api_pdf_to_ppt(
    file: UploadFile = File(...),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        pptx_bytes = conversion_service.pdf_to_pptx(content)
        out_name = f"{os.path.splitext(file.filename)[0]}.pptx"
        item = save_generated_bytes(db, pptx_bytes, out_name, "application/vnd.openxmlformats-officedocument.presentationml.presentation", uid)
        return {"success": True, "download_key": item.file_key, "filename": out_name, "size": item.file_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF to PowerPoint failed: {str(e)}")

@router.post("/pdf-to-excel")
async def api_pdf_to_excel(
    file: UploadFile = File(...),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        xlsx_bytes = conversion_service.pdf_to_excel(content)
        out_name = f"{os.path.splitext(file.filename)[0]}.xlsx"
        item = save_generated_bytes(db, xlsx_bytes, out_name, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", uid)
        return {"success": True, "download_key": item.file_key, "filename": out_name, "size": item.file_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF to Excel failed: {str(e)}")

@router.post("/pdf-to-pdfa")
async def api_pdf_to_pdfa(
    file: UploadFile = File(...),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        pdfa_bytes = conversion_service.pdf_to_pdfa(content)
        out_name = f"{os.path.splitext(file.filename)[0]}_pdfa.pdf"
        item = save_generated_bytes(db, pdfa_bytes, out_name, "application/pdf", uid)
        return {"success": True, "download_key": item.file_key, "filename": out_name, "size": item.file_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF to PDF/A failed: {str(e)}")

@router.post("/pdf-to-html")
async def api_pdf_to_html(
    file: UploadFile = File(...),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        html_bytes = conversion_service.pdf_to_html(content)
        out_name = f"{os.path.splitext(file.filename)[0]}.html"
        item = save_generated_bytes(db, html_bytes, out_name, "text/html", uid)
        return {"success": True, "download_key": item.file_key, "filename": out_name, "size": item.file_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF to HTML failed: {str(e)}")

@router.post("/pdf-to-markdown")
async def api_pdf_to_markdown(
    file: UploadFile = File(...),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        md_text = conversion_service.pdf_to_markdown(content)
        out_bytes = md_text if isinstance(md_text, bytes) else md_text.encode("utf-8")
        out_name = f"{os.path.splitext(file.filename)[0]}.md"
        item = save_generated_bytes(db, out_bytes, out_name, "text/markdown", uid)
        return {"success": True, "download_key": item.file_key, "filename": out_name, "markdown": out_bytes.decode('utf-8', errors='ignore')}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF to Markdown failed: {str(e)}")

# Edit & Security Tools
@router.post("/rotate-pdf")
async def api_rotate_pdf(
    file: UploadFile = File(...),
    angle: int = Form(90),
    pages: str = Form("all"),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        rotated = pdf_service.rotate_pdf(content, angle, pages)
        out_name = f"rotated_{file.filename}"
        item = save_generated_bytes(db, rotated, out_name, "application/pdf", uid)
        return {"success": True, "download_key": item.file_key, "filename": out_name, "size": item.file_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rotate PDF failed: {str(e)}")

@router.post("/add-page-numbers")
async def api_add_page_numbers(
    file: UploadFile = File(...),
    position: str = Form("bottom-center"),
    start_number: int = Form(1),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        numbered = pdf_service.add_page_numbers(content, position, start_number)
        out_name = f"numbered_{file.filename}"
        item = save_generated_bytes(db, numbered, out_name, "application/pdf", uid)
        return {"success": True, "download_key": item.file_key, "filename": out_name, "size": item.file_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Add Page Numbers failed: {str(e)}")

@router.post("/add-watermark")
async def api_add_watermark(
    file: UploadFile = File(...),
    text: str = Form("CONFIDENTIAL"),
    opacity: float = Form(0.3),
    rotation: int = Form(45),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        watermarked = pdf_service.add_watermark(content, text, opacity, rotation)
        out_name = f"watermarked_{file.filename}"
        item = save_generated_bytes(db, watermarked, out_name, "application/pdf", uid)
        return {"success": True, "download_key": item.file_key, "filename": out_name, "size": item.file_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Add Watermark failed: {str(e)}")

@router.post("/crop-pdf")
async def api_crop_pdf(
    file: UploadFile = File(...),
    crop_x: float = Form(10),
    crop_y: float = Form(10),
    crop_w: float = Form(80),
    crop_h: float = Form(80),
    crop_scope: str = Form("all"),
    current_page: int = Form(1),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        cropped = pdf_service.crop_pdf(content, crop_x, crop_y, crop_w, crop_h, crop_scope=crop_scope, current_page=current_page)
        out_name = f"cropped_{file.filename}"
        item = save_generated_bytes(db, cropped, out_name, "application/pdf", uid)
        return {"success": True, "download_key": item.file_key, "filename": out_name, "size": item.file_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Crop PDF failed: {str(e)}")

@router.post("/unlock-pdf")
async def api_unlock_pdf(
    file: UploadFile = File(...),
    password: str = Form(...),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        unlocked = pdf_service.unlock_pdf(content, password)
        out_name = f"unlocked_{file.filename}"
        item = save_generated_bytes(db, unlocked, out_name, "application/pdf", uid)
        return {"success": True, "download_key": item.file_key, "filename": out_name, "size": item.file_size}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unlock PDF failed: {str(e)}")

@router.post("/protect-pdf")
async def api_protect_pdf(
    file: UploadFile = File(...),
    password: str = Form(...),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        protected = pdf_service.protect_pdf(content, password)
        out_name = f"protected_{file.filename}"
        item = save_generated_bytes(db, protected, out_name, "application/pdf", uid)
        return {"success": True, "download_key": item.file_key, "filename": out_name, "size": item.file_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Protect PDF failed: {str(e)}")

@router.post("/sign-pdf")
async def api_sign_pdf(
    file: UploadFile = File(...),
    signature: UploadFile = File(...),
    page: int = Form(1),
    x: float = Form(10),
    y: float = Form(10),
    w: float = Form(20),
    h: float = Form(10),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    pdf_b = await file.read()
    sig_b = await signature.read()

    allowed, msg = check_user_quota(db, uid, (len(pdf_b) + len(sig_b)) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        signed = pdf_service.sign_pdf(pdf_b, sig_b, page, x, y, w, h)
        out_name = f"signed_{file.filename}"
        item = save_generated_bytes(db, signed, out_name, "application/pdf", uid)
        return {"success": True, "download_key": item.file_key, "filename": out_name, "size": item.file_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sign PDF failed: {str(e)}")

@router.post("/redact-pdf")
async def api_redact_pdf(
    file: UploadFile = File(...),
    search_text: str = Form(""),
    redact_rects_json: str = Form("[]"),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        rects = json.loads(redact_rects_json)
        redacted = pdf_service.redact_pdf(content, search_text, rects)
        out_name = f"redacted_{file.filename}"
        item = save_generated_bytes(db, redacted, out_name, "application/pdf", uid)
        return {"success": True, "download_key": item.file_key, "filename": out_name, "size": item.file_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Redact PDF failed: {str(e)}")

@router.post("/compare-pdf")
async def api_compare_pdf(
    file_a: UploadFile = File(...),
    file_b: UploadFile = File(...),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    b_a = await file_a.read()
    b_b = await file_b.read()

    allowed, msg = check_user_quota(db, uid, (len(b_a) + len(b_b)) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        result = pdf_service.compare_pdfs(b_a, b_b)
        return {"success": True, "comparison": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Compare PDF failed: {str(e)}")

# Voice & Indian Languages
@router.post("/voice-to-document")
async def api_voice_to_document(
    audio: Optional[UploadFile] = File(None),
    transcript_text: Optional[str] = Form(None),
    doc_type: str = Form("General Document"),
    output_format: str = Form("docx"),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    text = transcript_text or ""
    
    if not text.strip():
        raise HTTPException(status_code=400, detail="Please record or enter some text first.")

    try:
        clean_format = output_format.lower().replace(".", "").strip()
        doc_bytes, mime = voice_service.generate_voice_document(text, doc_type, clean_format)
        clean_title = doc_type.replace(" ", "_").replace("→", "to")
        out_name = f"DocFlow_{clean_title}_{datetime.now().strftime('%Y%m%d')}.{clean_format}"
        item = save_generated_bytes(db, doc_bytes, out_name, mime, uid)
        return {"success": True, "download_key": item.file_key, "filename": out_name, "size": item.file_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice document generation failed: {str(e)}")

@router.post("/compress-image")
async def api_compress_image(
    file: UploadFile = File(...),
    quality: int = Form(70),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        compressed_bytes, orig_sz, comp_sz = image_service.compress_image(content, quality)
        out_name = f"compressed_{file.filename}"
        item = save_generated_bytes(db, compressed_bytes, out_name, file.content_type or "image/jpeg", uid)
        saved_pct = round(max(0, (orig_sz - comp_sz) / orig_sz * 100), 1) if orig_sz > 0 else 0
        return {"success": True, "download_key": item.file_key, "filename": out_name, "size": comp_sz, "saved_pct": saved_pct}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image compression failed: {str(e)}")

@router.post("/resize-image")
async def api_resize_image(
    file: UploadFile = File(...),
    width: Optional[int] = Form(None),
    height: Optional[int] = Form(None),
    percentage: Optional[int] = Form(None),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        resized_bytes = image_service.resize_image(content, width, height, percentage)
        out_name = f"resized_{file.filename}"
        item = save_generated_bytes(db, resized_bytes, out_name, file.content_type or "image/png", uid)
        return {"success": True, "download_key": item.file_key, "filename": out_name, "size": len(resized_bytes)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image resize failed: {str(e)}")

@router.post("/crop-image")
async def api_crop_image(
    file: UploadFile = File(...),
    crop_x: float = Form(10),
    crop_y: float = Form(10),
    crop_w: float = Form(80),
    crop_h: float = Form(80),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        cropped_bytes = image_service.crop_image(content, crop_x, crop_y, crop_w, crop_h)
        out_name = f"cropped_{file.filename}"
        item = save_generated_bytes(db, cropped_bytes, out_name, file.content_type or "image/png", uid)
        return {"success": True, "download_key": item.file_key, "filename": out_name, "size": len(cropped_bytes)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Crop image failed: {str(e)}")

@router.post("/convert-image")
async def api_convert_image(
    file: UploadFile = File(...),
    target_format: str = Form("png"),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        converted_bytes, ext, mime = image_service.convert_image_format(content, target_format)
        base_name = os.path.splitext(file.filename)[0]
        out_name = f"{base_name}.{ext}"
        item = save_generated_bytes(db, converted_bytes, out_name, mime, uid)
        return {"success": True, "download_key": item.file_key, "filename": out_name, "size": len(converted_bytes)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image conversion failed: {str(e)}")

@router.post("/image-to-text")
async def api_image_to_text(
    file: UploadFile = File(...),
    language: str = Form("English"),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        extracted = ocr_service.ocr_image(content, language)
        out_name = f"{os.path.splitext(file.filename)[0]}_extracted_text.txt"
        item = save_generated_bytes(db, extracted.encode("utf-8"), out_name, "text/plain", uid)
        return {"success": True, "download_key": item.file_key, "filename": out_name, "size": len(extracted), "extracted_text": extracted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image to Text failed: {str(e)}")

@router.post("/indian-language-documents")
async def api_indian_language_documents(
    file: UploadFile = File(...),
    language: str = Form("Hindi"),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        searchable_pdf, extracted = ocr_service.ocr_pdf(content, language)
        out_name = f"ocr_{language}_{file.filename}"
        item = save_generated_bytes(db, searchable_pdf, out_name, "application/pdf", uid)
        return {"success": True, "download_key": item.file_key, "filename": out_name, "size": len(searchable_pdf), "extracted_text": extracted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Indian language OCR failed: {str(e)}")

@router.post("/edit-pdf")
async def api_edit_pdf(
    file: UploadFile = File(...),
    text_inserts_json: str = Form("[]"),
    annotations_json: str = Form("[]"),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        text_inserts = json.loads(text_inserts_json)
        annotations = json.loads(annotations_json)
        edited_bytes = pdf_service.edit_pdf(content, text_inserts, annotations)
        out_name = f"edited_{file.filename}"
        item = save_generated_bytes(db, edited_bytes, out_name, "application/pdf", uid)
        return {"success": True, "download_key": item.file_key, "filename": out_name, "size": len(edited_bytes)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Edit PDF failed: {str(e)}")

@router.post("/pdf-forms")
async def api_pdf_forms(
    file: UploadFile = File(...),
    form_data_json: str = Form("{}"),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        form_data = json.loads(form_data_json)
        filled_bytes, fields = pdf_service.fill_pdf_forms(content, form_data)
        out_name = f"completed_{file.filename}"
        item = save_generated_bytes(db, filled_bytes, out_name, "application/pdf", uid)
        return {"success": True, "download_key": item.file_key, "filename": out_name, "size": len(filled_bytes), "fields": fields}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF Forms handling failed: {str(e)}")

@router.post("/ai-pdf-summarizer")
async def api_ai_pdf_summarizer(
    file: UploadFile = File(...),
    max_sentences: int = Form(6),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        full_text = ai_service.extract_pdf_full_text(content)
        summary_res = ai_service.summarize_pdf_text(full_text, max_sentences)
        summary_pdf = ai_service.generate_summary_pdf(summary_res, file.filename or "document.pdf")
        out_name = f"summary_{os.path.splitext(file.filename)[0]}.pdf"
        item = save_generated_bytes(db, summary_pdf, out_name, "application/pdf", uid)
        return {
            "success": True,
            "download_key": item.file_key,
            "filename": out_name,
            "size": len(summary_pdf),
            "summary_data": summary_res
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF Summarization failed: {str(e)}")

@router.post("/translate-pdf")
async def api_translate_pdf(
    file: UploadFile = File(...),
    target_language: str = Form("Spanish"),
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    uid = get_uid_from_header(x_firebase_uid)
    content = await file.read()
    allowed, msg = check_user_quota(db, uid, len(content) / (1024*1024))
    if not allowed:
        raise HTTPException(status_code=403, detail=msg)

    try:
        trans_pdf_bytes, trans_text = translate_service.translate_pdf_document(content, target_language)
        out_name = f"translated_{target_language}_{file.filename}"
        item = save_generated_bytes(db, trans_pdf_bytes, out_name, "application/pdf", uid)
        return {
            "success": True,
            "download_key": item.file_key,
            "filename": out_name,
            "size": len(trans_pdf_bytes),
            "translated_text": trans_text
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF Translation failed: {str(e)}")

# Download Stream Endpoint
@router.get("/download/{file_key}")
def download_file(file_key: str, db: Session = Depends(get_db)):
    doc_item = get_file_by_key(db, file_key)
    if not doc_item or not os.path.exists(doc_item.stored_path):
        raise HTTPException(status_code=404, detail="Requested file not found or has expired.")

    # Increment conversion quota ONLY when the user actually downloads the file
    if doc_item.firebase_uid:
        already_counted = db.query(ConversionHistory).filter(ConversionHistory.download_key == file_key).first()
        if not already_counted:
            record_conversion_success(
                db=db,
                firebase_uid=doc_item.firebase_uid,
                filename=doc_item.original_name,
                tool="Document Download",
                orig_size=doc_item.file_size,
                result_size=doc_item.file_size,
                download_key=doc_item.file_key
            )

    return FileResponse(
        path=doc_item.stored_path,
        media_type=doc_item.mime_type,
        filename=doc_item.original_name
    )
