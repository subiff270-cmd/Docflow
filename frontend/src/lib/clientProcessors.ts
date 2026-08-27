import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";

export interface ClientProcessResult {
  blob: Blob;
  filename: string;
  size: number;
  metadata?: any;
}

// 1. MERGE PDF (Client-side)
export async function clientMergePdf(files: File[]): Promise<ClientProcessResult> {
  const mergedPdf = await PDFDocument.create();
  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }
  const mergedBytes = await mergedPdf.save();
  const blob = new Blob([mergedBytes as BlobPart], { type: "application/pdf" });
  return {
    blob,
    filename: `merged_${files[0]?.name || "document.pdf"}`,
    size: blob.size,
  };
}

// 2. SPLIT PDF (Client-side)
export async function clientSplitPdf(file: File, rangesStr: string = "1"): Promise<ClientProcessResult> {
  const arrayBuffer = await file.arrayBuffer();
  const srcPdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = srcPdf.getPageCount();

  const newPdf = await PDFDocument.create();
  const pageNumbers: number[] = [];

  const parts = rangesStr.split(",").map((s) => s.trim());
  for (const part of parts) {
    if (part.includes("-")) {
      const [start, end] = part.split("-").map((n) => parseInt(n.trim(), 10));
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.max(1, start); i <= Math.min(totalPages, end); i++) {
          if (!pageNumbers.includes(i - 1)) pageNumbers.push(i - 1);
        }
      }
    } else {
      const n = parseInt(part, 10);
      if (!isNaN(n) && n >= 1 && n <= totalPages) {
        if (!pageNumbers.includes(n - 1)) pageNumbers.push(n - 1);
      }
    }
  }

  if (pageNumbers.length === 0) {
    pageNumbers.push(0);
  }

  const copiedPages = await newPdf.copyPages(srcPdf, pageNumbers);
  copiedPages.forEach((p) => newPdf.addPage(p));

  const splitBytes = await newPdf.save();
  const blob = new Blob([splitBytes as BlobPart], { type: "application/pdf" });
  return {
    blob,
    filename: `split_${file.name}`,
    size: blob.size,
  };
}

// 3. REMOVE PAGES (Client-side)
export async function clientRemovePages(file: File, pagesToRemoveStr: string): Promise<ClientProcessResult> {
  const arrayBuffer = await file.arrayBuffer();
  const srcPdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = srcPdf.getPageCount();

  const toRemoveIndices = new Set(
    pagesToRemoveStr
      .split(",")
      .map((s) => parseInt(s.trim(), 10) - 1)
      .filter((idx) => !isNaN(idx) && idx >= 0 && idx < totalPages)
  );

  const keepIndices = [];
  for (let i = 0; i < totalPages; i++) {
    if (!toRemoveIndices.has(i)) {
      keepIndices.push(i);
    }
  }

  const newPdf = await PDFDocument.create();
  if (keepIndices.length > 0) {
    const copiedPages = await newPdf.copyPages(srcPdf, keepIndices);
    copiedPages.forEach((p) => newPdf.addPage(p));
  } else {
    // If all deleted, keep page 0
    const copied = await newPdf.copyPages(srcPdf, [0]);
    newPdf.addPage(copied[0]);
  }

  const outBytes = await newPdf.save();
  const blob = new Blob([outBytes as BlobPart], { type: "application/pdf" });
  return {
    blob,
    filename: `removed_${file.name}`,
    size: blob.size,
  };
}

// 4. EXTRACT PAGES (Client-side)
export async function clientExtractPages(file: File, rangesStr: string): Promise<ClientProcessResult> {
  return clientSplitPdf(file, rangesStr);
}

// 5. ROTATE PDF (Client-side)
export async function clientRotatePdf(file: File, angleDeg: number = 90): Promise<ClientProcessResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const pages = pdf.getPages();

  pages.forEach((page) => {
    const currentAngle = page.getRotation().angle;
    page.setRotation(degrees((currentAngle + angleDeg) % 360));
  });

  const outBytes = await pdf.save();
  const blob = new Blob([outBytes as BlobPart], { type: "application/pdf" });
  return {
    blob,
    filename: `rotated_${file.name}`,
    size: blob.size,
  };
}

// 6. ADD PAGE NUMBERS (Client-side)
export async function clientAddPageNumbers(file: File, position: string = "bottom-center"): Promise<ClientProcessResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const totalPages = pdf.getPageCount();

  pdf.getPages().forEach((page, idx) => {
    const { width, height } = page.getSize();
    const text = `Page ${idx + 1} of ${totalPages}`;
    const textSize = 10;
    const textWidth = font.widthOfTextAtSize(text, textSize);

    let x = width / 2 - textWidth / 2;
    let y = 30;

    if (position === "bottom-right") {
      x = width - textWidth - 40;
      y = 30;
    } else if (position === "bottom-left") {
      x = 40;
      y = 30;
    } else if (position === "bottom-center") {
      x = width / 2 - textWidth / 2;
      y = 30;
    } else if (position === "top-right") {
      x = width - textWidth - 40;
      y = height - 35;
    } else if (position === "top-left") {
      x = 40;
      y = height - 35;
    } else if (position === "top-center") {
      x = width / 2 - textWidth / 2;
      y = height - 35;
    }

    page.drawText(text, {
      x,
      y,
      size: textSize,
      font,
      color: rgb(0.2, 0.2, 0.25),
    });
  });

  const outBytes = await pdf.save();
  const blob = new Blob([outBytes as BlobPart], { type: "application/pdf" });
  return {
    blob,
    filename: `numbered_${file.name}`,
    size: blob.size,
  };
}

// 7. ADD WATERMARK (Client-side)
export async function clientAddWatermark(
  file: File,
  text: string = "CONFIDENTIAL",
  position: "cross" | "center" = "cross"
): Promise<ClientProcessResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);

  pdf.getPages().forEach((page) => {
    const { width, height } = page.getSize();
    const maxWidth = width * 0.85;
    let textSize = Math.min(Math.min(width, height) / 10, 48);
    let textWidth = font.widthOfTextAtSize(text, textSize);
    if (textWidth > maxWidth && textWidth > 0) {
      textSize = (maxWidth / textWidth) * textSize;
      textWidth = font.widthOfTextAtSize(text, textSize);
    }
    const textHeight = font.heightAtSize(textSize);

    if (position === "center") {
      // Clean horizontal center
      const x = (width - textWidth) / 2;
      const y = (height - textHeight) / 2;
      page.drawText(text, {
        x,
        y,
        size: textSize,
        font,
        color: rgb(0.5, 0.5, 0.55),
        opacity: 0.35,
        rotate: degrees(0),
      });
    } else {
      // 45 degree diagonal cross centered on page
      const rad = (45 * Math.PI) / 180;
      const cx = width / 2;
      const cy = height / 2;
      const x = cx - (textWidth * Math.cos(rad) - textHeight * Math.sin(rad)) / 2;
      const y = cy - (textWidth * Math.sin(rad) + textHeight * Math.cos(rad)) / 2;

      page.drawText(text, {
        x,
        y,
        size: textSize,
        font,
        color: rgb(0.5, 0.5, 0.55),
        opacity: 0.35,
        rotate: degrees(45),
      });
    }
  });

  const outBytes = await pdf.save();
  const blob = new Blob([outBytes as BlobPart], { type: "application/pdf" });
  return {
    blob,
    filename: `watermarked_${file.name}`,
    size: blob.size,
  };
}

// 8. CROP PDF (Client-side)
export async function clientCropPdf(
  file: File,
  cropPct: { x: number; y: number; w: number; h: number },
  perPageCrops?: Record<number, { x: number; y: number; w: number; h: number }>
): Promise<ClientProcessResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const pages = pdf.getPages();

  pages.forEach((page, idx) => {
    // Check if there is an individual customized crop for this page, else use default cropPct
    const c = perPageCrops && perPageCrops[idx] ? perPageCrops[idx] : cropPct;
    const { width, height } = page.getSize();
    const x = Math.max(0, (c.x / 100) * width);
    const w = Math.max(10, Math.min(width - x, (c.w / 100) * width));
    const h = Math.max(10, Math.min(height, (c.h / 100) * height));
    const y = Math.max(0, height - ((c.y + c.h) / 100) * height);
    page.setCropBox(x, y, w, h);
  });

  const outBytes = await pdf.save();
  const blob = new Blob([outBytes as BlobPart], { type: "application/pdf" });
  return {
    blob,
    filename: `cropped_${file.name}`,
    size: blob.size,
  };
}

export interface PlacedSignField {
  id: string;
  type: "signature" | "initials" | "name" | "date" | "text" | "stamp";
  page: number; // 1-indexed
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
  w: number; // 0-100 percentage
  h: number; // 0-100 percentage
  content?: string;
  dataUrl?: string;
  color?: string;
  fontSize?: number;
}

// 8.1 SIGN PDF (Client-side)
export async function clientSignPdf(
  file: File,
  placedFields: PlacedSignField[],
  fallbackSigDataUrl?: string
): Promise<ClientProcessResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const pages = pdf.getPages();
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);

  const fields: PlacedSignField[] = placedFields.length > 0 ? placedFields : fallbackSigDataUrl ? [{
    id: "default-sig",
    type: "signature" as const,
    page: 1,
    x: 35,
    y: 75,
    w: 28,
    h: 12,
    dataUrl: fallbackSigDataUrl
  }] : [];

  for (const field of fields) {
    const pageIndex = Math.max(0, Math.min(pages.length - 1, (field.page || 1) - 1));
    const page = pages[pageIndex];
    const { width, height } = page.getSize();

    const x = (field.x / 100) * width;
    const w = (field.w / 100) * width;
    const h = (field.h / 100) * height;
    const y = Math.max(0, height - ((field.y + field.h) / 100) * height);

    if (field.dataUrl && (field.type === "signature" || field.type === "initials" || field.type === "stamp")) {
      try {
        const sigBytes = await fetch(field.dataUrl).then((res) => res.arrayBuffer());
        const sigImage = field.dataUrl.includes("image/jpeg") || field.dataUrl.includes("image/jpg")
          ? await pdf.embedJpg(sigBytes)
          : await pdf.embedPng(sigBytes);

        page.drawImage(sigImage, {
          x,
          y,
          width: w,
          height: h,
        });
      } catch (err) {
        console.warn("Failed to embed image signature field:", err);
      }
    } else {
      const textToDraw = field.content || (field.type === "date" ? new Date().toLocaleDateString("en-GB") : field.type === "name" ? "Signer Name" : "Sample Text");
      if (textToDraw) {
        const calculatedSize = Math.max(10, Math.min(36, (h * 0.45)));
        const fontSize = field.fontSize || calculatedSize;
        const hexColor = field.color || "#0f172a";
        let r = 0, g = 0, b = 0;
        try {
          if (hexColor.startsWith("#") && hexColor.length >= 7) {
            r = parseInt(hexColor.slice(1, 3), 16) / 255;
            g = parseInt(hexColor.slice(3, 5), 16) / 255;
            b = parseInt(hexColor.slice(5, 7), 16) / 255;
          }
        } catch {
          r = 0; g = 0; b = 0;
        }

        page.drawText(textToDraw, {
          x: x + 4,
          y: y + (h - fontSize) / 2,
          size: fontSize,
          font,
          color: rgb(r, g, b),
        });
      }
    }
  }

  const outBytes = await pdf.save();
  const blob = new Blob([outBytes as BlobPart], { type: "application/pdf" });
  return {
    blob,
    filename: `signed_${file.name}`,
    size: blob.size,
  };
}

export interface RedactBox {
  id: string;
  page: number; // 1-indexed
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
  w: number; // 0-100 percentage
  h: number; // 0-100 percentage
  label?: string;
}

// 8.2 REDACT PDF (Client-side)
export async function clientRedactPdf(
  file: File,
  boxes: RedactBox[],
  color: string = "#000000",
  wipeMetadata: boolean = true
): Promise<ClientProcessResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const pages = pdf.getPages();
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);

  let r = 0, g = 0, b = 0;
  try {
    if (color.startsWith("#") && color.length >= 7) {
      r = parseInt(color.slice(1, 3), 16) / 255;
      g = parseInt(color.slice(3, 5), 16) / 255;
      b = parseInt(color.slice(5, 7), 16) / 255;
    }
  } catch {
    r = 0; g = 0; b = 0;
  }

  for (const box of boxes) {
    const pageIndex = Math.max(0, Math.min(pages.length - 1, (box.page || 1) - 1));
    const page = pages[pageIndex];
    const { width, height } = page.getSize();

    const x = (box.x / 100) * width;
    const w = (box.w / 100) * width;
    const h = (box.h / 100) * height;
    const y = Math.max(0, height - ((box.y + box.h) / 100) * height);

    page.drawRectangle({
      x,
      y,
      width: w,
      height: h,
      color: rgb(r, g, b),
    });

    if (box.label) {
      const fontSize = Math.max(8, Math.min(14, h * 0.4));
      page.drawText(box.label, {
        x: x + 4,
        y: y + (h - fontSize) / 2,
        size: fontSize,
        font,
        color: rgb(1 - r, 1 - g, 1 - b),
      });
    }
  }

  if (wipeMetadata) {
    pdf.setTitle("");
    pdf.setAuthor("");
    pdf.setSubject("");
    pdf.setKeywords([]);
    pdf.setProducer("");
    pdf.setCreator("");
  }

  const outBytes = await pdf.save();
  const blob = new Blob([outBytes as BlobPart], { type: "application/pdf" });
  return {
    blob,
    filename: `redacted_${file.name}`,
    size: blob.size,
  };
}

// 9. JPG / IMAGE TO PDF (Client-side with Canvas Auto-Conversion)
export async function clientImageToPdf(files: File[]): Promise<ClientProcessResult> {
  const pdf = await PDFDocument.create();

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    let img: any = null;

    try {
      if (file.type.includes("png") || file.name.toLowerCase().endsWith(".png")) {
        img = await pdf.embedPng(arrayBuffer);
      } else {
        img = await pdf.embedJpg(arrayBuffer);
      }
    } catch {
      try {
        // Fallback: draw image on HTML5 Canvas to convert to clean JPEG bytes
        const imgBitmap = await createImageBitmap(file);
        const canvas = document.createElement("canvas");
        canvas.width = imgBitmap.width;
        canvas.height = imgBitmap.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(imgBitmap, 0, 0);
          const jpegBlob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.95));
          const jpegBuffer = await jpegBlob.arrayBuffer();
          img = await pdf.embedJpg(jpegBuffer);
        }
      } catch (err) {
        console.warn("Image canvas conversion error:", err);
      }
    }

    if (img) {
      const A4_W = 595.28;
      const A4_H = 841.89;
      const page = pdf.addPage([A4_W, A4_H]);

      const scale = Math.min(A4_W / img.width, A4_H / img.height);
      const fitW = img.width * scale;
      const fitH = img.height * scale;
      const x = (A4_W - fitW) / 2;
      const y = (A4_H - fitH) / 2;

      page.drawImage(img, {
        x,
        y,
        width: fitW,
        height: fitH,
      });
    }
  }

  const outBytes = await pdf.save();
  const blob = new Blob([outBytes as BlobPart], { type: "application/pdf" });
  return {
    blob,
    filename: `converted_images.pdf`,
    size: blob.size,
  };
}

// 10. RESIZE IMAGE (Client-side HTML5 Canvas)
export async function clientResizeImage(
  file: File,
  options: { width?: number; height?: number; percentage?: number }
): Promise<ClientProcessResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;
      let targetW = origW;
      let targetH = origH;

      if (options.percentage && options.percentage > 0) {
        targetW = Math.max(1, Math.round(origW * (options.percentage / 100)));
        targetH = Math.max(1, Math.round(origH * (options.percentage / 100)));
      } else if (options.width && options.height) {
        targetW = Math.max(1, Math.round(options.width));
        targetH = Math.max(1, Math.round(options.height));
      } else if (options.width) {
        targetW = Math.max(1, Math.round(options.width));
        targetH = Math.max(1, Math.round((options.width / origW) * origH));
      } else if (options.height) {
        targetH = Math.max(1, Math.round(options.height));
        targetW = Math.max(1, Math.round((options.height / origH) * origW));
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context unavailable"));

      // If JPEG, fill white background to avoid black artifacts on transparency
      const isJpeg = file.type === "image/jpeg" || file.name.toLowerCase().endsWith(".jpg") || file.name.toLowerCase().endsWith(".jpeg");
      if (isJpeg) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, targetW, targetH);
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, targetW, targetH);

      const mimeType = isJpeg ? "image/jpeg" : (file.type || "image/png");

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Failed to export resized image"));
          resolve({
            blob,
            filename: `resized_${file.name}`,
            size: blob.size,
            metadata: {
              originalWidth: origW,
              originalHeight: origH,
              newWidth: targetW,
              newHeight: targetH,
              percentage: options.percentage,
            }
          });
        },
        mimeType,
        0.95
      );
    };
    img.onerror = () => reject(new Error("Failed to load image for resizing"));
    img.src = url;
  });
}

// 11. CROP IMAGE (Client-side HTML5 Canvas)
export async function clientCropImage(
  file: File,
  cropPct: { x: number; y: number; w: number; h: number },
  shape: "rectangle" | "circle" | "lasso" = "rectangle",
  lassoPoints?: Array<{ x: number; y: number }>
): Promise<ClientProcessResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;

      const sx = Math.max(0, Math.min(origW - 1, (cropPct.x / 100) * origW));
      const sy = Math.max(0, Math.min(origH - 1, (cropPct.y / 100) * origH));
      const sw = Math.max(1, Math.min(origW - sx, (cropPct.w / 100) * origW));
      const sh = Math.max(1, Math.min(origH - sy, (cropPct.h / 100) * origH));

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(sw);
      canvas.height = Math.round(sh);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context unavailable"));

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      if (shape === "circle") {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(sw / 2, sh / 2, sw / 2, sh / 2, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        ctx.restore();
      } else if (shape === "lasso" && lassoPoints && lassoPoints.length > 2) {
        ctx.save();
        ctx.beginPath();
        lassoPoints.forEach((p, idx) => {
          const px = (p.x / 100) * origW - sx;
          const py = (p.y / 100) * origH - sy;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        ctx.restore();
      } else {
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      }

      // If circle or lasso, output as PNG to preserve transparency
      const isCutout = shape === "circle" || shape === "lasso";
      const outType = isCutout ? "image/png" : (file.type || "image/png");

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Failed to crop image"));
          const baseName = file.name.replace(/\.[^/.]+$/, "");
          const ext = isCutout ? ".png" : (file.name.includes(".") ? file.name.substring(file.name.lastIndexOf(".")) : ".png");
          resolve({
            blob,
            filename: `cropped_${baseName}${ext}`,
            size: blob.size,
            metadata: {
              originalWidth: origW,
              originalHeight: origH,
              croppedWidth: Math.round(sw),
              croppedHeight: Math.round(sh),
            }
          });
        },
        outType,
        0.95
      );
    };
    img.onerror = () => reject(new Error("Failed to load image for cropping"));
    img.src = url;
  });
}

// 12. CONVERT IMAGE FORMAT (Client-side HTML5 Canvas)
export async function clientConvertImage(file: File, targetFormat: string = "webp"): Promise<ClientProcessResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context unavailable"));

      const fmt = targetFormat.toLowerCase();
      let mime = "image/png";
      let ext = "png";

      if (fmt === "jpg" || fmt === "jpeg") {
        mime = "image/jpeg";
        ext = "jpg";
        // Fill white background for transparent images converted to JPG
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (fmt === "webp") {
        mime = "image/webp";
        ext = "webp";
      }

      ctx.drawImage(img, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Failed to convert image format"));
          const baseName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
          resolve({
            blob,
            filename: `${baseName}.${ext}`,
            size: blob.size,
          });
        },
        mime,
        0.92
      );
    };
    img.onerror = () => reject(new Error("Failed to load image for conversion"));
    img.src = url;
  });
}

// 13. ORGANIZE PDF (Client-side Page Reordering, Rotation, Insertion & Deletion)
export interface PageOrderConfig {
  id: string;
  sourceDocumentId: number;
  sourceFileName: string;
  originalPageNumber: number; // 1-based index
  currentPosition?: number;
  rotation: number; // 0, 90, 180, 270
  excluded?: boolean;
  deleted?: boolean;
  thumbnail?: string;
  // Backward compatibility alias keys
  original_page?: number;
  sourceFileIndex?: number;
  delete?: boolean;
}

export async function getPdfPageCount(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  return pdf.getPageCount();
}

export async function clientOrganizePdf(
  files: File[] | File,
  pageOrders: PageOrderConfig[]
): Promise<ClientProcessResult> {
  const fileList = Array.isArray(files) ? files : [files];
  const loadedPdfs: PDFDocument[] = [];
  for (const f of fileList) {
    const ab = await f.arrayBuffer();
    const p = await PDFDocument.load(ab, { ignoreEncryption: true });
    loadedPdfs.push(p);
  }

  const newPdf = await PDFDocument.create();

  for (const item of pageOrders) {
    const isExcluded = Boolean(item.excluded || item.deleted || item.delete);
    if (isExcluded) continue;

    const fileIdx = item.sourceDocumentId ?? item.sourceFileIndex ?? 0;
    const srcDoc = loadedPdfs[fileIdx] || loadedPdfs[0];
    if (!srcDoc) continue;

    const origPage = item.originalPageNumber ?? item.original_page ?? 1;
    const origIdx = origPage - 1;

    if (origIdx >= 0 && origIdx < srcDoc.getPageCount()) {
      const [copiedPage] = await newPdf.copyPages(srcDoc, [origIdx]);
      const rot = (item.rotation || 0) % 360;
      if (rot !== 0) {
        const currentAngle = copiedPage.getRotation().angle;
        copiedPage.setRotation(degrees((currentAngle + rot) % 360));
      }
      newPdf.addPage(copiedPage);
    }
  }

  if (newPdf.getPageCount() === 0) {
    throw new Error("Cannot save an empty PDF. Please keep at least one page included in your document.");
  }

  const outBytes = await newPdf.save();
  const blob = new Blob([outBytes as BlobPart], { type: "application/pdf" });
  return {
    blob,
    filename: `organized_${fileList[0]?.name || "document.pdf"}`,
    size: blob.size,
  };
}

