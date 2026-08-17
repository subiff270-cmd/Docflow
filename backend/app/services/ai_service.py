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
