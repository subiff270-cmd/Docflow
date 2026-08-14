import os
import datetime
from dotenv import load_dotenv
import resend

load_dotenv()

SUPPORT_EMAIL = os.getenv("SUPPORT_EMAIL", "support.docflow@gmail.com")

def send_contact_email(name: str, sender_email: str, subject: str, message: str) -> tuple[bool, str, str]:
    timestamp = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <div style="background: #4f46e5; color: white; padding: 20px; border-radius: 12px 12px 0 0;">
            <h2 style="margin: 0; font-size: 20px;">📩 New DocFlow Support Message</h2>
        </div>
        <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px; width: 100px;"><strong>Name:</strong></td><td style="padding: 8px 0; font-size: 14px;">{name}</td></tr>
                <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;"><strong>Email:</strong></td><td style="padding: 8px 0; font-size: 14px;"><a href="mailto:{sender_email}" style="color: #4f46e5;">{sender_email}</a></td></tr>
                <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;"><strong>Subject:</strong></td><td style="padding: 8px 0; font-size: 14px;">{subject}</td></tr>
                <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;"><strong>Received:</strong></td><td style="padding: 8px 0; font-size: 14px;">{timestamp}</td></tr>
            </table>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
            <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <p style="margin: 0 0 8px; font-size: 13px; color: #64748b;"><strong>Message:</strong></p>
                <p style="margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">{message}</p>
            </div>
            <p style="margin-top: 16px; font-size: 11px; color: #94a3b8;">This message was sent from the DocFlow website contact form.</p>
        </div>
    </div>
    """

    print(f"\n{'='*50}")
    print(f"[RESEND CONTACT FORM] From: {name} <{sender_email}>")
    print(f"[RESEND CONTACT FORM] Subject: {subject}")
    print(f"[RESEND CONTACT FORM] Message: {message}")
    print(f"{'='*50}\n")

    if not api_key:
        print("[RESEND EMAIL] RESEND_API_KEY is not configured in environment. Message recorded in database.")
        return True, "Your message has been received successfully! Our support team will get back to you shortly.", "db_saved_no_resend_key"

    try:
        resend.api_key = api_key
        params = {
            "from": "DocFlow Contact <onboarding@resend.dev>",
            "to": [SUPPORT_EMAIL],
            "reply_to": sender_email,
            "subject": f"[DocFlow Contact] {subject}",
            "html": html_content
        }
        r = resend.Emails.send(params)
        resend_id = r.get("id", "resend_sent") if isinstance(r, dict) else getattr(r, "id", "resend_sent")
        print(f"[RESEND EMAIL SUCCESS] Email sent via Resend API (ID: {resend_id})")
        return True, "Your message has been sent successfully! Our support team will get back to you shortly.", str(resend_id)
    except Exception as e:
        print(f"[RESEND EMAIL ERROR] Failed to send via Resend API: {e}")
        return True, "Your message has been received successfully! Our support team will get back to you shortly.", "resend_error_db_saved"
