from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, server_default="1", nullable=False)

    # Basic Profile
    age = Column(Integer, nullable=True)
    gender = Column(String(20), nullable=True)  # 'male' | 'female' | 'other'

    # Body Measurements
    weight_kg = Column(Float, nullable=True)
    height_cm = Column(Float, nullable=True)
    target_weight = Column(Float, nullable=True)
    activity_level = Column(String(30), default='sedentary', nullable=True)
    # sedentary | lightly_active | moderately_active | very_active | athlete

    # Auto-calculated BMI
    bmi = Column(Float, nullable=True)
    bmi_category = Column(String(20), nullable=True)
    # underweight | normal | overweight | obese

    # Daily Nutrition Goals (auto-calculated)
    daily_calorie_target = Column(Integer, default=2000, nullable=False)
    protein_goal = Column(Float, nullable=True)
    carbs_goal = Column(Float, nullable=True)
    fat_goal = Column(Float, nullable=True)
    water_goal = Column(Float, nullable=True)
    fiber_goal = Column(Float, nullable=True)

    # Preferences
    units_preference = Column(String(10), default='metric', nullable=True)
    # metric | imperial

    # Notification Settings
    notif_health = Column(Boolean, default=True, nullable=True)
    notif_calorie_reminders = Column(Boolean, default=True, nullable=True)
    notif_weekly_reports = Column(Boolean, default=True, nullable=True)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=True)

    # Relationships
    history = relationship("FoodHistory", back_populates="user", cascade="all, delete-orphan")


class FoodHistory(Base):
    __tablename__ = "food_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    image_path = Column(String(255), nullable=True)
    total_calories = Column(Float, default=0.0, nullable=False)
    total_protein = Column(Float, default=0.0, nullable=False)
    total_carbs = Column(Float, default=0.0, nullable=False)
    total_fat = Column(Float, default=0.0, nullable=False)
    total_fiber = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="history")
    items = relationship("FoodItem", back_populates="history", cascade="all, delete-orphan")


class FoodItem(Base):
    __tablename__ = "food_items"

    id = Column(Integer, primary_key=True, index=True)
    history_id = Column(Integer, ForeignKey("food_history.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    confidence = Column(Float, nullable=False)
    
    # Bounding box coordinates (normalized or absolute float values)
    xmin = Column(Float, nullable=False)
    ymin = Column(Float, nullable=False)
    xmax = Column(Float, nullable=False)
    ymax = Column(Float, nullable=False)
    
    # User adjustable portion variables
    quantity = Column(Float, default=1.0, nullable=False)
    serving_size = Column(String(50), default="100g", nullable=False)
    
    # Nutritional values (scaled based on quantity)
    calories = Column(Float, default=0.0, nullable=False)
    protein = Column(Float, default=0.0, nullable=False)
    carbs = Column(Float, default=0.0, nullable=False)
    fat = Column(Float, default=0.0, nullable=False)
    fiber = Column(Float, default=0.0, nullable=False)

    # Relationships
    history = relationship("FoodHistory", back_populates="items")


class NutritionData(Base):
    __tablename__ = "nutrition_data"

    id = Column(Integer, primary_key=True, index=True)
    food_name = Column(String(100), unique=True, index=True, nullable=False)
    calories = Column(Float, default=0.0, nullable=False)
    protein = Column(Float, default=0.0, nullable=False)
    carbs = Column(Float, default=0.0, nullable=False)
    fat = Column(Float, default=0.0, nullable=False)
    fiber = Column(Float, default=0.0, nullable=False)
    serving_size = Column(String(50), default="100g", nullable=False)
    usda_fdc_id = Column(String(20), nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
