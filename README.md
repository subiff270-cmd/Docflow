# DocFlow — Enterprise Document Processing Engine

Production-grade PDF and Office document processing platform.

## System Dependencies & Environment Setup

### 1. Python Virtual Environment & Packages
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate  # Windows (or source venv/bin/activate on Linux)
pip install -r requirements.txt
```

Key Libraries:
- `pymupdf` (PyMuPDF 1.25+) — Fast vector PDF extraction & geometry engine
- `pdfplumber` — Advanced table line & stream analysis
- `openpyxl` — Real Excel (.xlsx) workbook generation with table styling
- `pandas` — Tabular data manipulation
- `reportlab` — PDF generation fallback
- `pillow` — Image processing
- `cloudmersive-convert-api-client` & `cloudmersive-ocr-api-client` — Enterprise OCR & Office processing

### 2. Office Rendering Engine (Required for Excel <-> PDF)
DocFlow uses Headless LibreOffice for vector spreadsheet rendering:
- **Windows**: Install [LibreOffice](https://www.libreoffice.org/download/download/). DocFlow automatically discovers `soffice.exe` / `soffice.com` in `C:\Program Files\LibreOffice\program\`.
- **Linux / Docker**:
  ```bash
  apt-get update && apt-get install -y libreoffice-calc libreoffice-impress tesseract-ocr
  ```

### 3. Verification & Health Check
Test all conversion engines and dependencies:
```bash
# Verify system dependencies
curl http://127.0.0.1:8000/api/system/health

# Run test suite
python test_excel_conversion.py
```
