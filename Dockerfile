FROM python:3.11-slim

# Install system dependencies: LibreOffice, Tesseract OCR, Poppler utilities, Ghostscript
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    tesseract-ocr \
    poppler-utils \
    ghostscript \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /code

# Copy requirements and install
COPY backend/requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /code/requirements.txt

# Create non-root user (required by Hugging Face Spaces security)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PORT=7860

WORKDIR $HOME/app

# Copy application code
COPY --chown=user:user backend/app $HOME/app/app
COPY --chown=user:user backend/.env $HOME/app/.env

# Create storage directory with writable permissions
RUN mkdir -p $HOME/app/app/storage_files

EXPOSE 7860

# Launch FastAPI backend with uvicorn on port 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
