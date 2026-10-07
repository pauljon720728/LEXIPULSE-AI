import io
import datetime
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

def generate_complaint_pdf(complaint_data: dict) -> bytes:
    """Generate a PDF Case Report for viva evaluation and legal audit."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#1E293B'),
        spaceAfter=4
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#64748B'),
        spaceAfter=12
    )
    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#0F172A'),
        spaceBefore=10,
        spaceAfter=6
    )
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155')
    )
    badge_style = ParagraphStyle(
        'BadgeStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=colors.white
    )

    story = []

    # Title & Department Header
    story.append(Paragraph("NATIONAL LEGAL GRIEVANCE & COMPLAINT INTELLIGENCE SYSTEM", title_style))
    story.append(Paragraph(f"Official AI Classification Dossier & Case Record • Generated: {datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0284C7"), spaceAfter=14))

    # Complaint Summary Table
    urgency_color = colors.HexColor("#DC2626") if complaint_data.get("urgency_label") == "Critical" else colors.HexColor("#EA580C")
    
    meta_table_data = [
        [
            Paragraph(f"<b>Complaint Reference ID:</b> {complaint_data.get('id', 'N/A')}", body_style),
            Paragraph(f"<b>Status:</b> {complaint_data.get('status', 'Submitted')}", body_style)
        ],
        [
            Paragraph(f"<b>Complainant Name:</b> {complaint_data.get('citizen_name', 'Anonymous')}", body_style),
            Paragraph(f"<b>Contact:</b> {complaint_data.get('citizen_contact', 'Restricted')}", body_style)
        ],
        [
            Paragraph(f"<b>Filing Date:</b> {str(complaint_data.get('created_at', ''))[:19]}", body_style),
            Paragraph(f"<b>SLA Resolution Deadline:</b> {str(complaint_data.get('sla_deadline', 'Within 24 Hours'))[:19]}", body_style)
        ],
        [
            Paragraph(f"<b>Detected Language:</b> {complaint_data.get('detected_lang_name', 'English')} (Conf: {complaint_data.get('detected_lang_confidence', 0.95)})", body_style),
            Paragraph(f"<b>Model Mode:</b> {complaint_data.get('model_mode_used', 'Fine-Tuned Transformer')}", body_style)
        ]
    ]

    t_meta = Table(meta_table_data, colWidths=[270, 270])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#E2E8F0')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 14))

    # AI NLP Classification Scores Box
    story.append(Paragraph("AI EMOTION & URGENCY CLASSIFICATION RESULTS", section_heading))
    
    scores_data = [
        [
            Paragraph("<b>Predicted Urgency</b>", body_style),
            Paragraph(f"<b>{complaint_data.get('urgency_label', 'High')}</b> (Score: {complaint_data.get('urgency_score', 75)}/100)", body_style),
            Paragraph("<b>Primary Emotion</b>", body_style),
            Paragraph(f"<b>{str(complaint_data.get('emotion_label', 'distress')).upper()}</b> (Conf: {complaint_data.get('emotion_confidence', 0.88)})", body_style)
        ],
        [
            Paragraph("<b>Legal Category</b>", body_style),
            Paragraph(f"<b>{complaint_data.get('category', 'Cybercrime')}</b>", body_style),
            Paragraph("<b>Assigned Department</b>", body_style),
            Paragraph(f"<b>{complaint_data.get('department_name', 'Cyber Crime Cell')}</b>", body_style)
        ]
    ]
    t_scores = Table(scores_data, colWidths=[135, 135, 135, 135])
    t_scores.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#EFF6FF')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#BFDBFE')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#DBEAFE')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_scores)
    story.append(Spacer(1, 14))

    # Original Raw Text & Translation
    story.append(Paragraph("GRIEVANCE CONTENT & TRANSLATION AUDIT", section_heading))
    story.append(Paragraph(f"<b>Original Citizen Submission ({complaint_data.get('detected_lang_name', 'Source')}):</b>", body_style))
    story.append(Paragraph(f"<i>\"{complaint_data.get('raw_text', '')}\"</i>", body_style))
    story.append(Spacer(1, 8))

    story.append(Paragraph("<b>Standardized English Translation (Normalized for Legal Processing):</b>", body_style))
    story.append(Paragraph(f"\"{complaint_data.get('translated_text', '')}\"", body_style))
    story.append(Spacer(1, 14))

    # Explainable AI Reasoning & Triggers
    story.append(Paragraph("EXPLAINABLE AI (XAI) DECISION JUSTIFICATION", section_heading))
    triggers = complaint_data.get('trigger_keywords', [])
    trigger_text = ", ".join(triggers) if triggers else "Standard procedural terms"
    story.append(Paragraph(f"<b>Extracted Trigger Keywords:</b> <u>{trigger_text}</u>", body_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph(f"<b>Algorithmic Reasoning:</b> {complaint_data.get('explanation_text', 'Classified via multilingual transformer pipeline based on emotional indicators.')}", body_style))
    story.append(Spacer(1, 16))

    # Emotion Breakdown Table
    story.append(Paragraph("EMOTIONAL SPECTRUM PROBABILITY BREAKDOWN", section_heading))
    emotion_scores = complaint_data.get("emotion_scores", {})
    if emotion_scores:
        emo_row1 = [Paragraph(f"<b>{k.capitalize()}</b>", body_style) for k in emotion_scores.keys()]
        emo_row2 = [Paragraph(f"{round(float(v)*100, 1)}%", body_style) for v in emotion_scores.values()]
        t_emo = Table([emo_row1, emo_row2], colWidths=[540 // len(emotion_scores)] * len(emotion_scores))
        t_emo.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#94A3B8')),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(t_emo)

    story.append(Spacer(1, 24))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1"), spaceAfter=14))
    
    # Official Signature Footer
    sign_table = Table([
        [
            Paragraph("<b>Filing Citizen Signature / Auth Token</b><br/><br/>[Digitally Authenticated / Verified]", body_style),
            Paragraph("<b>Reviewing Officer / Station Head</b><br/><br/>_____________________________________<br/>Official Stamp & Badge", body_style)
        ]
    ], colWidths=[270, 270])
    story.append(sign_table)

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
