import sys
import os

# Add backend directory to sys.path so we can import app modules
backend_dir = r"c:\Users\Vimal\OneDrive\Desktop\projects\ai food calorie detector\backend"
sys.path.append(backend_dir)

# Set working directory to backend so config file loads and paths resolve correctly
os.chdir(backend_dir)

from app.services.ai_service import ai_service

test_image = os.path.join("uploads", "f89e15d0-7338-4c9c-a19c-ebf6a3941efa_pizza.jpg")

print("Running prediction on:", test_image)
if not os.path.exists(test_image):
    print("Error: Test image does not exist.")
    sys.exit(1)
    
try:
    predictions = ai_service.predict(test_image)
    print("\nPrediction Output:")
    for i, p in enumerate(predictions):
        print(f"Detection {i+1}:")
        print(f"  Name:       {p['name']}")
        print(f"  Confidence: {p['confidence']:.2f}")
        print(f"  Box:        xmin={p['xmin']:.2f}, ymin={p['ymin']:.2f}, xmax={p['xmax']:.2f}, ymax={p['ymax']:.2f}")
except Exception as e:
    print("Prediction failed:", e)
