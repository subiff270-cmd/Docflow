import io
from PIL import Image

def compress_image(image_bytes: bytes, quality: int = 70) -> tuple[bytes, int, int]:
    orig_size = len(image_bytes)
    img = Image.open(io.BytesIO(image_bytes))
    
    # Format handling
    fmt = img.format or "JPEG"
    if fmt.upper() in ("JPEG", "JPG"):
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=quality, optimize=True)
    elif fmt.upper() == "PNG":
        out = io.BytesIO()
        img.save(out, format="PNG", optimize=True)
    elif fmt.upper() == "WEBP":
        out = io.BytesIO()
        img.save(out, format="WEBP", quality=quality, method=6)
    else:
        out = io.BytesIO()
        img.save(out, format=fmt, quality=quality)

    compressed_bytes = out.getvalue()
    return compressed_bytes, orig_size, len(compressed_bytes)

def resize_image(image_bytes: bytes, width: int = None, height: int = None, percentage: int = None) -> bytes:
    img = Image.open(io.BytesIO(image_bytes))
    orig_w, orig_h = img.size

    if percentage and percentage > 0:
        new_w = max(1, int(orig_w * (percentage / 100.0)))
        new_h = max(1, int(orig_h * (percentage / 100.0)))
    elif width and height:
        new_w = max(1, width)
        new_h = max(1, height)
    elif width:
        new_w = max(1, width)
        new_h = max(1, int(orig_h * (width / orig_w)))
    elif height:
        new_h = max(1, height)
        new_w = max(1, int(orig_w * (height / orig_h)))
    else:
        new_w, new_h = orig_w, orig_h

    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    out = io.BytesIO()
    fmt = img.format or "PNG"
    if fmt.upper() in ("JPEG", "JPG") and resized.mode in ("RGBA", "P"):
        resized = resized.convert("RGB")
    resized.save(out, format=fmt)
    return out.getvalue()

def convert_image_format(image_bytes: bytes, target_format: str = "png") -> tuple[bytes, str]:
    img = Image.open(io.BytesIO(image_bytes))
    target = target_format.upper().replace(".", "").strip()
    
    if target in ("JPG", "JPEG"):
        target_fmt = "JPEG"
        mime = "image/jpeg"
        ext = "jpg"
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
    elif target == "PNG":
        target_fmt = "PNG"
        mime = "image/png"
        ext = "png"
    elif target == "WEBP":
        target_fmt = "WEBP"
        mime = "image/webp"
        ext = "webp"
    elif target == "BMP":
        target_fmt = "BMP"
        mime = "image/bmp"
        ext = "bmp"
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
    elif target == "TIFF":
        target_fmt = "TIFF"
        mime = "image/tiff"
        ext = "tiff"
    else:
        target_fmt = "PNG"
        mime = "image/png"
        ext = "png"

    out = io.BytesIO()
    img.save(out, format=target_fmt)
    return out.getvalue(), ext, mime

def crop_image(image_bytes: bytes, crop_x: float, crop_y: float, crop_w: float, crop_h: float) -> bytes:
    """Crop image with coordinates provided either in normalized percentages (0-100) or pixels."""
    img = Image.open(io.BytesIO(image_bytes))
    width, height = img.size

    # If coordinates are percentages (<= 100)
    if crop_x <= 100 and crop_y <= 100 and crop_w <= 100 and crop_h <= 100:
        left = int((crop_x / 100.0) * width)
        top = int((crop_y / 100.0) * height)
        right = min(width, left + int((crop_w / 100.0) * width))
        bottom = min(height, top + int((crop_h / 100.0) * height))
    else:
        left = int(crop_x)
        top = int(crop_y)
        right = min(width, int(crop_x + crop_w))
        bottom = min(height, int(crop_y + crop_h))

    # Ensure valid box
    if right <= left or bottom <= top:
        left, top, right, bottom = 0, 0, width, height

    cropped = img.crop((left, top, right, bottom))
    out = io.BytesIO()
    fmt = img.format or "PNG"
    if fmt.upper() in ("JPEG", "JPG") and cropped.mode in ("RGBA", "P"):
        cropped = cropped.convert("RGB")
    cropped.save(out, format=fmt)
    return out.getvalue()

