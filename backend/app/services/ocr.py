"""OCR service using PaddleOCR and PyMuPDF."""
import fitz  # PyMuPDF
from paddleocr import PaddleOCR
from typing import List, Dict, Optional
import numpy as np
import logging

logger = logging.getLogger(__name__)


_ocr_engine = None


def get_ocr_engine() -> PaddleOCR:
    """Get or create PaddleOCR engine (singleton)."""
    global _ocr_engine
    if _ocr_engine is None:
        _ocr_engine = PaddleOCR(
            use_angle_cls=True,
            lang="es",
            use_gpu=False,
            show_log=False,
            enable_mkldnn=True,
        )
    return _ocr_engine


def is_pdf_native(pdf_path: str, min_chars: int = 100) -> bool:
    """Check if PDF has native text layer."""
    try:
        doc = fitz.open(pdf_path)
        total_chars = 0
        for page in doc:
            total_chars += len(page.get_text("text"))
            if total_chars >= min_chars:
                doc.close()
                return True
        doc.close()
        return False
    except Exception:
        return False


async def extract_native_text(pdf_path: str) -> List[Dict]:
    """Extract text and bboxes from native PDF."""
    doc = fitz.open(pdf_path)
    pages_data = []

    for page_num, page in enumerate(doc, 1):
        words = page.get_text("words")  # (x0, y0, x1, y1, word, block, line, word_no)

        page_words = []
        text_parts = []

        for w in words:
            x0, y0, x1, y1, word, block, line, word_no = w
            if word.strip():
                page_words.append({
                    "text": word,
                    "bbox": [x0, y0, x1, y1],  # Already in PDF points (72 DPI)
                    "block": block,
                    "line": line,
                })
                text_parts.append(word)

        pages_data.append({
            "page_num": page_num,
            "text": " ".join(text_parts),
            "words": page_words,
            "source": "native",
            "image_width": int(page.rect.width),
            "image_height": int(page.rect.height),
        })

    doc.close()
    return pages_data


async def extract_ocr_text(pdf_path: str, dpi: int = 300) -> List[Dict]:
    """Extract text via OCR from scanned PDF."""
    ocr = get_ocr_engine()
    doc = fitz.open(pdf_path)
    pages_data = []

    for page_num, page in enumerate(doc, 1):
        # Render page to image
        pix = page.get_pixmap(dpi=dpi)
        img_bytes = pix.tobytes("png")

        # Run OCR
        result = ocr.ocr(img_bytes, cls=True)

        page_words = []
        text_parts = []

        if result and result[0]:
            for line in result[0]:
                bbox, (text, conf) = line
                if conf < 0.5:
                    continue

                # Convert PaddleOCR bbox (4 points) to rectangle
                xs = [p[0] for p in bbox]
                ys = [p[1] for p in bbox]
                x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)

                # Scale from image pixels (300 DPI) to PDF points (72 DPI)
                scale = 72 / dpi
                pdf_bbox = [x0 * scale, y0 * scale, x1 * scale, y1 * scale]

                page_words.append({
                    "text": text,
                    "bbox": pdf_bbox,
                    "confidence": conf,
                })
                text_parts.append(text)

        pages_data.append({
            "page_num": page_num,
            "text": " ".join(text_parts),
            "words": page_words,
            "source": "ocr",
            "image_width": pix.width,
            "image_height": pix.height,
        })

    doc.close()
    return pages_data


async def extract_text_with_bboxes(pdf_path: str) -> List[Dict]:
    """Main entry point - tries native extraction first, falls back to OCR."""
    # Check if PDF has native text
    if is_pdf_native(pdf_path):
        logger.info(f"Using native text extraction for {pdf_path}")
        return await extract_native_text(pdf_path)
    else:
        logger.info(f"Using OCR for {pdf_path}")
        return await extract_ocr_text(pdf_path)


async def extract_from_image(image_path: str) -> Dict:
    """Extract text from a single image file."""
    ocr = get_ocr_engine()
    result = ocr.ocr(image_path, cls=True)

    words = []
    text_parts = []

    if result and result[0]:
        for line in result[0]:
            bbox, (text, conf) = line
            if conf < 0.5:
                continue
            xs = [p[0] for p in bbox]
            ys = [p[1] for p in bbox]
            x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
            words.append({
                "text": text,
                "bbox": [x0, y0, x1, y1],
                "confidence": conf,
            })
            text_parts.append(text)

    return {
        "page_num": 1,
        "text": " ".join(text_parts),
        "words": words,
        "source": "ocr",
    }
