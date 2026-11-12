import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models import User, FoodHistory
from app.schemas import WeeklyReport, MacroSummary, DailyCalorieSummary
from app.services.pdf_service import PDFService

router = APIRouter()

def calculate_weekly_stats(user: User, db: Session):
    """
    Computes calorie aggregates and average macros for the past 7 days.
    """
    # Start date is 7 days ago (inclusive of today)
    today = datetime.date.today()
    start_date = today - datetime.timedelta(days=6)
    
    # Query all food logs for the user within this range
    logs = db.query(FoodHistory).filter(
        FoodHistory.user_id == user.id,
        func.date(FoodHistory.created_at) >= start_date
    ).all()
    
    # Initialize daily mapping dictionary
    daily_summaries_dict = {}
    for i in range(7):
        d = start_date + datetime.timedelta(days=i)
        daily_summaries_dict[d.strftime("%Y-%m-%d")] = 0.0

    # Initialize total macro counters
    total_protein = 0.0
    total_carbs = 0.0
    total_fat = 0.0
    total_fiber = 0.0

    # Aggregate database results
    for log in logs:
        # Get date string format YYYY-MM-DD
        log_date = log.created_at.date().strftime("%Y-%m-%d")
        if log_date in daily_summaries_dict:
            daily_summaries_dict[log_date] += log.total_calories
            
        total_protein += log.total_protein
        total_carbs += log.total_carbs
        total_fat += log.total_fat
        total_fiber += log.total_fiber

    # Format into list of DailyCalorieSummary schemas
    daily_summaries = []
    for date_str, calories in daily_summaries_dict.items():
        daily_summaries.append(
            DailyCalorieSummary(
                date=date_str,
                calories=calories,
                target=float(user.daily_calorie_target)
            )
        )
        
    # Calculate daily averages over the 7-day period
    # Using 7.0 as denominator ensures correct daily average distribution
    avg_calories = sum(daily_summaries_dict.values()) / 7.0
    
    weekly_macros = MacroSummary(
        protein=total_protein / 7.0,
        carbs=total_carbs / 7.0,
        fat=total_fat / 7.0,
        fiber=total_fiber / 7.0
    )
    
    return {
        "daily_summaries": daily_summaries,
        "weekly_macros": weekly_macros,
        "average_calories": avg_calories,
        "calorie_target": user.daily_calorie_target
    }

@router.get("/weekly", response_model=WeeklyReport)
def get_weekly_report(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get weekly calorie tracking summaries and average daily macro distribution.
    """
    stats = calculate_weekly_stats(current_user, db)
    return WeeklyReport(
        daily_summaries=stats["daily_summaries"],
        weekly_macros=stats["weekly_macros"],
        average_calories=stats["average_calories"]
    )

@router.get("/pdf")
def download_weekly_pdf_report(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate and stream a high-quality PDF containing weekly calorie & nutrition metrics.
    """
    stats = calculate_weekly_stats(current_user, db)
    
    # Convert summaries list to simple dict layout for PDF generator
    daily_summaries_raw = [
        {"date": s.date, "calories": s.calories, "target": s.target}
        for s in stats["daily_summaries"]
    ]
    
    weekly_macros_raw = {
        "protein": stats["weekly_macros"].protein,
        "carbs": stats["weekly_macros"].carbs,
        "fat": stats["weekly_macros"].fat,
        "fiber": stats["weekly_macros"].fiber
    }

    # Generate ReportLab in-memory PDF
    pdf_buffer = PDFService.generate_weekly_report_pdf(
        username=current_user.username,
        daily_summaries=daily_summaries_raw,
        weekly_macros=weekly_macros_raw,
        avg_calories=stats["average_calories"],
        calorie_target=stats["calorie_target"]
    )

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=weekly_nutrition_report_{current_user.username}.pdf"
        }
    )
