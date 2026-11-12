from io import BytesIO
import datetime
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False
    logger.warning("reportlab library not installed. PDF report downloads will fall back to plaintext.")

class PDFService:
    @staticmethod
    def generate_weekly_report_pdf(
        username: str,
        daily_summaries: List[Dict[str, Any]],
        weekly_macros: Dict[str, float],
        avg_calories: float,
        calorie_target: int
    ) -> BytesIO:
        buffer = BytesIO()
        
        if not REPORTLAB_AVAILABLE:
            # Fallback to plain text report if ReportLab is not installed
            text = f"""WEEKLY NUTRITION & CALORIE REPORT
----------------------------------
User: {username}
Date Generated: {datetime.date.today().strftime('%B %d, %Y')}
Daily Calorie Target: {calorie_target} kcal
Average Daily Calories: {avg_calories:.1f} kcal

DAILY SUMMARY LOGS:
"""
            for summary in daily_summaries:
                text += f"- {summary['date']}: {summary['calories']:.1f} kcal / {summary['target']} kcal target\n"
            
            text += f"""
WEEKLY MACRO BREAKDOWN (DAILY AVERAGE):
- Protein: {weekly_macros.get('protein', 0.0):.1f} g
- Carbohydrates: {weekly_macros.get('carbs', 0.0):.1f} g
- Fat: {weekly_macros.get('fat', 0.0):.1f} g
- Fiber: {weekly_macros.get('fiber', 0.0):.1f} g
"""
            buffer.write(text.encode("utf-8"))
            buffer.seek(0)
            return buffer

        # Styled PDF Generation using ReportLab
        doc = SimpleDocTemplate(
            buffer, 
            pagesize=letter, 
            rightMargin=54, 
            leftMargin=54, 
            topMargin=54, 
            bottomMargin=54
        )
        story = []
        styles = getSampleStyleSheet()
        
        # Professional Color Palette
        primary_color = colors.HexColor("#0f172a")    # Dark slate
        secondary_color = colors.HexColor("#3b82f6")  # Bright blue
        accent_color = colors.HexColor("#10b981")     # Emerald green
        text_color = colors.HexColor("#334155")       # Muted body text
        bg_light = colors.HexColor("#f8fafc")         # Light background fill
        border_color = colors.HexColor("#e2e8f0")
        
        # Typography / Styles
        title_style = ParagraphStyle(
            'ReportTitle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=24,
            textColor=primary_color,
            spaceAfter=6
        )
        
        subtitle_style = ParagraphStyle(
            'ReportSubtitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            textColor=colors.HexColor("#64748b"),
            spaceAfter=25
        )
        
        heading_style = ParagraphStyle(
            'SectionHeading',
            parent=styles['Heading2'],
            fontName='Helvetica-Bold',
            fontSize=13,
            textColor=primary_color,
            spaceBefore=14,
            spaceAfter=8
        )
        
        body_style = ParagraphStyle(
            'Body',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9.5,
            textColor=text_color,
            spaceAfter=5
        )

        # Header section
        story.append(Paragraph("Weekly Calorie & Nutrition Report", title_style))
        story.append(Paragraph(f"Generated on {datetime.date.today().strftime('%B %d, %Y')} | User Profile: {username}", subtitle_style))
        
        # Overview Card
        story.append(Paragraph("Weekly Overview", heading_style))
        story.append(Paragraph(f"<b>Daily Calorie Goal:</b> {calorie_target} kcal", body_style))
        story.append(Paragraph(f"<b>Average Daily Consumption:</b> {avg_calories:.1f} kcal", body_style))
        
        # Basic assessment
        diff = avg_calories - calorie_target
        if avg_calories == 0:
            assessment = "No food logs found for this week. Start logging your food details to track metrics."
        elif diff > 150:
            assessment = "Your weekly average is above your calorie goal. Focus on scaling back quantities or choosing higher protein, lower calorie dense meals."
        elif diff < -300:
            assessment = "Your average is below your calorie goal. Make sure you are consuming sufficient nutrients to support your energy levels."
        else:
            assessment = "Excellent tracking! You are maintaining an intake close to your daily goal."
            
        story.append(Paragraph(f"<b>Dietary Assessment:</b> {assessment}", body_style))
        story.append(Spacer(1, 10))
        
        # Daily logs table
        story.append(Paragraph("Daily Calorie Logs", heading_style))
        table_data = [["Date", "Calories Consumed", "Calorie Target", "Status"]]
        for item in daily_summaries:
            cal = item['calories']
            tgt = item['target']
            difference = cal - tgt
            if cal == 0:
                status = "No entry"
            elif difference > 100:
                status = f"Over (+{int(difference)} kcal)"
            elif difference < -200:
                status = f"Under ({int(abs(difference))} kcal)"
            else:
                status = "On Target"
            table_data.append([item['date'], f"{cal:.1f} kcal", f"{tgt} kcal", status])
            
        t_daily = Table(table_data, colWidths=[1.8 * inch, 1.6 * inch, 1.6 * inch, 2.0 * inch])
        t_daily.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), primary_color),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,0), 9.5),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, bg_light]),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ]))
        story.append(t_daily)
        story.append(Spacer(1, 12))
        
        # Macro overview table
        story.append(Paragraph("Average Daily Macro Breakdown", heading_style))
        
        macro_cals = (weekly_macros.get('protein', 0.0) * 4) + (weekly_macros.get('carbs', 0.0) * 4) + (weekly_macros.get('fat', 0.0) * 9)
        total_macro_div = macro_cals or 1
        
        macro_data = [
            ["Nutrient", "Daily Average (g)", "Energy Distribution (%)"],
            ["Protein", f"{weekly_macros.get('protein', 0.0):.1f} g", f"{((weekly_macros.get('protein', 0.0) * 4) / total_macro_div * 100):.1f}%"],
            ["Carbohydrates", f"{weekly_macros.get('carbs', 0.0):.1f} g", f"{((weekly_macros.get('carbs', 0.0) * 4) / total_macro_div * 100):.1f}%"],
            ["Fat", f"{weekly_macros.get('fat', 0.0):.1f} g", f"{((weekly_macros.get('fat', 0.0) * 9) / total_macro_div * 100):.1f}%"],
            ["Fiber", f"{weekly_macros.get('fiber', 0.0):.1f} g", "N/A (Non-caloric)"]
        ]
        
        t_macro = Table(macro_data, colWidths=[2.2 * inch, 2.0 * inch, 2.8 * inch])
        t_macro.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), secondary_color),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,0), 9.5),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, bg_light]),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ]))
        story.append(t_macro)
        
        # Build document and output buffer bytes
        doc.build(story)
        buffer.seek(0)
        return buffer
