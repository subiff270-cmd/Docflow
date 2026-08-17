import io
import fitz
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
import html

LANG_MAP = {
    "Spanish": "es",
    "French": "fr",
    "German": "de",
    "Italian": "it",
    "Portuguese": "pt",
    "Russian": "ru",
    "Chinese": "zh-CN",
    "Japanese": "ja",
    "Arabic": "ar",
    "Hindi": "hi",
    "Tamil": "ta",
    "Telugu": "te",
    "Kannada": "kn",
    "Malayalam": "ml",
    "Bengali": "bn",
    "Marathi": "mr",
    "Gujarati": "gu",
    "Punjabi": "pa",
    "Urdu": "ur",
    "English": "en",
}

def translate_text(text: str, target_lang: str = "es") -> str:
    """Translate string into target language using GoogleTranslator with resilient chunking."""
    if not text.strip():
        return ""
    
    try:
        from deep_translator import GoogleTranslator
        translator = GoogleTranslator(source="auto", target=target_lang)
        # Deep translator handles up to 5000 chars per request
        if len(text) < 4500:
            return translator.translate(text)
        else:
            chunks = [text[i:i+4000] for i in range(0, len(text), 4000)]
            translated_chunks = [translator.translate(c) for c in chunks if c.strip()]
            return " ".join(translated_chunks)
    except Exception as e:
        print(f"[translate_text error]: {e}")
        return f"[{target_lang.upper()} Translation]: " + text

def translate_pdf_document(pdf_bytes: bytes, target_language: str = "Spanish") -> tuple[bytes, str]:
    """
    Extracts text from PDF, translates into target language,
    and returns both the translated PDF document bytes and translated text string.
    """
    lang_code = LANG_MAP.get(target_language, target_language.lower()[:2])
    
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    translated_pages_text = []

    buffer = io.BytesIO()
    pdf_doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=54, leftMargin=54, topMargin=54, bottomMargin=54)
    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle(
        'TransTitle',
        parent=styles['Heading1'],
        fontSize=16,
        leading=20,
        textColor=colors.HexColor('#1E1B4B'),
        spaceAfter=12
    )

    body_style = ParagraphStyle(
        'TransBody',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#1E293B'),
        spaceAfter=8
    )

    story.append(Paragraph(f"Translated Document ({target_language})", title_style))
    story.append(Spacer(1, 10))

    for page_idx, page in enumerate(doc):
        raw_text = page.get_text("text").strip()
        if raw_text:
            trans_page = translate_text(raw_text, lang_code)
            translated_pages_text.append(f"--- Page {page_idx+1} [{target_language}] ---\n" + trans_page)
            
            for para in trans_page.split("\n\n"):
                if para.strip():
                    safe_p = html.escape(para.strip())
                    story.append(Paragraph(safe_p, body_style))
                    story.append(Spacer(1, 6))
        story.append(Spacer(1, 14))

    doc.close()

    if not story or len(story) <= 2:
        story.append(Paragraph(f"No readable text extracted for translation into {target_language}.", body_style))

    pdf_doc.build(story)
    full_text = "\n\n".join(translated_pages_text)
    return buffer.getvalue(), full_text
