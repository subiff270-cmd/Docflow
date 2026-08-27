import io
import os
import re
import fitz
from collections import Counter
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

def extract_pdf_full_text(pdf_bytes: bytes) -> str:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    lines = []
    for page in doc:
        t = page.get_text("text").strip()
        if t:
            lines.append(t)
    doc.close()
    return "\n\n".join(lines)

def summarize_pdf_text(text: str, max_sentences: int = 6) -> dict:
    """
    Extractive NLP & Statistical Keypoint Summarizer.
    Analyzes sentence frequencies, section headers, key metrics, and action items.
    """
    if not text.strip():
        return {
            "summary": "The document contains no readable text layer to summarize.",
            "key_takeaways": [],
            "metrics_found": [],
            "word_count": 0,
            "reading_time_minutes": 0
        }

    # Clean text
    clean_paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    words = re.findall(r'\b[A-Za-z]{3,}\b', text.lower())
    word_count = len(re.findall(r'\b\w+\b', text))
    reading_time = max(1, round(word_count / 200))

    # Stopwords filter
    stopwords = set([
        "the", "and", "for", "that", "this", "with", "from", "have", "are",
        "was", "were", "which", "will", "would", "about", "there", "their",
        "they", "been", "also", "into", "more", "other", "some", "such"
    ])
    meaningful_words = [w for w in words if w not in stopwords]
    word_freq = Counter(meaningful_words)

    # Score sentences
    sentences = re.split(r'(?<=[.!?])\s+', text)
    sentence_scores = []

    for s in sentences:
        s_clean = s.strip().replace("\n", " ")
        if len(s_clean) < 25 or len(s_clean) > 350:
            continue
        score = 0
        for w in re.findall(r'\b[A-Za-z]{3,}\b', s_clean.lower()):
            score += word_freq.get(w, 0)
        sentence_scores.append((score / (len(s_clean.split()) + 1), s_clean))

    sentence_scores.sort(key=lambda x: x[0], reverse=True)
    top_sentences = [s[1] for s in sentence_scores[:max_sentences]]

    # Extract metrics / numbers
    metrics = re.findall(r'(\b\d+(?:[\.,]\d+)?%|\$\d+(?:[\.,]\d+)?|₹\d+(?:[\.,]\d+)?|\b\d{4,}\b)', text)
    unique_metrics = list(dict.fromkeys(metrics))[:8]

    # Extract key takeaways
    takeaways = []
    for s in top_sentences[:4]:
        takeaways.append(s)

    summary_text = " ".join(top_sentences[:3]) if top_sentences else text[:300]

    return {
        "summary": summary_text,
        "key_takeaways": takeaways,
        "metrics_found": unique_metrics,
        "word_count": word_count,
        "reading_time_minutes": reading_time
    }

def generate_summary_pdf(summary_data: dict, original_filename: str = "document.pdf") -> bytes:
    """Generate a clean executive summary PDF document."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=54, leftMargin=54, topMargin=54, bottomMargin=54)
    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#1E1B4B'),
        spaceAfter=6
    )

    h2_style = ParagraphStyle(
        'H2Style',
        parent=styles['Heading2'],
        fontSize=13,
        leading=16,
        textColor=colors.HexColor('#4338CA'),
        spaceBefore=12,
        spaceAfter=6
    )

    body_style = ParagraphStyle(
        'BodyStyle',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#334155'),
        spaceAfter=8
    )

    story.append(Paragraph(f"AI Executive Summary: {original_filename}", title_style))
    story.append(Paragraph(f"Analysis Stats: {summary_data['word_count']} words | ~{summary_data['reading_time_minutes']} min reading time", body_style))
    story.append(Spacer(1, 10))

    story.append(Paragraph("Executive Overview", h2_style))
    story.append(Paragraph(summary_data["summary"], body_style))
    story.append(Spacer(1, 8))

    if summary_data.get("key_takeaways"):
        story.append(Paragraph("Key Findings & Takeaways", h2_style))
        for item in summary_data["key_takeaways"]:
            story.append(Paragraph(f"• {item}", body_style))
        story.append(Spacer(1, 8))

    if summary_data.get("metrics_found"):
        story.append(Paragraph("Key Figures & Statistical Metrics", h2_style))
        metrics_str = ", ".join(summary_data["metrics_found"])
        story.append(Paragraph(metrics_str, body_style))

    doc.build(story)
    return buffer.getvalue()

LANGUAGE_MAP = {
    "auto": "auto",
    "english": "en",
    "spanish": "es",
    "french": "fr",
    "german": "de",
    "hindi": "hi",
    "tamil": "ta",
    "telugu": "te",
    "kannada": "kn",
    "kanada": "kn",
    "kn": "kn",
    "malayalam": "ml",
    "bengali": "bn",
    "marathi": "mr",
    "gujarati": "gu",
    "punjabi": "pa",
    "urdu": "ur",
    "arabic": "ar",
    "chinese": "zh-CN",
    "chinese (simplified)": "zh-CN",
    "chinese (traditional)": "zh-TW",
    "japanese": "ja",
    "korean": "ko",
    "portuguese": "pt",
    "russian": "ru",
    "italian": "it",
    "dutch": "nl",
    "polish": "pl",
    "turkish": "tr",
    "vietnamese": "vi",
    "thai": "th",
    "indonesian": "id",
    "greek": "el",
    "hebrew": "he",
    "swedish": "sv",
    "norwegian": "no",
    "danish": "da",
    "finnish": "fi",
    "czech": "cs",
    "romanian": "ro",
    "hungarian": "hu",
    "ukrainian": "uk"
}

def resolve_lang_code(lang_str: str) -> str:
    if not lang_str:
        return "auto"
    cleaned = lang_str.strip().lower()
    if cleaned in LANGUAGE_MAP:
        return LANGUAGE_MAP[cleaned]
    if len(cleaned) == 2 or len(cleaned) == 5:
        return cleaned
    return "auto"

def translate_text_chunks(text: str, source_lang: str = "auto", target_lang: str = "es") -> str:
    """Translate text with automatic paragraph batching."""
    if not text.strip():
        return ""
    
    from deep_translator import GoogleTranslator
    src = resolve_lang_code(source_lang)
    tgt = resolve_lang_code(target_lang)
    if tgt == "auto":
        tgt = "en"
        
    translator = GoogleTranslator(source=src, target=tgt)
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    translated_paras = []
    
    for p in paragraphs:
        if len(p) <= 2500:
            try:
                res = translator.translate(p)
                translated_paras.append(res or p)
            except Exception:
                translated_paras.append(p)
        else:
            sentences = re.split(r'(?<=[.!?])\s+', p)
            curr_chunk = ""
            sub_trans = []
            for s in sentences:
                if len(curr_chunk) + len(s) + 1 > 2000:
                    try:
                        sub_trans.append(translator.translate(curr_chunk) or curr_chunk)
                    except Exception:
                        sub_trans.append(curr_chunk)
                    curr_chunk = s
                else:
                    curr_chunk = f"{curr_chunk} {s}".strip()
            if curr_chunk:
                try:
                    sub_trans.append(translator.translate(curr_chunk) or curr_chunk)
                except Exception:
                    sub_trans.append(curr_chunk)
            translated_paras.append(" ".join(sub_trans))
            
    return "\n\n".join(translated_paras)

def translate_pdf_document(
    pdf_bytes: bytes,
    target_language: str = "Spanish",
    source_language: str = "auto",
    output_format: str = "pdf",
    password: str = None
) -> dict:
    """
    Translates PDF content into the target language and exports to PDF, DOCX, or TXT.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    if doc.is_encrypted:
        if password:
            if not doc.authenticate(password):
                raise ValueError("Incorrect PDF password provided.")
        else:
            raise ValueError("Document is password protected. Please provide a password.")

    extracted_pages = []
    for i, page in enumerate(doc):
        t = page.get_text("text").strip()
        if t:
            extracted_pages.append(t)
    doc.close()

    # If document has no embedded text (e.g. scanned), perform OCR
    if not extracted_pages:
        try:
            from app.services.ocr_service import ocr_pdf
            ocr_lang = "English"
            if source_language and source_language.lower() != "auto":
                ocr_lang = source_language.capitalize()
            _, ocr_text, _, _ = ocr_pdf(pdf_bytes, language=ocr_lang, password=password)
            if ocr_text and isinstance(ocr_text, str) and ocr_text.strip():
                extracted_pages.append(ocr_text.strip())
        except Exception:
            pass

    full_original_text = "\n\n".join(extracted_pages)
    if not full_original_text.strip():
        raise ValueError("No readable text found in document to translate.")

    translated_text = translate_text_chunks(full_original_text, source_language, target_language)
    word_count = len(re.findall(r'\b\w+\b', translated_text))

    fmt = output_format.lower().strip()

    if fmt == "docx":
        import docx
        doc_obj = docx.Document()
        heading = doc_obj.add_heading(f"Translated Document ({target_language.capitalize()})", level=1)
        heading.paragraph_format.space_after = docx.shared.Pt(14)
        
        for para in translated_text.split("\n\n"):
            clean_p = para.strip()
            if clean_p:
                p = doc_obj.add_paragraph(clean_p)
                p.paragraph_format.space_after = docx.shared.Pt(8)
                p.paragraph_format.line_spacing = 1.15

        buf = io.BytesIO()
        doc_obj.save(buf)
        return {
            "bytes": buf.getvalue(),
            "ext": "docx",
            "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "original_text": full_original_text,
            "translated_text": translated_text,
            "word_count": word_count,
            "target_language": target_language
        }

    elif fmt == "txt":
        return {
            "bytes": translated_text.encode("utf-8"),
            "ext": "txt",
            "mime": "text/plain; charset=utf-8",
            "original_text": full_original_text,
            "translated_text": translated_text,
            "word_count": word_count,
            "target_language": target_language
        }

    else:
        # Default: Generate clean PDF
        buffer = io.BytesIO()
        pdf_doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=54, leftMargin=54, topMargin=54, bottomMargin=54)
        styles = getSampleStyleSheet()
        story = []

        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontSize=16,
            leading=20,
            textColor=colors.HexColor('#1E1B4B'),
            spaceAfter=12
        )

        body_style = ParagraphStyle(
            'BodyStyle',
            parent=styles['Normal'],
            fontSize=10,
            leading=15,
            textColor=colors.HexColor('#334155'),
            spaceAfter=10
        )

        meta_style = ParagraphStyle(
            'MetaStyle',
            parent=styles['Normal'],
            fontSize=9,
            leading=12,
            textColor=colors.HexColor('#64748B'),
            spaceAfter=16
        )

        story.append(Paragraph(f"DocFlow Translated Document ({target_language.capitalize()})", title_style))
        story.append(Paragraph(f"Source Language: {source_language.capitalize()} | Target Language: {target_language.capitalize()} | Words: {word_count}", meta_style))
        story.append(Spacer(1, 10))

        for para in translated_text.split("\n\n"):
            clean_p = para.strip().replace("\n", " ")
            if clean_p:
                # Escape XML/HTML tags for ReportLab Paragraph
                safe_p = clean_p.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                try:
                    story.append(Paragraph(safe_p, body_style))
                except Exception:
                    pass

        pdf_doc.build(story)
        return {
            "bytes": buffer.getvalue(),
            "ext": "pdf",
            "mime": "application/pdf",
            "original_text": full_original_text,
            "translated_text": translated_text,
            "word_count": word_count,
            "target_language": target_language
        }
