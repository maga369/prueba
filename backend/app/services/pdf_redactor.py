"""PDF redaction service using PyMuPDF."""
import fitz  # PyMuPDF
from typing import List, Dict, Optional
import os
import logging

logger = logging.getLogger(__name__)


def redact_pdf(
    input_path: str,
    output_path: str,
    entities: List[Dict],
    redaction_color: tuple = (0, 0, 0),  # Black
    fill_text: bool = False,
) -> None:
    """
    Apply redaction annotations to PDF and burn them in.

    Args:
        input_path: Path to source PDF
        output_path: Path for redacted PDF
        entities: List of entities with bbox [x0, y0, x1, y1] in PDF points
        redaction_color: RGB tuple for redaction box color
        fill_text: If True, also add text overlay (e.g., "[REDACTED]")
    """
    doc = fitz.open(input_path)

    # Group entities by page
    by_page = {}
    for entity in entities:
        page_num = entity.get("page", entity.get("page_num", 1)) - 1  # 0-indexed
        bbox = entity.get("bbox", [0, 0, 0, 0])

        if page_num not in by_page:
            by_page[page_num] = []
        by_page[page_num].append(bbox)

    # Apply redactions per page
    for page_num, bboxes in by_page.items():
        if page_num >= len(doc):
            logger.warning(f"Page {page_num + 1} not found in document")
            continue

        page = doc[page_num]

        for bbox in bboxes:
            if not bbox or len(bbox) != 4:
                continue

            x0, y0, x1, y1 = bbox

            # Skip invalid bboxes
            if x1 <= x0 or y1 <= y0:
                continue

            rect = fitz.Rect(x0, y0, x1, y1)

            # Add redaction annotation
            annot = page.add_redact_annot(
                rect,
                fill=redaction_color,
                cross_out=False,
                text="[REDACTED]" if fill_text else None,
                fontsize=8,
                align=fitz.TEXT_ALIGN_CENTER,
            )

        # Apply redactions - this burns the pixels
        page.apply_redactions(
            images=fitz.PDF_REDACT_IMAGE_PIXELS,
            graphics=fitz.PDF_REDACT_IMAGE_PIXELS,
        )

    # Save with optimization
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    doc.save(
        output_path,
        garbage=4,
        deflate=True,
        clean=True,
        linear=True,  # Fast web view
    )
    doc.close()
    logger.info(f"Redacted PDF saved to {output_path}")


def create_redacted_text_pdf(
    text: str,
    output_path: str,
    page_size: tuple = (595, 842),  # A4 in points
    font_size: int = 11,
    margins: tuple = (72, 72, 72, 72),  # 1 inch margins
) -> None:
    """Create a simple PDF with redacted text for export."""
    doc = fitz.open()
    page = doc.new_page(width=page_size[0], height=page_size[1])

    # Simple text insertion
    rect = fitz.Rect(margins[0], margins[1], page_size[0] - margins[2], page_size[1] - margins[3])
    page.insert_textbox(
        rect,
        text,
        fontsize=font_size,
        fontname="helv",
        align=fitz.TEXT_ALIGN_LEFT,
    )

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    doc.save(output_path)
    doc.close()


def verify_redaction(pdf_path: str, search_terms: List[str]) -> Dict[str, int]:
    """
    Verify that redaction worked by searching for terms.
    Returns count of matches for each term (should be 0).
    """
    doc = fitz.open(pdf_path)
    results = {term: 0 for term in search_terms}

    for page in doc:
        text = page.get_text("text")
        for term in search_terms:
            results[term] += text.lower().count(term.lower())

    doc.close()
    return results
