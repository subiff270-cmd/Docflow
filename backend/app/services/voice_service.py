import io
from docx import Document
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

def generate_voice_document(transcript_text: str, doc_type: str = "General Document", output_format: str = "docx") -> tuple[bytes, str]:
    title = f"{doc_type.upper()}"
    
    if output_format == "pdf":
        buffer = io.BytesIO()
        pdf_doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        story = [
            Paragraph(title, styles['Heading1']),
            Spacer(1, 12)
        ]
        for para in transcript_text.splitlines():
            if para.strip():
                story.append(Paragraph(para.strip(), styles['Normal']))
                story.append(Spacer(1, 8))
        pdf_doc.build(story)
        return buffer.getvalue(), "application/pdf"
    
    elif output_format == "txt":
        content = f"--- {title} ---\n\n{transcript_text}"
        return content.encode("utf-8"), "text/plain"
    
    else: # docx
        doc = Document()
        doc.add_heading(title, level=1)
        for para in transcript_text.splitlines():
            if para.strip():
                doc.add_paragraph(para.strip())
        buffer = io.BytesIO()
        doc.save(buffer)
        return buffer.getvalue(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
