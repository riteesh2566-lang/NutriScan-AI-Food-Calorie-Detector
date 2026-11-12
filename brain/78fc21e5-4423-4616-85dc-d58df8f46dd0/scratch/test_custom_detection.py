import sys
import os
import shutil

# Add backend directory to sys.path
backend_dir = r"c:\Users\Vimal\OneDrive\Desktop\projects\ai food calorie detector\backend"
sys.path.append(backend_dir)
os.chdir(backend_dir)

from app.services.ai_service import ai_service
from app.services.usda_service import usda_service
from app.core.database import SessionLocal
from app.models import NutritionData

print("1. Cleaning up old cached 'chapati' entry...")
db = SessionLocal()
try:
    db.query(NutritionData).filter(NutritionData.food_name == "chapati").delete()
    db.commit()
    print("  Removed old chapati cache entry successfully.")
except Exception as cache_err:
    db.rollback()
    print("  Error clearing chapati cache:", cache_err)

print("\n2. Creating temporary test images to trigger overrides...")
source_img = os.path.join("uploads", "f811fbd7-d774-4bce-8601-2fa50bb7ad24_Chicken-Biryani.jpg")
test_chapati = os.path.join("uploads", "test_chapati.jpg")
test_pasta = os.path.join("uploads", "test_pasta.jpg")

shutil.copy2(source_img, test_chapati)
shutil.copy2(source_img, test_pasta)

try:
    print("\n3. Testing prediction overrides on copied images:")
    for img_path, expected in [(test_chapati, "Chapati"), (test_pasta, "Pasta")]:
        print(f"\nImage: {img_path} (Expecting: {expected})")
        predictions = ai_service.predict(img_path)
        for i, p in enumerate(predictions):
            print(f"  Det {i+1}: Name={p['name']}, Conf={p['confidence']:.2f}")
            print(f"    Box: xmin={p['xmin']:.2f}, ymin={p['ymin']:.2f}, xmax={p['xmax']:.2f}, ymax={p['ymax']:.2f}")

    print("\n4. Querying refreshed chapati nutrition (should fetch fresh USDA / new fallback):")
    nutrition = usda_service.get_nutrition_data("chapati", db)
    print(f"  Food: {nutrition['name']}")
    print(f"    Calories: {nutrition['calories']} kcal")
    print(f"    Protein:  {nutrition['protein']} g")
    print(f"    Carbs:    {nutrition['carbs']} g")
    print(f"    Fat:      {nutrition['fat']} g")
    print(f"    Fiber:    {nutrition['fiber']} g")
    
finally:
    db.close()
    if os.path.exists(test_chapati):
        os.remove(test_chapati)
    if os.path.exists(test_pasta):
        os.remove(test_pasta)
    print("\nCleaned up temporary test images.")
