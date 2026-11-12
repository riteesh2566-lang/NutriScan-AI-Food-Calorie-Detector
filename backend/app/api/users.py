from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models import User
from app.schemas import UserUpdate, UserResponse
from app.api.deps import get_current_user

router = APIRouter()


# ─── BMI & Nutrition Calculation Helpers ────────────────────────────────────

def _calculate_bmi(weight_kg: float, height_cm: float) -> tuple[float, str]:
    """Return (bmi_value, bmi_category)."""
    if not weight_kg or not height_cm or height_cm <= 0:
        return None, None
    height_m = height_cm / 100.0
    bmi = round(weight_kg / (height_m ** 2), 1)
    if bmi < 18.5:
        category = "underweight"
    elif bmi < 25.0:
        category = "normal"
    elif bmi < 30.0:
        category = "overweight"
    else:
        category = "obese"
    return bmi, category


def _calculate_nutrition_goals(
    weight_kg: float,
    height_cm: float,
    age: int,
    gender: str,
    activity_level: str
) -> dict:
    """
    Calculate TDEE using Mifflin-St Jeor and derive macro goals.
    Returns dict with: calories, protein, carbs, fat, water, fiber.
    """
    if not all([weight_kg, height_cm, age, gender]):
        return {}

    # BMR – Mifflin-St Jeor
    if gender and gender.lower() == "female":
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
    else:  # male or other → use male formula
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5

    # Activity multipliers
    multipliers = {
        "sedentary": 1.2,
        "lightly_active": 1.375,
        "moderately_active": 1.55,
        "very_active": 1.725,
        "athlete": 1.9,
    }
    multiplier = multipliers.get(activity_level or "sedentary", 1.2)
    tdee = round(bmr * multiplier)

    # Macro targets
    protein_g = round(weight_kg * 1.6, 1)          # 1.6g / kg bodyweight
    carbs_g = round((tdee * 0.45) / 4, 1)          # 45% of calories
    fat_g = round((tdee * 0.25) / 9, 1)            # 25% of calories
    water_l = round(weight_kg * 0.033, 2)           # 33ml per kg
    fiber_g = 25.0 if (gender and gender.lower() == "female") else 38.0

    return {
        "calories": tdee,
        "protein": protein_g,
        "carbs": carbs_g,
        "fat": fat_g,
        "water": water_l,
        "fiber": fiber_g,
    }


# ─── GET Current User Profile ────────────────────────────────────────────────

@router.get("/profile", response_model=UserResponse)
def get_profile(
    current_user: User = Depends(get_current_user),
):
    """
    Fetch the full profile of the currently authenticated user.
    """
    return current_user


# ─── UPDATE User Profile ─────────────────────────────────────────────────────

@router.put("/profile", response_model=UserResponse)
def update_profile(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update profile data for the active user.
    Automatically recalculates BMI and nutrition goals whenever
    height, weight, age, gender, or activity_level changes.
    """
    # ── Email uniqueness check ──────────────────────────────────────────────
    if user_update.email and user_update.email != current_user.email:
        email_taken = db.query(User).filter(User.email == user_update.email).first()
        if email_taken:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already in use by another account"
            )
        current_user.email = user_update.email

    # ── Basic profile fields ────────────────────────────────────────────────
    if user_update.age is not None:
        current_user.age = user_update.age
    if user_update.gender is not None:
        current_user.gender = user_update.gender

    # ── Body measurements ───────────────────────────────────────────────────
    body_changed = False
    if user_update.weight_kg is not None:
        current_user.weight_kg = user_update.weight_kg
        body_changed = True
    if user_update.height_cm is not None:
        current_user.height_cm = user_update.height_cm
        body_changed = True
    if user_update.target_weight is not None:
        current_user.target_weight = user_update.target_weight
    if user_update.activity_level is not None:
        current_user.activity_level = user_update.activity_level
        body_changed = True

    # ── Auto-recalculate BMI ────────────────────────────────────────────────
    if body_changed or user_update.age is not None or user_update.gender is not None:
        bmi, category = _calculate_bmi(current_user.weight_kg, current_user.height_cm)
        current_user.bmi = bmi
        current_user.bmi_category = category

        goals = _calculate_nutrition_goals(
            current_user.weight_kg,
            current_user.height_cm,
            current_user.age,
            current_user.gender,
            current_user.activity_level,
        )
        if goals:
            current_user.daily_calorie_target = goals["calories"]
            current_user.protein_goal = goals["protein"]
            current_user.carbs_goal = goals["carbs"]
            current_user.fat_goal = goals["fat"]
            current_user.water_goal = goals["water"]
            current_user.fiber_goal = goals["fiber"]

    # ── Manual calorie override ─────────────────────────────────────────────
    if user_update.daily_calorie_target is not None:
        current_user.daily_calorie_target = user_update.daily_calorie_target

    # ── Preferences ────────────────────────────────────────────────────────
    if user_update.units_preference is not None:
        current_user.units_preference = user_update.units_preference
    if user_update.notif_health is not None:
        current_user.notif_health = user_update.notif_health
    if user_update.notif_calorie_reminders is not None:
        current_user.notif_calorie_reminders = user_update.notif_calorie_reminders
    if user_update.notif_weekly_reports is not None:
        current_user.notif_weekly_reports = user_update.notif_weekly_reports

    # ── Password update ─────────────────────────────────────────────────────
    if user_update.password:
        current_user.hashed_password = get_password_hash(user_update.password)

    db.commit()
    db.refresh(current_user)
    return current_user
