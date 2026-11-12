from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case, distinct
from typing import List, Optional
from datetime import datetime, date, timedelta
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models import User, FoodHistory, FoodItem
from app.schemas import UserResponse

router = APIRouter()

# ── Pydantic Schemas ─────────────────────────────────────────────────────────

class AdminLogResponse(BaseModel):
    id: int
    user_id: int
    username: str
    image_path: Optional[str] = None
    total_calories: float
    total_protein: float
    total_carbs: float
    total_fat: float
    total_fiber: float
    created_at: datetime

    class Config:
        from_attributes = True


class AdminUserListItem(BaseModel):
    id: int
    username: str
    email: str
    is_admin: bool
    is_active: bool
    created_at: datetime
    meal_count: int
    last_active: Optional[datetime] = None

    class Config:
        from_attributes = True


class AdminUserDetail(BaseModel):
    id: int
    username: str
    email: str
    is_admin: bool
    is_active: bool
    age: Optional[int] = None
    gender: Optional[str] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    target_weight: Optional[float] = None
    activity_level: Optional[str] = None
    bmi: Optional[float] = None
    bmi_category: Optional[str] = None
    daily_calorie_target: int
    protein_goal: Optional[float] = None
    carbs_goal: Optional[float] = None
    fat_goal: Optional[float] = None
    water_goal: Optional[float] = None
    fiber_goal: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    meal_count: int
    last_active: Optional[datetime] = None
    meals: list = []

    class Config:
        from_attributes = True


class UserStatusUpdate(BaseModel):
    is_active: bool


class AnalyticsResponse(BaseModel):
    total_users: int
    total_meals: int
    daily_active_users: int
    weekly_active_users: int
    top_foods: list
    detection_success_rate: float


# ── Admin Guard Dependency ───────────────────────────────────────────────────

def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user does not have administrative privileges."
        )
    return current_user


# ── Stats (legacy, kept for backward compat) ─────────────────────────────────

@router.get("/stats", status_code=status.HTTP_200_OK)
def get_system_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Fetch system-wide counts and statistics for the admin dashboard.
    """
    total_users = db.query(User).count()
    total_scans = db.query(FoodHistory).count()
    avg_calories = db.query(func.avg(User.daily_calorie_target)).scalar()
    
    return {
        "total_users": total_users,
        "total_scans": total_scans,
        "avg_calories_target": round(avg_calories or 0, 1)
    }


# ── GET /users — Enhanced user list with meal count + last active + search ───

@router.get("/users")
def get_all_users(
    search: Optional[str] = Query(None, description="Filter by username or email"),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    List all registered users with meal count and last active date.
    Supports search/filter by email or username.
    """
    query = db.query(
        User.id,
        User.username,
        User.email,
        User.is_admin,
        User.is_active,
        User.created_at,
        func.count(FoodHistory.id).label("meal_count"),
        func.max(FoodHistory.created_at).label("last_active")
    ).outerjoin(FoodHistory, User.id == FoodHistory.user_id)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (User.username.ilike(search_pattern)) | (User.email.ilike(search_pattern))
        )

    results = query.group_by(User.id).order_by(User.id).all()

    return [
        {
            "id": r.id,
            "username": r.username,
            "email": r.email,
            "is_admin": r.is_admin,
            "is_active": r.is_active,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "meal_count": r.meal_count,
            "last_active": r.last_active.isoformat() if r.last_active else None
        }
        for r in results
    ]


# ── GET /users/{user_id} — Full detail view for one user ─────────────────────

@router.get("/users/{user_id}")
def get_user_detail(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Full detail view for a single user: profile, daily targets, meal history.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    # Meal count and last active
    stats = db.query(
        func.count(FoodHistory.id).label("meal_count"),
        func.max(FoodHistory.created_at).label("last_active")
    ).filter(FoodHistory.user_id == user_id).first()

    # Meal history with items
    meals_query = db.query(FoodHistory).filter(
        FoodHistory.user_id == user_id
    ).order_by(FoodHistory.created_at.desc()).limit(50).all()

    meals = []
    for meal in meals_query:
        items = db.query(FoodItem).filter(FoodItem.history_id == meal.id).all()
        meals.append({
            "id": meal.id,
            "image_path": meal.image_path,
            "total_calories": meal.total_calories,
            "total_protein": meal.total_protein,
            "total_carbs": meal.total_carbs,
            "total_fat": meal.total_fat,
            "total_fiber": meal.total_fiber,
            "created_at": meal.created_at.isoformat() if meal.created_at else None,
            "items": [
                {
                    "id": item.id,
                    "name": item.name,
                    "confidence": item.confidence,
                    "calories": item.calories,
                    "protein": item.protein,
                    "carbs": item.carbs,
                    "fat": item.fat,
                    "fiber": item.fiber,
                    "quantity": item.quantity,
                    "serving_size": item.serving_size
                }
                for item in items
            ]
        })

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_admin": user.is_admin,
        "is_active": user.is_active,
        "age": user.age,
        "gender": user.gender,
        "weight_kg": user.weight_kg,
        "height_cm": user.height_cm,
        "target_weight": user.target_weight,
        "activity_level": user.activity_level,
        "bmi": user.bmi,
        "bmi_category": user.bmi_category,
        "daily_calorie_target": user.daily_calorie_target,
        "protein_goal": user.protein_goal,
        "carbs_goal": user.carbs_goal,
        "fat_goal": user.fat_goal,
        "water_goal": user.water_goal,
        "fiber_goal": user.fiber_goal,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        "meal_count": stats.meal_count if stats else 0,
        "last_active": stats.last_active.isoformat() if stats and stats.last_active else None,
        "meals": meals
    }


# ── PATCH /users/{user_id}/status — Enable or disable a user ─────────────────

@router.patch("/users/{user_id}/status", status_code=status.HTTP_200_OK)
def update_user_status(
    user_id: int,
    body: UserStatusUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Enable or disable a user's account.
    Admins cannot disable their own account.
    """
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot disable your own administrator account."
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    user.is_active = body.is_active
    db.commit()
    db.refresh(user)

    status_str = "enabled" if user.is_active else "disabled"
    return {"message": f"User '{user.username}' has been {status_str}.", "is_active": user.is_active}


# ── DELETE /users/{user_id} — Delete user with cascade ───────────────────────

@router.delete("/users/{user_id}", status_code=status.HTTP_200_OK)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Delete a user account. Admins cannot delete themselves.
    Cascade-deletes their meals, detections, and related data.
    """
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own administrator account."
        )
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
        
    db.delete(user)
    db.commit()
    return {"message": f"User '{user.username}' was deleted successfully."}


# ── GET /analytics — Dashboard analytics data ────────────────────────────────

@router.get("/analytics")
def get_analytics(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Returns aggregate analytics:
    - total_users, total_meals
    - daily_active_users (users with a meal logged today)
    - weekly_active_users (users with a meal in last 7 days)
    - top_foods: top 10 most frequently detected food items
    - detection_success_rate: % of meals with at least one detected item
    """
    total_users = db.query(User).count()
    total_meals = db.query(FoodHistory).count()

    # Daily active users — users with at least one meal today
    today = date.today()
    daily_active = db.query(
        func.count(distinct(FoodHistory.user_id))
    ).filter(
        func.date(FoodHistory.created_at) == today
    ).scalar() or 0

    # Weekly active users — users with at least one meal in last 7 days
    week_ago = today - timedelta(days=7)
    weekly_active = db.query(
        func.count(distinct(FoodHistory.user_id))
    ).filter(
        func.date(FoodHistory.created_at) >= week_ago
    ).scalar() or 0

    # Top 10 most frequently detected food items
    top_foods_query = db.query(
        FoodItem.name,
        func.count(FoodItem.id).label("count")
    ).group_by(FoodItem.name).order_by(func.count(FoodItem.id).desc()).limit(10).all()

    top_foods = [
        {"name": row.name, "count": row.count}
        for row in top_foods_query
    ]

    # Detection success rate
    # A "successful" detection = a FoodHistory entry that has at least 1 FoodItem
    if total_meals > 0:
        meals_with_items = db.query(
            func.count(distinct(FoodHistory.id))
        ).join(FoodItem, FoodHistory.id == FoodItem.history_id).scalar() or 0
        detection_success_rate = round((meals_with_items / total_meals) * 100, 1)
    else:
        detection_success_rate = 0.0

    return {
        "total_users": total_users,
        "total_meals": total_meals,
        "daily_active_users": daily_active,
        "weekly_active_users": weekly_active,
        "top_foods": top_foods,
        "detection_success_rate": detection_success_rate
    }


# ── Scan Logs (legacy endpoints, kept for backward compat) ───────────────────

@router.get("/logs", response_model=List[AdminLogResponse])
def get_all_logs(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Retrieve all scanned meal logs across the entire system with associated username.
    """
    logs = db.query(
        FoodHistory.id,
        FoodHistory.user_id,
        User.username,
        FoodHistory.image_path,
        FoodHistory.total_calories,
        FoodHistory.total_protein,
        FoodHistory.total_carbs,
        FoodHistory.total_fat,
        FoodHistory.total_fiber,
        FoodHistory.created_at
    ).join(User, FoodHistory.user_id == User.id).order_by(FoodHistory.created_at.desc()).all()
    
    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "username": log.username,
            "image_path": log.image_path,
            "total_calories": log.total_calories,
            "total_protein": log.total_protein,
            "total_carbs": log.total_carbs,
            "total_fat": log.total_fat,
            "total_fiber": log.total_fiber,
            "created_at": log.created_at
        }
        for log in logs
    ]

@router.delete("/logs/{log_id}", status_code=status.HTTP_200_OK)
def delete_log(
    log_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Delete a scan log item.
    """
    log = db.query(FoodHistory).filter(FoodHistory.id == log_id).first()
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meal log not found."
        )
        
    db.delete(log)
    db.commit()
    return {"message": "Meal log deleted successfully."}
