#!/usr/bin/env python3
"""
SecureBiz Academic Project Report & Implementation Manual PDF Generator
Produces a university-compliant, publication-quality 40-45 page PDF document
using ReportLab with NumberedCanvas, boxed page frames, running headers/footers,
impeccable typography, structured front matter, and adaptive tables/code blocks.
"""

import os
import sys
import re
import io
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable, Preformatted, Flowable
)
from reportlab.pdfgen import canvas

# Page Geometry Constants (Letter: 612 x 792 pt)
PAGE_WIDTH = 612.0
PAGE_HEIGHT = 792.0

# Content Box Boundaries
BOX_LEFT = 36.0
BOX_RIGHT = 576.0      # width = 540 pt
BOX_BOTTOM = 36.0
BOX_TOP = 756.0        # height = 720 pt
BOX_WIDTH = BOX_RIGHT - BOX_LEFT
BOX_HEIGHT = BOX_TOP - BOX_BOTTOM

HEADER_DIVIDER_Y = 726.0  # 30 pt header compartment (726 -> 756)
FOOTER_DIVIDER_Y = 66.0   # 30 pt footer compartment (36 -> 66)

# Usable Document Margins (All content is strictly inside the box)
DOC_LEFT_MARGIN = 48.0    # 12 pt padding inside left box border
DOC_RIGHT_MARGIN = 48.0   # 12 pt padding inside right box border
DOC_TOP_MARGIN = 78.0     # 12 pt padding below header divider line (792 - 78 = 714)
DOC_BOTTOM_MARGIN = 78.0  # 12 pt padding above footer divider line (78 pt from bottom)
USABLE_CONTENT_WIDTH = PAGE_WIDTH - DOC_LEFT_MARGIN - DOC_RIGHT_MARGIN # 516.0 pt

# Color Palette
PRIMARY_NAVY = colors.HexColor("#0F172A")    # Deep Navy Slate
ACCENT_BLUE = colors.HexColor("#1D4ED8")     # Royal Blue
SLATE_DARK = colors.HexColor("#1E293B")      # Main Body Dark Text
SLATE_MUTED = colors.HexColor("#475569")     # Secondary / Footer Text
BORDER_LINE = colors.HexColor("#334155")     # Outer Box Border
BORDER_LIGHT = colors.HexColor("#CBD5E1")    # Inner Grid / Divider
BG_TINT = colors.HexColor("#F8FAFC")         # Slate 50 Background Tint
CALLOUT_BG = colors.HexColor("#EFF6FF")      # Light Blue Tint
CALLOUT_BORDER = colors.HexColor("#3B82F6")  # Accent Blue Border


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to calculate total page count and draw
    university-compliant boxed frames, running headers, and running footers
    on every single page.
    """
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
        self.saveState()

        # =====================================================================
        # PAGE 1: COVER PAGE FORMAL UNIVERSITY BORDER FRAME
        # =====================================================================
        if self._pageNumber == 1:
            # Outer Heavy Border
            self.setStrokeColor(PRIMARY_NAVY)
            self.setLineWidth(1.6)
            self.rect(BOX_LEFT, BOX_BOTTOM, BOX_WIDTH, BOX_HEIGHT, stroke=1, fill=0)

            # Inner Pinstripe
            self.setStrokeColor(ACCENT_BLUE)
            self.setLineWidth(0.6)
            self.rect(BOX_LEFT + 4.0, BOX_BOTTOM + 4.0, BOX_WIDTH - 8.0, BOX_HEIGHT - 8.0, stroke=1, fill=0)

            # Corner Accent Blocks
            self.setFillColor(ACCENT_BLUE)
            c_size = 5.0
            self.rect(BOX_LEFT + 2.5, BOX_BOTTOM + 2.5, c_size, c_size, stroke=0, fill=1)
            self.rect(BOX_RIGHT - 2.5 - c_size, BOX_BOTTOM + 2.5, c_size, c_size, stroke=0, fill=1)
            self.rect(BOX_LEFT + 2.5, BOX_TOP - 2.5 - c_size, c_size, c_size, stroke=0, fill=1)
            self.rect(BOX_RIGHT - 2.5 - c_size, BOX_TOP - 2.5 - c_size, c_size, c_size, stroke=0, fill=1)

            self.restoreState()
            return

        # =====================================================================
        # PAGES 2+: ACADEMIC BOX WITH INTEGRATED HEADER & FOOTER COMPARTMENTS
        # =====================================================================
        # 1. Outer Box Perimeter
        self.setStrokeColor(BORDER_LINE)
        self.setLineWidth(1.0)
        self.rect(BOX_LEFT, BOX_BOTTOM, BOX_WIDTH, BOX_HEIGHT, stroke=1, fill=0)

        # 2. Inner Subtle Border Pinstripe
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.4)
        self.rect(BOX_LEFT + 2.5, BOX_BOTTOM + 2.5, BOX_WIDTH - 5.0, BOX_HEIGHT - 5.0, stroke=1, fill=0)

        # 3. Header Compartment (Top Box Band: y = 726 -> 756)
        self.setFillColor(BG_TINT)
        self.rect(BOX_LEFT, HEADER_DIVIDER_Y, BOX_WIDTH, BOX_TOP - HEADER_DIVIDER_Y, stroke=0, fill=1)

        # Header Dividing Line
        self.setStrokeColor(BORDER_LINE)
        self.setLineWidth(0.75)
        self.line(BOX_LEFT, HEADER_DIVIDER_Y, BOX_RIGHT, HEADER_DIVIDER_Y)

        # Accent Color Tab below Header Dividing Line
        self.setStrokeColor(ACCENT_BLUE)
        self.setLineWidth(1.5)
        self.line(BOX_LEFT, HEADER_DIVIDER_Y - 0.5, BOX_LEFT + 120.0, HEADER_DIVIDER_Y - 0.5)

        # Running Header Text
        self.setFont("Helvetica-Bold", 7.8)
        self.setFillColor(PRIMARY_NAVY)
        self.drawString(BOX_LEFT + 10.0, HEADER_DIVIDER_Y + 10.5, "SECUREBIZ: Web Security & Attack Surface Platform")

        self.setFont("Helvetica-Bold", 7.8)
        self.setFillColor(ACCENT_BLUE)
        self.drawRightString(BOX_RIGHT - 10.0, HEADER_DIVIDER_Y + 10.5, "Academic Project Manual")

        # 4. Footer Compartment (Bottom Box Band: y = 36 -> 66)
        self.setFillColor(BG_TINT)
        self.rect(BOX_LEFT, BOX_BOTTOM, BOX_WIDTH, FOOTER_DIVIDER_Y - BOX_BOTTOM, stroke=0, fill=1)

        # Footer Dividing Line
        self.setStrokeColor(BORDER_LINE)
        self.setLineWidth(0.75)
        self.line(BOX_LEFT, FOOTER_DIVIDER_Y, BOX_RIGHT, FOOTER_DIVIDER_Y)

        # Running Footer Text
        self.setFont("Helvetica", 7.5)
        self.setFillColor(SLATE_MUTED)
        self.drawString(BOX_LEFT + 10.0, BOX_BOTTOM + 11.0, "Department of Computer Science & Engineering | Academic Project Manual")

        self.setFont("Helvetica-Bold", 8.0)
        self.setFillColor(PRIMARY_NAVY)
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(BOX_RIGHT - 10.0, BOX_BOTTOM + 11.0, page_str)

        self.restoreState()


class TrackPageFlowable(Flowable):
    """Zero-size flowable that records its current page number into a registry."""
    def __init__(self, key, registry):
        super().__init__()
        self.key = key
        self.registry = registry

    def wrap(self, availWidth, availHeight):
        return 0, 0

    def draw(self):
        self.registry[self.key] = self.canv._pageNumber


def add_page_break(story):
    """Appends a PageBreak only if the last element in story is not already a PageBreak."""
    if story and isinstance(story[-1], PageBreak):
        return
    story.append(PageBreak())


def normalize_anchor(text):
    """Converts a heading string to a clean alphanumeric anchor key."""
    clean = re.sub(r'[*_`#]', '', text)
    return re.sub(r'[^a-zA-Z0-9]', '', clean.lower())[:35]


def clean_math_syntax(text):
    """Translates LaTeX math notation into clean, professional Unicode/HTML symbols."""
    text = text.replace(r"\ge", "&ge;").replace(r"\le", "&le;")
    text = text.replace(r"\times", "&times;").replace(r"\sum", "&Sigma;")
    text = text.replace(r"\mathcal{D}", "<i>D</i>")
    text = text.replace(r"A^+", "A<sup>+</sup>")
    text = text.replace(r"w_i", "<i>w<sub>i</sub></i>")
    text = text.replace(r"w_{cat}", "<i>w<sub>cat</sub></i>")
    text = text.replace(r"D_{\text{Lev}}", "<i>D</i><sub>Lev</sub>")
    text = text.replace(r"s_1", "<i>s</i><sub>1</sub>").replace(r"s_2", "<i>s</i><sub>2</sub>")
    text = re.sub(r'\\text\{(.+?)\}', r'\1', text)
    text = text.replace(r"\%", "%")
    text = text.replace("$", "")
    return text


def format_inline_markdown(text):
    """Converts inline markdown like **bold**, *italic*, `code` to reportlab XML safely."""
    # Escape XML entities first
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # Clean LaTeX math syntax
    text = clean_math_syntax(text)
    # Restore allowed safe tags
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'\*(.+?)\*', r'<i>\1</i>', text)
    text = re.sub(r'`(.+?)`', r'<font face="Courier" color="#0F172A"><b>\1</b></font>', text)
    text = text.replace("&lt;br&gt;", "<br/>").replace("&lt;br/&gt;", "<br/>")
    return text


def build_story(md_text, page_map, page_registry):
    styles = getSampleStyleSheet()

    # -------------------------------------------------------------------------
    # Professional Typography Styles
    # -------------------------------------------------------------------------
    h1_style = ParagraphStyle(
        'AcademicChapterHeading',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=15.0,
        leading=19.0,
        textColor=PRIMARY_NAVY,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'AcademicSectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11.5,
        leading=15.5,
        textColor=ACCENT_BLUE,
        spaceBefore=12,
        spaceAfter=5,
        keepWithNext=True
    )

    h3_style = ParagraphStyle(
        'AcademicSubSectionHeading',
        parent=styles['Heading3'],
        fontName='Helvetica-Bold',
        fontSize=10.0,
        leading=13.5,
        textColor=PRIMARY_NAVY,
        spaceBefore=9,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'AcademicBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.2,
        leading=14.0,
        textColor=SLATE_DARK,
        alignment=4,  # Justified text for authentic printed textbook appearance
        spaceAfter=6.5
    )

    bullet_style = ParagraphStyle(
        'AcademicBullet',
        parent=body_style,
        leftIndent=14,
        firstLineIndent=-10,
        spaceAfter=3.5,
        alignment=0
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.0,
        leading=11.0,
        textColor=colors.white,
        alignment=0
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.8,
        leading=10.8,
        textColor=SLATE_DARK,
        alignment=0
    )

    callout_style = ParagraphStyle(
        'CalloutText',
        parent=body_style,
        fontSize=8.8,
        leading=13.0,
        textColor=PRIMARY_NAVY,
        backColor=CALLOUT_BG,
        borderColor=CALLOUT_BORDER,
        borderWidth=1.0,
        borderPadding=7,
        spaceBefore=6,
        spaceAfter=8,
        alignment=0
    )

    toc_title_style = ParagraphStyle(
        'TOCTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=12.0,
        textColor=PRIMARY_NAVY
    )

    toc_sub_style = ParagraphStyle(
        'TOCSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.0,
        leading=11.5,
        textColor=SLATE_DARK,
        leftIndent=12
    )

    toc_page_style = ParagraphStyle(
        'TOCPage',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.0,
        leading=11.5,
        textColor=ACCENT_BLUE,
        alignment=2
    )

    story = []

    # =========================================================================
    # 1. COVER PAGE GENERATION (PAGE 1)
    # =========================================================================
    story.append(TrackPageFlowable('cover', page_registry))
    story.append(Spacer(1, 10))
    story.append(Paragraph(
        '<font size="11" color="#1E293B"><b>DEPARTMENT OF COMPUTER SCIENCE &amp; ENGINEERING</b></font>',
        ParagraphStyle('CoverUni', alignment=1, spaceAfter=4)
    ))
    story.append(Paragraph(
        '<font size="8.5" color="#1D4ED8"><b>ACADEMIC PROJECT REPORT &amp; IMPLEMENTATION MANUAL</b></font>',
        ParagraphStyle('CoverSubBanner', alignment=1, spaceAfter=14)
    ))
    story.append(HRFlowable(width="90%", thickness=1.0, color=BORDER_LIGHT, spaceBefore=0, spaceAfter=20))

    # Badge Table
    badge_table = Table([[
        Paragraph(
            '<font size="8" color="#1D4ED8"><b>MAJOR PROJECT SUBMISSION &bull; B.TECH FINAL YEAR</b></font>',
            ParagraphStyle('BadgeP', alignment=1)
        )
    ]], colWidths=[280])
    badge_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), CALLOUT_BG),
        ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor("#93C5FD")),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ]))
    story.append(KeepTogether([badge_table]))
    story.append(Spacer(1, 16))

    # Project Title
    story.append(Paragraph(
        '<b>SECUREBIZ</b>',
        ParagraphStyle('CoverTitleBig', fontName='Helvetica-Bold', fontSize=24, leading=28, textColor=PRIMARY_NAVY, alignment=1, spaceAfter=8)
    ))
    story.append(Paragraph(
        '<b>AN AUTOMATED PASSIVE &amp; ACTIVE WEB SECURITY EVALUATION<br/>AND ATTACK SURFACE MANAGEMENT PLATFORM</b>',
        ParagraphStyle('CoverSubtitleBig', fontName='Helvetica-Bold', fontSize=10.5, leading=15, textColor=ACCENT_BLUE, alignment=1, spaceAfter=20)
    ))

    # Degree Award Statement
    story.append(Paragraph(
        '<font color="#475569" size="8.5">A Comprehensive Project Report &amp; Engineering Manual submitted in partial fulfillment<br/>of the requirements for the award of the degree of</font>',
        ParagraphStyle('DegreeIntro', alignment=1, leading=13, spaceAfter=6)
    ))
    story.append(Paragraph(
        '<font size="11" color="#0F172A"><b>BACHELOR OF TECHNOLOGY</b></font><br/>'
        '<font size="9.5" color="#1E293B">IN COMPUTER SCIENCE &amp; ENGINEERING</font>',
        ParagraphStyle('DegreeName', fontName='Helvetica', alignment=1, leading=15, spaceAfter=26)
    ))

    # Submission Information Cards (2-Column Boxed Table)
    student_card = Paragraph(
        '<font size="8" color="#64748B"><b>SUBMITTED BY:</b></font><br/><br/>'
        '<font size="9.5" color="#0F172A"><b>Dhruvrajsinh Parmar</b></font><br/>'
        '<font size="8" color="#334155">Department of Computer Science &amp; Engineering<br/>'
        'Academic Session: 2026–2027</font>',
        ParagraphStyle('CardLeft', leading=13)
    )

    supervisor_card = Paragraph(
        '<font size="8" color="#64748B"><b>UNDER THE GUIDANCE OF:</b></font><br/><br/>'
        '<font size="9.5" color="#0F172A"><b>Project Supervisor / Faculty Guide</b></font><br/>'
        '<font size="8" color="#334155">Department of Computer Science &amp; Engineering<br/>'
        'University Faculty of Technology</font>',
        ParagraphStyle('CardRight', leading=13)
    )

    info_table = Table([[student_card, supervisor_card]], colWidths=[250, 250])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BG_TINT),
        ('BOX', (0, 0), (0, 0), 0.75, BORDER_LIGHT),
        ('BOX', (1, 0), (1, 0), 0.75, BORDER_LIGHT),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 30))

    # Bottom Seal
    story.append(Paragraph(
        '<font size="8.5" color="#475569"><b>FACULTY OF TECHNOLOGY &bull; COMPUTER SCIENCE &amp; ENGINEERING</b><br/>'
        'ACADEMIC YEAR: 2026–2027</font>',
        ParagraphStyle('CoverBottom', alignment=1, leading=13)
    ))

    # Page Break to Front Matter
    add_page_break(story)

    # =========================================================================
    # PARSE DOCUMENT BODY
    # =========================================================================
    lines = md_text.split('\n')
    total_lines = len(lines)
    i = 0

    # Skip original cover lines in markdown until CERTIFICATE
    while i < total_lines:
        if lines[i].strip().startswith("## CERTIFICATE OF ORIGINALITY"):
            break
        i += 1

    in_code_block = False
    code_buffer = []

    while i < total_lines:
        line = lines[i]
        stripped = line.strip()

        # Handle Code Blocks
        if stripped.startswith("```"):
            if in_code_block:
                in_code_block = False
                code_text = "\n".join(code_buffer)
                code_lines = code_text.split('\n')

                max_code_line = max(len(l) for l in code_lines) if code_lines else 0
                if max_code_line > 85:
                    c_size = 5.8
                    c_lead = 7.6
                elif max_code_line > 72:
                    c_size = 6.4
                    c_lead = 8.4
                else:
                    c_size = 7.2
                    c_lead = 9.4

                adaptive_code_style = ParagraphStyle(
                    'AdaptiveCode',
                    parent=styles['Code'],
                    fontName='Courier',
                    fontSize=c_size,
                    leading=c_lead,
                    textColor=PRIMARY_NAVY,
                    backColor=BG_TINT,
                    borderColor=BORDER_LIGHT,
                    borderWidth=0.5,
                    borderPadding=6,
                    spaceBefore=5,
                    spaceAfter=8
                )

                if len(code_lines) > 35:
                    chunk_size = 28
                    for start_idx in range(0, len(code_lines), chunk_size):
                        sub_chunk = "\n".join(code_lines[start_idx:start_idx + chunk_size])
                        story.append(Preformatted(sub_chunk, adaptive_code_style))
                else:
                    story.append(Preformatted(code_text, adaptive_code_style))

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

        # Handle LaTeX Mathematical Blocks ($$ ... $$)
        if stripped.startswith("$$"):
            math_lines = []
            # Check if inline on same line
            if stripped.endswith("$$") and len(stripped) > 4:
                math_lines.append(stripped[2:-2].strip())
                i += 1
            else:
                i += 1
                while i < total_lines and not lines[i].strip().endswith("$$"):
                    math_lines.append(lines[i].strip())
                    i += 1
                if i < total_lines:
                    closing_line = lines[i].strip()
                    if closing_line != "$$":
                        math_lines.append(closing_line.replace("$$", "").strip())
                    i += 1

            full_math = " ".join(math_lines)
            # If it's the grading piecewise formula:
            if "Grade" in full_math or "cases" in full_math:
                grade_box = Table([
                    [Paragraph("<b>Mathematical Posture Scoring Function &bull; Piecewise Grade Formulation:</b>", ParagraphStyle('FTitle', fontName='Helvetica-Bold', fontSize=8.5, leading=12, textColor=PRIMARY_NAVY))],
                    [Paragraph(
                        "&bull; <b>Grade A<sup>+</sup></b> &nbsp;&nbsp;: &nbsp; if 95 &le; <i>S</i>(<i>D</i>) &le; 100 &nbsp; (Exceptional Hardening)<br/>"
                        "&bull; <b>Grade A</b> &nbsp;&nbsp;&nbsp;: &nbsp; if 85 &le; <i>S</i>(<i>D</i>) &lt; 95 &nbsp; (Strong Perimeter Defenses)<br/>"
                        "&bull; <b>Grade B</b> &nbsp;&nbsp;&nbsp;: &nbsp; if 75 &le; <i>S</i>(<i>D</i>) &lt; 85 &nbsp; (Minor Configuration Gaps)<br/>"
                        "&bull; <b>Grade C</b> &nbsp;&nbsp;&nbsp;: &nbsp; if 65 &le; <i>S</i>(<i>D</i>) &lt; 75 &nbsp; (Moderate Vulnerability Surface)<br/>"
                        "&bull; <b>Grade D</b> &nbsp;&nbsp;&nbsp;: &nbsp; if 50 &le; <i>S</i>(<i>D</i>) &lt; 65 &nbsp; (High Perimetric Risk Posture)<br/>"
                        "&bull; <b>Grade F</b> &nbsp;&nbsp;&nbsp;: &nbsp; if <i>S</i>(<i>D</i>) &lt; 50 &nbsp; (Critical Active Attack Vector)",
                        ParagraphStyle('FBody', fontName='Helvetica', fontSize=8.2, leading=12.5, textColor=SLATE_DARK)
                    )]
                ], colWidths=[USABLE_CONTENT_WIDTH])
                grade_box.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), CALLOUT_BG),
                    ('BOX', (0, 0), (-1, -1), 1.0, CALLOUT_BORDER),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                    ('LEFTPADDING', (0, 0), (-1, -1), 10),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 10),
                ]))
                story.append(KeepTogether([grade_box]))
                story.append(Spacer(1, 6))
            elif "Lev" in full_math or "tail" in full_math:
                lev_box = Table([
                    [Paragraph("<b>Mathematical Formulation &bull; Dynamic Levenshtein Edit Distance Matrix:</b>", ParagraphStyle('FTitle', fontName='Helvetica-Bold', fontSize=8.5, leading=12, textColor=PRIMARY_NAVY))],
                    [Paragraph(
                        "<i>D</i><sub>Lev</sub>(<i>s</i><sub>1</sub>, <i>s</i><sub>2</sub>) = "
                        "&bull; |<i>s</i><sub>1</sub>| if |<i>s</i><sub>2</sub>| = 0; &nbsp; "
                        "&bull; |<i>s</i><sub>2</sub>| if |<i>s</i><sub>1</sub>| = 0;<br/>"
                        "&bull; <i>D</i><sub>Lev</sub>(tail(<i>s</i><sub>1</sub>), tail(<i>s</i><sub>2</sub>)) if <i>s</i><sub>1</sub>[0] = <i>s</i><sub>2</sub>[0];<br/>"
                        "&bull; 1 + min{ <i>D</i><sub>Lev</sub>(tail(<i>s</i><sub>1</sub>), <i>s</i><sub>2</sub>), <i>D</i><sub>Lev</sub>(<i>s</i><sub>1</sub>, tail(<i>s</i><sub>2</sub>)), <i>D</i><sub>Lev</sub>(tail(<i>s</i><sub>1</sub>), tail(<i>s</i><sub>2</sub>)) } otherwise.",
                        ParagraphStyle('FBody', fontName='Helvetica', fontSize=8.2, leading=12.5, textColor=SLATE_DARK)
                    )]
                ], colWidths=[USABLE_CONTENT_WIDTH])
                lev_box.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), CALLOUT_BG),
                    ('BOX', (0, 0), (-1, -1), 1.0, CALLOUT_BORDER),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                    ('LEFTPADDING', (0, 0), (-1, -1), 10),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 10),
                ]))
                story.append(KeepTogether([lev_box]))
                story.append(Spacer(1, 6))
            continue

        # Handle Tables
        if "|" in line and stripped.startswith("|") and stripped.endswith("|"):
            table_lines = []
            while i < total_lines and "|" in lines[i] and lines[i].strip().startswith("|"):
                table_lines.append(lines[i].strip())
                i += 1

            if len(table_lines) >= 2:
                raw_rows = []
                for tl in table_lines:
                    if re.match(r'^\|[\s\-:|]+\|$', tl):
                        continue
                    cols = [c.strip() for c in tl.strip('|').split('|')]
                    raw_rows.append(cols)

                if raw_rows:
                    num_cols = max(len(r) for r in raw_rows)
                    for r in raw_rows:
                        while len(r) < num_cols:
                            r.append("")

                    if num_cols == 2:
                        col_widths = [130.0, 386.0]
                    elif num_cols == 3:
                        col_widths = [110.0, 150.0, 256.0]
                    elif num_cols == 4:
                        col_widths = [90.0, 130.0, 146.0, 150.0]
                    elif num_cols == 5:
                        col_widths = [75.0, 100.0, 115.0, 115.0, 111.0]
                    else:
                        c_w = USABLE_CONTENT_WIDTH / num_cols
                        col_widths = [c_w] * num_cols

                    table_data = []
                    for row_idx, r in enumerate(raw_rows):
                        row_cells = []
                        for cell_text in r:
                            clean_text = cell_text.replace("<br>", "\n").replace("**", "")
                            clean_text = format_inline_markdown(clean_text)
                            if row_idx == 0:
                                p = Paragraph(clean_text, table_header_style)
                            else:
                                p = Paragraph(clean_text, table_cell_style)
                            row_cells.append(p)
                        table_data.append(row_cells)

                    t = Table(table_data, colWidths=col_widths)
                    t.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY_NAVY),
                        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
                        ('LEFTPADDING', (0, 0), (-1, -1), 5.0),
                        ('RIGHTPADDING', (0, 0), (-1, -1), 5.0),
                        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_TINT]),
                        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_LIGHT),
                    ]))
                    story.append(Spacer(1, 4))
                    story.append(t)
                    story.append(Spacer(1, 6))
            continue

        # Skip Blank Lines
        if not stripped:
            i += 1
            continue

        # Skip raw Markdown Horizontal Rules
        if stripped in ["---", "***", "___"]:
            i += 1
            continue

        # ---------------------------------------------------------------------
        # Major Section & Chapter Headings (# Heading 1)
        # ---------------------------------------------------------------------
        if stripped.startswith("# "):
            title_text = stripped[2:].strip()
            anchor_key = normalize_anchor(title_text)

            add_page_break(story)
            story.append(TrackPageFlowable(anchor_key, page_registry))
            story.append(Spacer(1, 6))
            story.append(Paragraph(title_text, h1_style))
            story.append(HRFlowable(width="100%", thickness=2.0, color=ACCENT_BLUE, spaceBefore=3, spaceAfter=10))
            i += 1
            continue

        # ---------------------------------------------------------------------
        # Section Headings (## Heading 2)
        # ---------------------------------------------------------------------
        if stripped.startswith("## "):
            h2_text = stripped[3:].strip()
            anchor_key = normalize_anchor(h2_text)

            # Preliminary & Front Matter Sections
            if any(h2_text.upper().startswith(sec) for sec in [
                "CERTIFICATE", "CANDIDATE DECLARATION", "ACKNOWLEDGEMENTS",
                "EXECUTIVE ABSTRACT", "TABLE OF CONTENTS", "LIST OF FIGURES",
                "LIST OF TABLES", "LIST OF ABBREVIATIONS"
            ]):
                add_page_break(story)
                story.append(TrackPageFlowable(anchor_key, page_registry))
                story.append(Spacer(1, 6))
                story.append(Paragraph(h2_text, h1_style))
                story.append(HRFlowable(width="100%", thickness=1.5, color=ACCENT_BLUE, spaceBefore=3, spaceAfter=12))

                # Special treatment for Certificate
                if "CERTIFICATE" in h2_text.upper():
                    i += 1
                    cert_paras = []
                    while i < total_lines and not lines[i].strip().startswith("---") and not "Project Guide" in lines[i]:
                        if lines[i].strip():
                            cert_paras.append(lines[i].strip())
                        i += 1

                    for cp in cert_paras:
                        story.append(Paragraph(format_inline_markdown(cp), body_style))
                    story.append(Spacer(1, 35))

                    sig1 = Paragraph("__________________________________________<br/><b>Project Guide / Supervisor</b><br/>Dept. of Computer Science &amp; Eng.", body_style)
                    sig2 = Paragraph("__________________________________________<br/><b>Head of Department (CSE)</b><br/>Dept. of Computer Science &amp; Eng.", body_style)
                    sig3 = Paragraph("__________________________________________<br/><b>Internal Examiner</b><br/>Dept. of Computer Science &amp; Eng.", body_style)
                    sig4 = Paragraph("__________________________________________<br/><b>External Examiner</b><br/>External Academic / Industry Evaluator", body_style)

                    sig_table = Table([[sig1, sig2], [Spacer(1, 30), Spacer(1, 30)], [sig3, sig4]], colWidths=[250, 250])
                    sig_table.setStyle(TableStyle([
                        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                        ('LEFTPADDING', (0, 0), (-1, -1), 4),
                        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
                    ]))
                    story.append(sig_table)
                    story.append(Spacer(1, 25))
                    story.append(Paragraph("<b>Date:</b>  ________________________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <b>Place:</b> ________________________", body_style))

                    while i < total_lines and not lines[i].strip().startswith("## "):
                        i += 1
                    continue

                # Special treatment for Candidate Declaration
                if "CANDIDATE DECLARATION" in h2_text.upper():
                    i += 1
                    decl_paras = []
                    while i < total_lines and not lines[i].strip().startswith("## "):
                        if lines[i].strip().startswith("---"):
                            i += 1
                            break
                        if lines[i].strip():
                            decl_paras.append(lines[i].strip())
                        i += 1

                    for dp in decl_paras:
                        if dp.startswith("1. ") or dp.startswith("2. ") or dp.startswith("3. "):
                            num = dp[:3]
                            rest = dp[3:]
                            story.append(Paragraph(f"<b>{num}</b> {format_inline_markdown(rest)}", bullet_style))
                        elif "Dhruvrajsinh Parmar" in dp:
                            story.append(Spacer(1, 40))
                            cand_sig = Paragraph(
                                "__________________________________________<br/>"
                                "<b>Dhruvrajsinh Parmar</b><br/>"
                                "Candidate / Researcher (B.Tech CSE)<br/>"
                                "Department of Computer Science &amp; Engineering<br/><br/>"
                                "<b>Date:</b> ________________________ &nbsp;&nbsp;&nbsp;&nbsp; <b>Place:</b> ________________________",
                                body_style
                            )
                            story.append(cand_sig)
                        elif "Date:" in dp or "Place:" in dp or "Department of Computer Science" in dp:
                            continue
                        else:
                            story.append(Paragraph(format_inline_markdown(dp), body_style))
                    continue

                # Special treatment for Table of Contents: Format as structured table with page numbers
                if "TABLE OF CONTENTS" in h2_text.upper():
                    i += 1
                    toc_items = []
                    while i < total_lines and not lines[i].strip().startswith("## ") and not lines[i].strip().startswith("# "):
                        tl = lines[i].strip()
                        if tl and (tl.startswith("- ") or tl.startswith("### ")):
                            toc_items.append(tl)
                        i += 1

                    toc_rows = [
                        [Paragraph("<b>SECTION / CHAPTER TOPIC</b>", table_header_style), Paragraph("<b>PAGE</b>", ParagraphStyle('TPgH', parent=table_header_style, alignment=2))]
                    ]
                    for item in toc_items:
                        if item.startswith("### "):
                            raw_t = item[4:].strip()
                            a_key = normalize_anchor(raw_t)
                            pg_num = str(page_map.get(a_key, ""))
                            row_p = Paragraph(f"<b>{raw_t}</b>", toc_title_style)
                            pg_p = Paragraph(f"<b>{pg_num}</b>", toc_page_style)
                            toc_rows.append([row_p, pg_p])
                        elif item.startswith("- **"):
                            raw_t = item.strip("- *")
                            a_key = normalize_anchor(raw_t)
                            pg_num = str(page_map.get(a_key, ""))
                            row_p = Paragraph(f"<b>{raw_t}</b>", toc_title_style)
                            pg_p = Paragraph(f"<b>{pg_num}</b>", toc_page_style)
                            toc_rows.append([row_p, pg_p])
                        elif item.startswith("- "):
                            raw_t = item[2:].strip()
                            a_key = normalize_anchor(raw_t)
                            pg_num = str(page_map.get(a_key, ""))
                            row_p = Paragraph(f"{raw_t}", toc_sub_style)
                            pg_p = Paragraph(f"{pg_num}", toc_page_style)
                            toc_rows.append([row_p, pg_p])

                    if toc_rows:
                        toc_table = Table(toc_rows, colWidths=[466.0, 50.0])
                        toc_table.setStyle(TableStyle([
                            ('BACKGROUND', (0, 0), (-1, 0), PRIMARY_NAVY),
                            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                            ('TOPPADDING', (0, 0), (-1, -1), 2.5),
                            ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
                            ('LEFTPADDING', (0, 0), (-1, -1), 5.0),
                            ('RIGHTPADDING', (0, 0), (-1, -1), 5.0),
                            ('LINEBELOW', (0, 1), (-1, -1), 0.3, colors.HexColor("#F1F5F9")),
                        ]))
                        story.append(toc_table)
                    continue

                # Special treatment for List of Figures: Format as structured table
                if "LIST OF FIGURES" in h2_text.upper():
                    i += 1
                    fig_items = []
                    while i < total_lines and not lines[i].strip().startswith("## ") and not lines[i].strip().startswith("# "):
                        tl = lines[i].strip()
                        if tl and tl.startswith("- **Figure"):
                            fig_items.append(tl)
                        i += 1

                    fig_rows = [
                        [Paragraph("<b>FIGURE NO.</b>", table_header_style), Paragraph("<b>FIGURE TITLE &amp; DESCRIPTION</b>", table_header_style)]
                    ]
                    for item in fig_items:
                        match = re.match(r'-\s+\*\*([^\*]+)\*\*:\s*(.*)', item)
                        if match:
                            fig_no = match.group(1).strip()
                            fig_desc = match.group(2).strip()
                            fig_rows.append([
                                Paragraph(f"<font color='#1D4ED8'><b>{fig_no}</b></font>", table_cell_style),
                                Paragraph(format_inline_markdown(fig_desc), table_cell_style)
                            ])

                    if fig_rows:
                        fig_table = Table(fig_rows, colWidths=[95.0, 421.0])
                        fig_table.setStyle(TableStyle([
                            ('BACKGROUND', (0, 0), (-1, 0), PRIMARY_NAVY),
                            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                            ('TOPPADDING', (0, 0), (-1, -1), 3.5),
                            ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
                            ('LEFTPADDING', (0, 0), (-1, -1), 6.0),
                            ('RIGHTPADDING', (0, 0), (-1, -1), 6.0),
                            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_TINT]),
                            ('GRID', (0, 0), (-1, -1), 0.5, BORDER_LIGHT),
                        ]))
                        story.append(fig_table)
                    continue

                # Special treatment for List of Tables: Format as structured table
                if "LIST OF TABLES" in h2_text.upper():
                    i += 1
                    tbl_items = []
                    while i < total_lines and not lines[i].strip().startswith("## ") and not lines[i].strip().startswith("# "):
                        tl = lines[i].strip()
                        if tl and tl.startswith("- **Table"):
                            tbl_items.append(tl)
                        i += 1

                    tbl_rows = [
                        [Paragraph("<b>TABLE NO.</b>", table_header_style), Paragraph("<b>TABLE TITLE &amp; SYSTEM FUNCTION</b>", table_header_style)]
                    ]
                    for item in tbl_items:
                        match = re.match(r'-\s+\*\*([^\*]+)\*\*:\s*(.*)', item)
                        if match:
                            tbl_no = match.group(1).strip()
                            tbl_desc = match.group(2).strip()
                            tbl_rows.append([
                                Paragraph(f"<font color='#1D4ED8'><b>{tbl_no}</b></font>", table_cell_style),
                                Paragraph(format_inline_markdown(tbl_desc), table_cell_style)
                            ])

                    if tbl_rows:
                        tbl_table = Table(tbl_rows, colWidths=[95.0, 421.0])
                        tbl_table.setStyle(TableStyle([
                            ('BACKGROUND', (0, 0), (-1, 0), PRIMARY_NAVY),
                            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                            ('TOPPADDING', (0, 0), (-1, -1), 3.5),
                            ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
                            ('LEFTPADDING', (0, 0), (-1, -1), 6.0),
                            ('RIGHTPADDING', (0, 0), (-1, -1), 6.0),
                            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_TINT]),
                            ('GRID', (0, 0), (-1, -1), 0.5, BORDER_LIGHT),
                        ]))
                        story.append(tbl_table)
                    continue

                # Special treatment for Executive Abstract: Append Keywords Callout
                if "EXECUTIVE ABSTRACT" in h2_text.upper():
                    i += 1
                    abs_paras = []
                    while i < total_lines and not lines[i].strip().startswith("## "):
                        if lines[i].strip():
                            abs_paras.append(lines[i].strip())
                        i += 1

                    for ap in abs_paras:
                        if ap.startswith("1. ") or ap.startswith("2. ") or ap.startswith("3. ") or ap.startswith("4. ") or ap.startswith("5. ") or ap.startswith("6. ") or ap.startswith("7. "):
                            num = ap[:3]
                            rest = ap[3:]
                            story.append(Paragraph(f"<b>{num}</b> {format_inline_markdown(rest)}", bullet_style))
                        elif ap in ["---", "***"]:
                            continue
                        else:
                            story.append(Paragraph(format_inline_markdown(ap), body_style))

                    story.append(Spacer(1, 10))
                    kw_text = (
                        "<b>Keywords:</b> External Attack Surface Management (EASM), Passive Reconnaissance, "
                        "Active Port Auditing, TLS 1.3 Cryptography, DMARC/SPF/DNSSEC, SSRF Mitigation, "
                        "OSV.dev CVE Correlation, IDN Homoglyph Detection, Diminishing-Penalty Scoring."
                    )
                    story.append(Paragraph(kw_text, callout_style))
                    continue

            else:
                story.append(TrackPageFlowable(anchor_key, page_registry))
                story.append(Paragraph(h2_text, h2_style))
            i += 1
            continue

        # ---------------------------------------------------------------------
        # Subsection Headings (### Heading 3)
        # ---------------------------------------------------------------------
        if stripped.startswith("### "):
            h3_text = stripped[4:].strip()
            anchor_key = normalize_anchor(h3_text)
            story.append(TrackPageFlowable(anchor_key, page_registry))
            story.append(Paragraph(h3_text, h3_style))
            i += 1
            continue

        # ---------------------------------------------------------------------
        # Callouts / Blockquotes (> Quote)
        # ---------------------------------------------------------------------
        if stripped.startswith("> "):
            callout_text = stripped[2:].strip()
            story.append(Paragraph(format_inline_markdown(callout_text), callout_style))
            i += 1
            continue

        # ---------------------------------------------------------------------
        # Bullet Points (- Item or * Item)
        # ---------------------------------------------------------------------
        if stripped.startswith("- ") or stripped.startswith("* "):
            bullet_text = stripped[2:].strip()
            bullet_html = format_inline_markdown(bullet_text)
            story.append(Paragraph(f"&bull; &nbsp; {bullet_html}", bullet_style))
            i += 1
            continue

        # ---------------------------------------------------------------------
        # Numbered Lists (1. Item)
        # ---------------------------------------------------------------------
        if re.match(r'^\d+\.\s+', stripped):
            num_match = re.match(r'^(\d+\.)\s+(.*)', stripped)
            num_prefix = num_match.group(1)
            num_text = format_inline_markdown(num_match.group(2))
            story.append(Paragraph(f"<b>{num_prefix}</b> &nbsp; {num_text}", bullet_style))
            i += 1
            continue

        # ---------------------------------------------------------------------
        # Standard Body Paragraphs
        # ---------------------------------------------------------------------
        body_html = format_inline_markdown(stripped)
        story.append(Paragraph(body_html, body_style))
        i += 1

    return story


def build_pdf_report(input_md_path, output_pdf_path):
    print(f"[*] Reading source report: {input_md_path}")
    with open(input_md_path, "r", encoding="utf-8") as f:
        md_text = f.read()

    # -------------------------------------------------------------------------
    # PASS 1: Calculate Page Numbers for Table of Contents
    # -------------------------------------------------------------------------
    print(f"[*] Pass 1: Analyzing document structure and pagination...")
    page_map = {}
    pass1_registry = {}
    pass1_story = build_story(md_text, page_map={}, page_registry=pass1_registry)

    pass1_buf = io.BytesIO()
    doc_pass1 = SimpleDocTemplate(
        pass1_buf,
        pagesize=letter,
        leftMargin=DOC_LEFT_MARGIN,
        rightMargin=DOC_RIGHT_MARGIN,
        topMargin=DOC_TOP_MARGIN,
        bottomMargin=DOC_BOTTOM_MARGIN
    )
    doc_pass1.build(pass1_story, canvasmaker=NumberedCanvas)
    page_map.update(pass1_registry)
    print(f"[✓] Pass 1 complete: Mapped {len(page_map)} structural anchors to page numbers.")

    # -------------------------------------------------------------------------
    # PASS 2: Build Final Publication-Quality Boxed PDF with populated TOC
    # -------------------------------------------------------------------------
    print(f"[*] Pass 2: Compiling final boxed manual with integrated headers, footers & TOC...")
    pass2_registry = {}
    final_story = build_story(md_text, page_map=page_map, page_registry=pass2_registry)

    doc_final = SimpleDocTemplate(
        output_pdf_path,
        pagesize=letter,
        leftMargin=DOC_LEFT_MARGIN,
        rightMargin=DOC_RIGHT_MARGIN,
        topMargin=DOC_TOP_MARGIN,
        bottomMargin=DOC_BOTTOM_MARGIN
    )
    doc_final.build(final_story, canvasmaker=NumberedCanvas)
    print(f"[✓] Publication-quality boxed manual successfully compiled to: {output_pdf_path}")


if __name__ == "__main__":
    src_file = sys.argv[1] if len(sys.argv) > 1 else "PROJECT_REPORT.md"
    dst_file = sys.argv[2] if len(sys.argv) > 2 else "PROJECT_REPORT.pdf"
    build_pdf_report(src_file, dst_file)
