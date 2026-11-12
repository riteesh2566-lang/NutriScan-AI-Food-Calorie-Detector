import os
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models import User, FoodHistory, FoodItem, NutritionData
from app.schemas import FoodHistoryResponse, FoodItemResponse, FoodItemUpdate
from app.services.ai_service import ai_service
from app.services.usda_service import usda_service

router = APIRouter()

@router.post("/predict", response_model=FoodHistoryResponse, status_code=status.HTTP_201_CREATED)
async def predict_food_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload an image, run YOLOv8 and MobileNetV2 detection, query USDA API for nutritional breakdown,
    and save the session log as a FoodHistory record.
    """
    # Create upload directory if it does not exist
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    # Save the file with a unique name to prevent collisions, preserving the original filename keywords for simulated AI fallback
    import re
    safe_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', file.filename)
    unique_filename = f"{uuid.uuid4()}_{safe_name}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)
    
    try:
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not save uploaded image file: {e}"
        )

    # 1. Run AI Service prediction to detect food objects and their bounding boxes
    try:
        detections = ai_service.predict(file_path)
    except Exception as ai_err:
        import logging
        logging.getLogger(__name__).error(f"AI pipeline inference error: {ai_err}. Falling back to simulation.")
        detections = ai_service._predict_simulated(file_path)

    # Convert the file path to a web accessible format (using forward slashes)
    web_image_path = f"/uploads/{unique_filename}"

    # 2. Process each detection: look up nutrition values and aggregate
    total_cals = 0.0
    total_prot = 0.0
    total_carbs = 0.0
    total_fat = 0.0
    total_fib = 0.0

    food_items_to_create = []

    for det in detections:
        food_name = det["name"]
        confidence = det["confidence"]
        
        # Query USDA or cache
        nutrition = usda_service.get_nutrition_data(food_name, db)
        
        # Quantities default to 1.0 serving (100g)
        item_qty = 1.0
        
        # Calculate scaled nutrients
        item_cals = nutrition["calories"] * item_qty
        item_prot = nutrition["protein"] * item_qty
        item_carbs = nutrition["carbs"] * item_qty
        item_fat = nutrition["fat"] * item_qty
        item_fib = nutrition["fiber"] * item_qty

        # Aggregate total meal nutrition
        total_cals += item_cals
        total_prot += item_prot
        total_carbs += item_carbs
        total_fat += item_fat
        total_fib += item_fib

        food_item = FoodItem(
            name=food_name,
            confidence=confidence,
            xmin=det["xmin"],
            ymin=det["ymin"],
            xmax=det["xmax"],
            ymax=det["ymax"],
            quantity=item_qty,
            serving_size=nutrition["serving_size"],
            calories=item_cals,
            protein=item_prot,
            carbs=item_carbs,
            fat=item_fat,
            fiber=item_fib
        )
        food_items_to_create.append(food_item)

    # 3. Create the FoodHistory log
    db_history = FoodHistory(
        user_id=current_user.id,
        image_path=web_image_path,
        total_calories=total_cals,
        total_protein=total_prot,
        total_carbs=total_carbs,
        total_fat=total_fat,
        total_fiber=total_fib
    )
    
    db.add(db_history)
    db.commit()
    db.refresh(db_history)

    # Bind the food items to history log
    for item in food_items_to_create:
        item.history_id = db_history.id
        db.add(item)
    
    db.commit()
    db.refresh(db_history)

    return db_history

@router.get("/history", response_model=List[FoodHistoryResponse])
def get_food_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all logged food history entries for the current authenticated user,
    ordered from newest to oldest.
    """
    return db.query(FoodHistory).filter(
        FoodHistory.user_id == current_user.id
    ).order_by(FoodHistory.created_at.desc()).all()

@router.put("/item/{item_id}", response_model=FoodItemResponse)
def update_food_item_quantity(
    item_id: int,
    item_update: FoodItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates the quantity of a specific logged food item and recalculates the item's
    macros and the history card's cumulative values.
    """
    # Verify the food item belongs to the logged-in user
    item = db.query(FoodItem).join(FoodHistory).filter(
        FoodItem.id == item_id,
        FoodHistory.user_id == current_user.id
    ).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Logged food item not found or unauthorized access"
        )

    new_qty = item_update.quantity
    if new_qty < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity cannot be negative"
        )

    # If name is updated, change it on the food item
    if item_update.name and item_update.name.strip() != "":
        item.name = item_update.name.strip()

    # Get base values from usda_service (handles cache and USDA API lookups)
    base_data = usda_service.get_nutrition_data(item.name, db)
    
    item.quantity = new_qty
    item.serving_size = base_data.get("serving_size", "100g")
    item.calories = base_data.get("calories", 0.0) * new_qty
    item.protein = base_data.get("protein", 0.0) * new_qty
    item.carbs = base_data.get("carbs", 0.0) * new_qty
    item.fat = base_data.get("fat", 0.0) * new_qty
    item.fiber = base_data.get("fiber", 0.0) * new_qty

    db.commit()
    db.refresh(item)

    # Recalculate parent history cumulative metrics
    history = db.query(FoodHistory).filter(FoodHistory.id == item.history_id).first()
    if history:
        all_items = db.query(FoodItem).filter(FoodItem.history_id == history.id).all()
        history.total_calories = sum(it.calories for it in all_items)
        history.total_protein = sum(it.protein for it in all_items)
        history.total_carbs = sum(it.carbs for it in all_items)
        history.total_fat = sum(it.fat for it in all_items)
        history.total_fiber = sum(it.fiber for it in all_items)
        db.commit()
        db.refresh(history)

    return item

@router.delete("/history/{history_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_food_history(
    history_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Deletes a specific food history entry, its corresponding uploaded image file,
    and all associated food item detections.
    """
    history = db.query(FoodHistory).filter(
        FoodHistory.id == history_id,
        FoodHistory.user_id == current_user.id
    ).first()

    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Food history log not found or unauthorized access"
        )

    # Delete the local uploaded file if it exists
    if history.image_path:
        # Convert web path /uploads/filename back to filesystem path
        filename = os.path.basename(history.image_path)
        file_path = os.path.join(settings.UPLOAD_DIR, filename)
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            logger.error(f"Could not delete image file {file_path}: {e}")

    # Remove history entry (cascades deletes to FoodItems via relationship setup)
    db.delete(history)
    db.commit()
    return

@router.get("/nutrition-lookup")
def lookup_nutrition(
    food_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Look up nutrition values for a food name (queries database cache or USDA API).
    """
    return usda_service.get_nutrition_data(food_name, db)
