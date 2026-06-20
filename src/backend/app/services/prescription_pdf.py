import os
import uuid
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.config import settings


def _wrap(text: str | None, fallback: str = "—") -> str:
    if not text:
        return fallback
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def generate_prescription_pdf(
    prescription_id: uuid.UUID,
    patient: dict,
    doctor: dict,
    diagnosis: str | None,
    medicines: list[dict] | None,
    soap_notes: dict | None,
) -> str:
    """Generate a prescription PDF and return its relative path under uploads/."""
    rel_dir = os.path.join("prescriptions")
    abs_dir = os.path.join(settings.uploads_dir, rel_dir)
    os.makedirs(abs_dir, exist_ok=True)

    filename = f"{prescription_id}.pdf"
    abs_path = os.path.join(abs_dir, filename)
    rel_path = os.path.join(rel_dir, filename).replace("\\", "/")

    doc = SimpleDocTemplate(
        abs_path,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "Title",
        parent=styles["Heading1"],
        fontSize=18,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=6,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#64748b"),
        spaceAfter=12,
    )
    section_style = ParagraphStyle(
        "Section",
        parent=styles["Heading2"],
        fontSize=11,
        textColor=colors.HexColor("#1d4ed8"),
        spaceBefore=10,
        spaceAfter=4,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#334155"),
    )

    story = []
    now = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")

    story.append(Paragraph("MediFlow AI — Prescription Record", title_style))
    story.append(Paragraph(f"Generated on {now} | Rx ID: {prescription_id}", subtitle_style))

    meta_rows = [
        ["Patient", _wrap(patient.get("name")), "PID", _wrap(patient.get("pid"))],
        ["Doctor", _wrap(doctor.get("name")), "Department", _wrap(doctor.get("department"))],
        ["Diagnosis", _wrap(diagnosis), "Specialization", _wrap(doctor.get("specialization"))],
    ]
    meta_table = Table(meta_rows, colWidths=[28 * mm, 62 * mm, 28 * mm, 62 * mm])
    meta_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(meta_table)
    story.append(Spacer(1, 8))

    if soap_notes:
        story.append(Paragraph("Clinical SOAP Notes", section_style))
        for key, label in [
            ("subjective", "Subjective"),
            ("objective", "Objective"),
            ("assessment", "Assessment"),
            ("plan", "Plan"),
        ]:
            value = soap_notes.get(key)
            if value:
                story.append(Paragraph(f"<b>{label}:</b> {_wrap(value)}", body_style))
                story.append(Spacer(1, 4))

    story.append(Paragraph("Prescribed Medicines", section_style))
    med_rows = [["Medicine", "Dosage", "Frequency", "Duration", "Instructions"]]
    for med in medicines or []:
        med_rows.append(
            [
                _wrap(med.get("name")),
                _wrap(med.get("dosage")),
                _wrap(med.get("frequency")),
                _wrap(med.get("duration")),
                _wrap(med.get("instructions"), "As directed"),
            ]
        )
    if len(med_rows) == 1:
        med_rows.append(["No medicines recorded", "—", "—", "—", "—"])

    med_table = Table(med_rows, colWidths=[34 * mm, 22 * mm, 28 * mm, 24 * mm, 62 * mm])
    med_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1d4ed8")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(med_table)
    story.append(Spacer(1, 16))
    story.append(
        Paragraph(
            "This is a computer-generated prescription record from MediFlow AI. "
            "Please follow your doctor's instructions and consult before changing medication.",
            ParagraphStyle("Footer", parent=body_style, fontSize=8, textColor=colors.HexColor("#94a3b8")),
        )
    )

    doc.build(story)
    return rel_path
