from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

# Token Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None


# User Schemas
class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    daily_calorie_target: Optional[int] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    target_weight: Optional[float] = None
    activity_level: Optional[str] = None
    units_preference: Optional[str] = None
    notif_health: Optional[bool] = None
    notif_calorie_reminders: Optional[bool] = None
    notif_weekly_reports: Optional[bool] = None
    password: Optional[str] = None

class UserResponse(UserBase):
    id: int
    is_admin: bool = False
    is_active: bool = True
    age: Optional[int] = None
    gender: Optional[str] = None
    daily_calorie_target: int
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    target_weight: Optional[float] = None
    activity_level: Optional[str] = None
    bmi: Optional[float] = None
    bmi_category: Optional[str] = None
    protein_goal: Optional[float] = None
    carbs_goal: Optional[float] = None
    fat_goal: Optional[float] = None
    water_goal: Optional[float] = None
    fiber_goal: Optional[float] = None
    units_preference: Optional[str] = None
    notif_health: Optional[bool] = None
    notif_calorie_reminders: Optional[bool] = None
    notif_weekly_reports: Optional[bool] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Food Item Schemas
class FoodItemBase(BaseModel):
    name: str
    confidence: float
    xmin: float
    ymin: float
    xmax: float
    ymax: float
    quantity: float
    serving_size: str
    calories: float
    protein: float
    carbs: float
    fat: float
    fiber: float

class FoodItemCreate(FoodItemBase):
    pass

class FoodItemUpdate(BaseModel):
    quantity: float
    name: Optional[str] = None

class FoodItemResponse(FoodItemBase):
    id: int
    history_id: int

    class Config:
        from_attributes = True


# Food History Schemas
class FoodHistoryBase(BaseModel):
    image_path: Optional[str] = None
    total_calories: float
    total_protein: float
    total_carbs: float
    total_fat: float
    total_fiber: float

class FoodHistoryCreate(FoodHistoryBase):
    user_id: int

class FoodHistoryResponse(FoodHistoryBase):
    id: int
    user_id: int
    created_at: datetime
    items: List[FoodItemResponse] = []

    class Config:
        from_attributes = True


# Reports Schemas
class DailyCalorieSummary(BaseModel):
    date: str
    calories: float
    target: float

class MacroSummary(BaseModel):
    protein: float
    carbs: float
    fat: float
    fiber: float

class WeeklyReport(BaseModel):
    daily_summaries: List[DailyCalorieSummary]
    weekly_macros: MacroSummary
    average_calories: float
