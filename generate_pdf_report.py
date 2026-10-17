#!/usr/bin/env python3
"""
SecureBiz Academic Project Report PDF Generator
Produces a university-compliant, publication-quality 35-45 page PDF document
using ReportLab with NumberedCanvas, professional styling, tables, and typography.
"""

import os
import sys
import re
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable, Preformatted
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_page_decorations(self, page_count):
        # Do not draw headers/footers on page 1 (Cover page)
        if self._pageNumber == 1:
            return

        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))

        # Running Header (pages > 1)
        self.drawString(54, 11 * inch - 36, "SECUREBIZ: Web Security Evaluation & Attack Surface Platform")
        self.drawRightString(8.5 * inch - 54, 11 * inch - 36, "Academic Project Report")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(54, 11 * inch - 40, 8.5 * inch - 54, 11 * inch - 40)

        # Running Footer (pages > 1)
        self.line(54, 45, 8.5 * inch - 54, 45)
        self.drawString(54, 32, "Department of Computer Science & Engineering | Confidential & Academic")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * inch - 54, 32, page_str)
        self.restoreState()

def build_pdf_report(input_md_path, output_pdf_path):
    print(f"[*] Reading source report: {input_md_path}")
    with open(input_md_path, "r", encoding="utf-8") as f:
        md_text = f.read()

    doc = SimpleDocTemplate(
        output_pdf_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Custom Color Palette
    PRIMARY = colors.HexColor("#0F172A")    # Deep Slate
    SECONDARY = colors.HexColor("#1D4ED8")  # Accent Blue
    TEXT_DARK = colors.HexColor("#1E293B")
    TEXT_MUTED = colors.HexColor("#475569")
    BG_LIGHT = colors.HexColor("#F8FAFC")
    BORDER_COLOR = colors.HexColor("#E2E8F0")

    # Typography Styles
    title_cover_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=30,
        textColor=PRIMARY,
        alignment=1, # Center
        spaceAfter=15
    )

    sub_cover_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=13,
        leading=18,
        textColor=SECONDARY,
        alignment=1,
        spaceAfter=25
    )

    meta_cover_style = ParagraphStyle(
        'CoverMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=15,
        textColor=TEXT_DARK,
        alignment=1
    )

    h1_style = ParagraphStyle(
        'ChapterHeading',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=PRIMARY,
        spaceBefore=22,
        spaceAfter=12,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=SECONDARY,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )

    h3_style = ParagraphStyle(
        'SubSectionHeading',
        parent=styles['Heading3'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=PRIMARY,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'ReportBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=TEXT_DARK,
        spaceAfter=7
    )

    body_bold = ParagraphStyle(
        'ReportBodyBold',
        parent=body_style,
        fontName='Helvetica-Bold'
    )

    code_style = ParagraphStyle(
        'CodeListing',
        parent=styles['Code'],
        fontName='Courier',
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#0F172A"),
        backColor=BG_LIGHT,
        borderColor=BORDER_COLOR,
        borderWidth=0.5,
        borderPadding=6,
        spaceAfter=10,
        spaceBefore=6
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white,
        alignment=0
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=TEXT_DARK,
        alignment=0
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=table_cell_style,
        fontName='Helvetica-Bold'
    )

    bullet_style = ParagraphStyle(
        'ReportBullet',
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4
    )

    callout_style = ParagraphStyle(
        'CalloutText',
        parent=body_style,
        fontSize=9,
        leading=13,
        textColor=PRIMARY,
        backColor=colors.HexColor("#EFF6FF"),
        borderColor=colors.HexColor("#BFDBFE"),
        borderWidth=1,
        borderPadding=8,
        spaceBefore=8,
        spaceAfter=10
    )

    story = []

    # Parse markdown blocks line-by-line / block-by-block
    lines = md_text.split('\n')
    i = 0
    total_lines = len(lines)

    in_code_block = False
    code_buffer = []

    is_cover = True

    while i < total_lines:
        line = lines[i]
        stripped = line.strip()

        # Handle Code Blocks
        if stripped.startswith("```"):
            if in_code_block:
                in_code_block = False
                code_content = "\n".join(code_buffer)
                story.append(Preformatted(code_content, code_style))
                story.append(Spacer(1, 4))
                code_buffer = []
            else:
                in_code_block = True
                code_buffer = []
            i += 1
            continue

        if in_code_block:
            code_buffer.append(line)
            i += 1
            continue

        # Handle Markdown Tables
        if "|" in line and stripped.startswith("|") and stripped.endswith("|"):
            table_lines = []
            while i < total_lines and "|" in lines[i] and lines[i].strip().startswith("|"):
                table_lines.append(lines[i].strip())
                i += 1

            if len(table_lines) >= 2:
                raw_rows = []
                for tl in table_lines:
                    # Skip separator line like |---|---|
                    if re.match(r'^\|[\s\-:|]+\|$', tl):
                        continue
                    cols = [c.strip() for c in tl.strip('|').split('|')]
                    raw_rows.append(cols)

                if raw_rows:
                    num_cols = max(len(r) for r in raw_rows)
                    # Standardize col counts
                    for r in raw_rows:
                        while len(r) < num_cols:
                            r.append("")

                    usable_width = 8.5 * inch - 108 # 504 pt
                    col_width = usable_width / num_cols

                    table_data = []
                    for row_idx, r in enumerate(raw_rows):
                        row_cells = []
                        for cell_text in r:
                            # Format bold or clean text
                            clean_text = cell_text.replace("<br>", "\n").replace("**", "")
                            if row_idx == 0:
                                p = Paragraph(clean_text, table_header_style)
                            else:
                                p = Paragraph(clean_text, table_cell_style)
                            row_cells.append(p)
                        table_data.append(row_cells)

                    t = Table(table_data, colWidths=[col_width] * num_cols)
                    t.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
                        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                        ('TOPPADDING', (0, 0), (-1, -1), 4),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                        ('LEFTPADDING', (0, 0), (-1, -1), 5),
                        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
                        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
                        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                    ]))
                    story.append(Spacer(1, 6))
                    story.append(t)
                    story.append(Spacer(1, 8))
            continue

        # Blank Lines
        if not stripped:
            i += 1
            continue

        # Horizontal Rule / Page Breaks for Key Sections
        if stripped in ["---", "***", "___"]:
            story.append(Spacer(1, 6))
            story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_COLOR, spaceBefore=4, spaceAfter=8))
            i += 1
            continue

        # Major Headings
        if stripped.startswith("# "):
            title_text = stripped[2:].strip()
            if "PROJECT SUBMISSION REPORT" in title_text or "SECUREBIZ" in title_text:
                # Cover Page Banner
                story.append(Spacer(1, 30))
                story.append(title_cover_style_obj := Paragraph(title_text, title_cover_style))
                story.append(Spacer(1, 10))
            else:
                story.append(Paragraph(title_text, h1_style))
            i += 1
            continue

        if stripped.startswith("## "):
            h2_text = stripped[3:].strip()
            # If major chapter or preliminary section, inject a clean PageBreak
            if any(h2_text.upper().startswith(sec) for sec in [
                "CHAPTER", "CERTIFICATE", "CANDIDATE DECLARATION", "ACKNOWLEDGEMENTS",
                "EXECUTIVE ABSTRACT", "TABLE OF CONTENTS", "LIST OF FIGURES", "LIST OF TABLES",
                "REFERENCES", "APPENDICES"
            ]):
                story.append(PageBreak())
                story.append(Spacer(1, 10))
                story.append(Paragraph(h2_text, h1_style))
                story.append(HRFlowable(width="100%", thickness=1.5, color=SECONDARY, spaceBefore=4, spaceAfter=12))
            else:
                story.append(Paragraph(h2_text, h2_style))
            i += 1
            continue

        if stripped.startswith("### "):
            h3_text = stripped[4:].strip()
            story.append(Paragraph(h3_text, h3_style))
            i += 1
            continue

        # Blockquotes or Callouts
        if stripped.startswith("> "):
            callout_text = stripped[2:].strip().replace("**", "<b>").replace("`", "")
            story.append(Paragraph(callout_text, callout_style))
            i += 1
            continue

        # Bullet Points
        if stripped.startswith("- ") or stripped.startswith("* "):
            bullet_text = stripped[2:].strip()
            # Convert basic markdown formatting to HTML tags for ReportLab
            bullet_html = format_inline_markdown(bullet_text)
            story.append(Paragraph(f"• &nbsp; {bullet_html}", bullet_style))
            i += 1
            continue

        # Numbered Lists
        if re.match(r'^\d+\.\s+', stripped):
            num_match = re.match(r'^(\d+\.)\s+(.*)', stripped)
            num_prefix = num_match.group(1)
            num_text = format_inline_markdown(num_match.group(2))
            story.append(Paragraph(f"<b>{num_prefix}</b> &nbsp; {num_text}", bullet_style))
            i += 1
            continue

        # Standard Paragraphs
        body_html = format_inline_markdown(stripped)
        story.append(Paragraph(body_html, body_style))
        i += 1

    print(f"[*] Building PDF document with NumberedCanvas...")
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"[✓] Successfully compiled publication-quality PDF to: {output_pdf_path}")

def format_inline_markdown(text):
    """Converts inline markdown like **bold**, *italic*, `code` to reportlab XML"""
    # Escape XML entities first
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # Re-allow safe tags after escaping
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'\*(.+?)\*', r'<i>\1</i>', text)
    text = re.sub(r'`(.+?)`', r'<font face="Courier" color="#1E293B"><b>\1</b></font>', text)
    # Restore br tags
    text = text.replace("&lt;br&gt;", "<br/>")
    return text

if __name__ == "__main__":
    src_file = sys.argv[1] if len(sys.argv) > 1 else "PROJECT_REPORT.md"
    dst_file = sys.argv[2] if len(sys.argv) > 2 else "PROJECT_REPORT.pdf"
    build_pdf_report(src_file, dst_file)
