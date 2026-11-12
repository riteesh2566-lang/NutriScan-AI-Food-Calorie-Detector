import logging
import requests
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models import NutritionData

logger = logging.getLogger(__name__)

# Fallback values per 100g for common Food-101 classes if API is offline or key is rate-limited
DEFAULT_NUTRITION_MAPPING = {
    "chapati": {"calories": 275, "protein": 8.0, "carbs": 55.0, "fat": 3.0, "fiber": 4.0},
    "roti": {"calories": 275, "protein": 8.0, "carbs": 55.0, "fat": 3.0, "fiber": 4.0},
    "pasta": {"calories": 131, "protein": 5.0, "carbs": 25.0, "fat": 1.1, "fiber": 1.8},
    "dosa": {"calories": 168, "protein": 3.9, "carbs": 29.0, "fat": 3.7, "fiber": 1.0},
    "idli": {"calories": 124, "protein": 4.0, "carbs": 25.0, "fat": 0.5, "fiber": 1.5},
    "biryani": {"calories": 215, "protein": 14.5, "carbs": 23.0, "fat": 7.5, "fiber": 1.5},
    "biriyani": {"calories": 215, "protein": 14.5, "carbs": 23.0, "fat": 7.5, "fiber": 1.5},
    "briyani": {"calories": 215, "protein": 14.5, "carbs": 23.0, "fat": 7.5, "fiber": 1.5},
    "chicken biryani": {"calories": 215, "protein": 14.5, "carbs": 23.0, "fat": 7.5, "fiber": 1.5},
    "chicken biriyani": {"calories": 215, "protein": 14.5, "carbs": 23.0, "fat": 7.5, "fiber": 1.5},
    "chiken biriyani": {"calories": 215, "protein": 14.5, "carbs": 23.0, "fat": 7.5, "fiber": 1.5},
    "apple pie": {"calories": 237, "protein": 2.4, "carbs": 34.0, "fat": 11.0, "fiber": 1.5},
    "baby back ribs": {"calories": 292, "protein": 21.0, "carbs": 0.0, "fat": 23.0, "fiber": 0.0},
    "baklava": {"calories": 432, "protein": 6.0, "carbs": 53.0, "fat": 22.0, "fiber": 3.4},
    "beef carpaccio": {"calories": 140, "protein": 22.0, "carbs": 0.0, "fat": 5.0, "fiber": 0.0},
    "beef tartare": {"calories": 160, "protein": 20.0, "carbs": 1.0, "fat": 8.0, "fiber": 0.0},
    "beet salad": {"calories": 95, "protein": 1.8, "carbs": 11.0, "fat": 5.0, "fiber": 2.2},
    "beignets": {"calories": 380, "protein": 6.0, "carbs": 52.0, "fat": 16.0, "fiber": 1.2},
    "bibimbap": {"calories": 135, "protein": 6.0, "carbs": 21.0, "fat": 3.0, "fiber": 1.5},
    "bread pudding": {"calories": 250, "protein": 4.5, "carbs": 42.0, "fat": 7.0, "fiber": 1.0},
    "bruschetta": {"calories": 180, "protein": 4.0, "carbs": 22.0, "fat": 8.0, "fiber": 1.5},
    "caesar salad": {"calories": 44, "protein": 2.1, "carbs": 3.7, "fat": 2.5, "fiber": 1.2},
    "caprese salad": {"calories": 130, "protein": 6.0, "carbs": 4.0, "fat": 11.0, "fiber": 0.8},
    "carrot cake": {"calories": 387, "protein": 3.6, "carbs": 51.0, "fat": 19.0, "fiber": 2.0},
    "ceviche": {"calories": 98, "protein": 15.0, "carbs": 4.0, "fat": 2.0, "fiber": 0.5},
    "cheesecake": {"calories": 321, "protein": 5.5, "carbs": 26.0, "fat": 22.0, "fiber": 0.4},
    "cheese plate": {"calories": 380, "protein": 22.0, "carbs": 2.0, "fat": 31.0, "fiber": 0.0},
    "chicken curry": {"calories": 130, "protein": 12.0, "carbs": 8.0, "fat": 6.0, "fiber": 1.5},
    "chicken quesadilla": {"calories": 280, "protein": 15.0, "carbs": 23.0, "fat": 14.0, "fiber": 1.5},
    "chicken wings": {"calories": 290, "protein": 23.0, "carbs": 1.0, "fat": 21.0, "fiber": 0.0},
    "chocolate cake": {"calories": 389, "protein": 3.5, "carbs": 53.0, "fat": 19.0, "fiber": 1.6},
    "chocolate mousse": {"calories": 225, "protein": 4.5, "carbs": 22.0, "fat": 14.0, "fiber": 0.8},
    "churros": {"calories": 360, "protein": 4.0, "carbs": 48.0, "fat": 17.0, "fiber": 1.5},
    "clam chowder": {"calories": 85, "protein": 4.0, "carbs": 9.0, "fat": 4.0, "fiber": 0.5},
    "club sandwich": {"calories": 220, "protein": 12.0, "carbs": 20.0, "fat": 10.0, "fiber": 1.8},
    "crab cakes": {"calories": 210, "protein": 15.0, "carbs": 12.0, "fat": 11.0, "fiber": 0.8},
    "creme brulee": {"calories": 310, "protein": 4.0, "carbs": 30.0, "fat": 20.0, "fiber": 0.0},
    "croque madame": {"calories": 260, "protein": 14.0, "carbs": 21.0, "fat": 13.0, "fiber": 1.0},
    "cup cakes": {"calories": 380, "protein": 3.0, "carbs": 55.0, "fat": 16.0, "fiber": 0.5},
    "deviled eggs": {"calories": 200, "protein": 12.0, "carbs": 1.0, "fat": 16.0, "fiber": 0.0},
    "donuts": {"calories": 426, "protein": 5.7, "carbs": 51.0, "fat": 23.0, "fiber": 1.8},
    "dumplings": {"calories": 175, "protein": 8.0, "carbs": 25.0, "fat": 5.0, "fiber": 1.2},
    "edamame": {"calories": 122, "protein": 11.0, "carbs": 10.0, "fat": 5.0, "fiber": 5.2},
    "eggs benedict": {"calories": 196, "protein": 10.0, "carbs": 12.0, "fat": 13.0, "fiber": 0.5},
    "escargots": {"calories": 90, "protein": 16.0, "carbs": 2.0, "fat": 2.0, "fiber": 0.0},
    "falafel": {"calories": 333, "protein": 13.0, "carbs": 32.0, "fat": 18.0, "fiber": 4.9},
    "filet mignon": {"calories": 220, "protein": 26.0, "carbs": 0.0, "fat": 12.0, "fiber": 0.0},
    "fish and chips": {"calories": 230, "protein": 11.0, "carbs": 22.0, "fat": 11.0, "fiber": 1.5},
    "foie gras": {"calories": 462, "protein": 11.0, "carbs": 5.0, "fat": 44.0, "fiber": 0.0},
    "french fries": {"calories": 312, "protein": 3.4, "carbs": 41.0, "fat": 15.0, "fiber": 3.8},
    "french onion soup": {"calories": 65, "protein": 4.0, "carbs": 6.0, "fat": 3.0, "fiber": 0.8},
    "french toast": {"calories": 229, "protein": 6.0, "carbs": 29.0, "fat": 9.0, "fiber": 1.5},
    "fried calamari": {"calories": 175, "protein": 15.0, "carbs": 8.0, "fat": 9.0, "fiber": 0.5},
    "fried rice": {"calories": 163, "protein": 4.1, "carbs": 28.0, "fat": 3.8, "fiber": 1.2},
    "frozen yogurt": {"calories": 159, "protein": 4.0, "carbs": 24.0, "fat": 5.6, "fiber": 0.0},
    "garlic bread": {"calories": 350, "protein": 8.0, "carbs": 46.0, "fat": 16.0, "fiber": 2.5},
    "gnocchi": {"calories": 132, "protein": 3.5, "carbs": 28.0, "fat": 0.5, "fiber": 1.5},
    "greek salad": {"calories": 90, "protein": 2.0, "carbs": 5.0, "fat": 7.0, "fiber": 1.5},
    "grilled cheese sandwich": {"calories": 378, "protein": 12.0, "carbs": 33.0, "fat": 21.0, "fiber": 2.0},
    "grilled salmon": {"calories": 206, "protein": 22.0, "carbs": 0.0, "fat": 12.0, "fiber": 0.0},
    "guacamole": {"calories": 157, "protein": 2.0, "carbs": 9.0, "fat": 15.0, "fiber": 7.0},
    "gyoza": {"calories": 180, "protein": 8.0, "carbs": 24.0, "fat": 6.0, "fiber": 1.2},
    "hamburger": {"calories": 295, "protein": 17.0, "carbs": 24.0, "fat": 14.0, "fiber": 1.5},
    "hot and sour soup": {"calories": 50, "protein": 3.0, "carbs": 6.0, "fat": 1.5, "fiber": 0.8},
    "hot dog": {"calories": 290, "protein": 10.0, "carbs": 18.0, "fat": 20.0, "fiber": 0.8},
    "hummus": {"calories": 166, "protein": 8.0, "carbs": 14.0, "fat": 10.0, "fiber": 6.0},
    "ice cream": {"calories": 207, "protein": 3.5, "carbs": 24.0, "fat": 11.0, "fiber": 0.7},
    "lasagna": {"calories": 135, "protein": 8.0, "carbs": 14.0, "fat": 5.0, "fiber": 1.2},
    "lobster bisque": {"calories": 110, "protein": 6.0, "carbs": 8.0, "fat": 6.0, "fiber": 0.5},
    "lobster roll sandwich": {"calories": 240, "protein": 14.0, "carbs": 24.0, "fat": 10.0, "fiber": 1.2},
    "macaroni and cheese": {"calories": 164, "protein": 7.0, "carbs": 20.0, "fat": 6.0, "fiber": 0.8},
    "macarons": {"calories": 400, "protein": 7.0, "carbs": 57.0, "fat": 16.0, "fiber": 2.0},
    "miso soup": {"calories": 36, "protein": 3.0, "carbs": 4.0, "fat": 1.0, "fiber": 0.5},
    "mussels": {"calories": 172, "protein": 24.0, "carbs": 7.0, "fat": 4.5, "fiber": 0.0},
    "nachos": {"calories": 306, "protein": 8.0, "carbs": 33.0, "fat": 16.0, "fiber": 3.0},
    "omelette": {"calories": 154, "protein": 11.0, "carbs": 0.6, "fat": 12.0, "fiber": 0.0},
    "onion rings": {"calories": 411, "protein": 4.0, "carbs": 48.0, "fat": 22.0, "fiber": 3.0},
    "oysters": {"calories": 81, "protein": 9.0, "carbs": 5.0, "fat": 2.5, "fiber": 0.0},
    "pad thai": {"calories": 200, "protein": 8.0, "carbs": 34.0, "fat": 4.0, "fiber": 1.5},
    "paella": {"calories": 156, "protein": 10.0, "carbs": 21.0, "fat": 3.5, "fiber": 1.2},
    "pancakes": {"calories": 227, "protein": 6.0, "carbs": 28.0, "fat": 10.0, "fiber": 1.4},
    "panna cotta": {"calories": 220, "protein": 3.0, "carbs": 22.0, "fat": 13.0, "fiber": 0.0},
    "peking duck": {"calories": 337, "protein": 19.0, "carbs": 0.0, "fat": 28.0, "fiber": 0.0},
    "pho": {"calories": 80, "protein": 6.0, "carbs": 10.0, "fat": 2.0, "fiber": 0.8},
    "pizza": {"calories": 266, "protein": 11.0, "carbs": 33.0, "fat": 10.0, "fiber": 2.3},
    "pork chop": {"calories": 230, "protein": 24.0, "carbs": 0.0, "fat": 14.0, "fiber": 0.0},
    "poutine": {"calories": 240, "protein": 6.0, "carbs": 28.0, "fat": 11.0, "fiber": 2.0},
    "prime rib": {"calories": 380, "protein": 17.0, "carbs": 0.0, "fat": 35.0, "fiber": 0.0},
    "pulled pork sandwich": {"calories": 230, "protein": 14.0, "carbs": 28.0, "fat": 7.0, "fiber": 1.5},
    "ramen": {"calories": 110, "protein": 5.0, "carbs": 16.0, "fat": 3.0, "fiber": 0.8},
    "ravioli": {"calories": 170, "protein": 8.0, "carbs": 26.0, "fat": 4.0, "fiber": 1.5},
    "red velvet cake": {"calories": 367, "protein": 4.0, "carbs": 53.0, "fat": 15.0, "fiber": 1.0},
    "risotto": {"calories": 145, "protein": 4.0, "carbs": 22.0, "fat": 4.5, "fiber": 0.8},
    "samosa": {"calories": 260, "protein": 4.0, "carbs": 30.0, "fat": 14.0, "fiber": 2.5},
    "sashimi": {"calories": 120, "protein": 20.0, "carbs": 0.0, "fat": 4.0, "fiber": 0.0},
    "scallops": {"calories": 110, "protein": 20.0, "carbs": 3.0, "fat": 1.0, "fiber": 0.0},
    "seaweed salad": {"calories": 90, "protein": 1.0, "carbs": 10.0, "fat": 5.0, "fiber": 3.0},
    "shrimp and grits": {"calories": 180, "protein": 12.0, "carbs": 16.0, "fat": 8.0, "fiber": 1.0},
    "spaghetti bolognese": {"calories": 150, "protein": 7.0, "carbs": 20.0, "fat": 5.0, "fiber": 1.8},
    "spaghetti carbonara": {"calories": 220, "protein": 10.0, "carbs": 22.0, "fat": 10.0, "fiber": 1.0},
    "spring rolls": {"calories": 150, "protein": 4.0, "carbs": 20.0, "fat": 6.0, "fiber": 1.5},
    "steak": {"calories": 271, "protein": 25.0, "carbs": 0.0, "fat": 19.0, "fiber": 0.0},
    "strawberry shortcake": {"calories": 290, "protein": 3.0, "carbs": 44.0, "fat": 11.0, "fiber": 1.5},
    "sushi": {"calories": 130, "protein": 5.0, "carbs": 23.0, "fat": 1.0, "fiber": 1.0},
    "tacos": {"calories": 226, "protein": 9.0, "carbs": 20.0, "fat": 13.0, "fiber": 3.0},
    "takoyaki": {"calories": 160, "protein": 6.0, "carbs": 20.0, "fat": 6.0, "fiber": 1.0},
    "tiramisu": {"calories": 354, "protein": 6.0, "carbs": 38.0, "fat": 20.0, "fiber": 0.8},
    "tuna tartare": {"calories": 130, "protein": 19.0, "carbs": 2.0, "fat": 5.0, "fiber": 0.5},
    "waffles": {"calories": 291, "protein": 8.0, "carbs": 33.0, "fat": 14.0, "fiber": 1.5},
    # Common standard simple single foods
    "apple": {"calories": 52, "protein": 0.3, "carbs": 14.0, "fat": 0.2, "fiber": 2.4},
    "banana": {"calories": 89, "protein": 1.1, "carbs": 23.0, "fat": 0.3, "fiber": 2.6},
    "orange": {"calories": 47, "protein": 0.9, "carbs": 12.0, "fat": 0.1, "fiber": 2.4},
    "broccoli": {"calories": 34, "protein": 2.8, "carbs": 7.0, "fat": 0.4, "fiber": 2.6},
    "carrot": {"calories": 41, "protein": 0.9, "carbs": 10.0, "fat": 0.2, "fiber": 2.8},
}

class USDAService:
    @staticmethod
    def get_nutrition_data(food_name: str, db: Session) -> Dict[str, Any]:
        """
        Looks up food items' nutrition values (calories, protein, carbs, fat, fiber) per 100g.
        Algorithm:
        1. Checks database cache (NutritionData table).
        2. If missing, queries USDA FDC API.
        3. If API query fails or is not configured, fetches from local DEFAULT_NUTRITION_MAPPING.
        4. Caches new entries in the database.
        """
        food_name_clean = food_name.strip().lower()
        
        # 1. Check local DB cache
        cached_data = db.query(NutritionData).filter(NutritionData.food_name == food_name_clean).first()
        if cached_data:
            logger.info(f"Nutrition cache hit for: {food_name_clean}")
            return {
                "name": food_name,
                "calories": cached_data.calories,
                "protein": cached_data.protein,
                "carbs": cached_data.carbs,
                "fat": cached_data.fat,
                "fiber": cached_data.fiber,
                "serving_size": cached_data.serving_size,
                "fdc_id": cached_data.usda_fdc_id
            }

        logger.info(f"Cache miss for: {food_name_clean}. Querying USDA FoodData Central...")
        
        # 2. Query USDA API
        parsed_data = None
        
        # Build query params
        api_key = settings.USDA_API_KEY
        # If API key is still DEMO_KEY, the API might throttle quickly but it is still functional
        url = "https://api.nal.usda.gov/fdc/v1/foods/search"
        params = {
            "query": food_name_clean,
            "api_key": api_key,
            "pageSize": 1,
            "dataType": "Survey (FNDDS)" # Good for common recipes and foods
        }

        try:
            # We set a reasonable timeout (3 seconds) so we don't delay backend actions if API hangs
            response = requests.get(url, params=params, timeout=3.0)
            if response.status_code == 200:
                data = response.json()
                if "foods" in data and len(data["foods"]) > 0:
                    food_item = data["foods"][0]
                    fdc_id = str(food_item.get("fdcId", ""))
                    
                    # Initialize default values
                    nutrients = {
                        "calories": 0.0,
                        "protein": 0.0,
                        "carbs": 0.0,
                        "fat": 0.0,
                        "fiber": 0.0
                    }
                    
                    # Nutrient mappings based on standard IDs in USDA FDC
                    # Calories: 1008 (KCAL), Protein: 1003 (g), Carbs: 1005 (g), Fat: 1004 (g), Fiber: 1079 (g)
                    for nutrient in food_item.get("foodNutrients", []):
                        n_id = nutrient.get("nutrientId")
                        val = float(nutrient.get("value", 0.0))
                        
                        if n_id == 1008:
                            nutrients["calories"] = val
                        elif n_id == 1003:
                            nutrients["protein"] = val
                        elif n_id == 1005:
                            nutrients["carbs"] = val
                        elif n_id == 1004:
                            nutrients["fat"] = val
                        elif n_id == 1079:
                            nutrients["fiber"] = val
                    
                    parsed_data = {
                        "calories": nutrients["calories"],
                        "protein": nutrients["protein"],
                        "carbs": nutrients["carbs"],
                        "fat": nutrients["fat"],
                        "fiber": nutrients["fiber"],
                        "serving_size": "100g",
                        "fdc_id": fdc_id
                    }
                    logger.info(f"Retrieved USDA nutrition for {food_name_clean} (FDC ID: {fdc_id})")
        except Exception as e:
            logger.error(f"Error querying USDA FDC API for {food_name_clean}: {e}")

        # 3. If API fails, fall back to our pre-defined local dictionary
        if not parsed_data:
            logger.warning(f"USDA lookup failed. Using local fallback map for: {food_name_clean}")
            # Find best match from dictionary keys
            fallback = DEFAULT_NUTRITION_MAPPING.get(food_name_clean)
            if not fallback:
                # Try partial match
                for key in DEFAULT_NUTRITION_MAPPING.keys():
                    if key in food_name_clean or food_name_clean in key:
                        fallback = DEFAULT_NUTRITION_MAPPING[key]
                        break
            
            if not fallback:
                # Default generic item if unknown
                fallback = {"calories": 150, "protein": 5.0, "carbs": 18.0, "fat": 6.0, "fiber": 1.0}
            
            parsed_data = {
                "calories": float(fallback["calories"]),
                "protein": float(fallback["protein"]),
                "carbs": float(fallback["carbs"]),
                "fat": float(fallback["fat"]),
                "fiber": float(fallback["fiber"]),
                "serving_size": "100g",
                "fdc_id": None
            }

        # 4. Cache in database
        try:
            new_data = NutritionData(
                food_name=food_name_clean,
                calories=parsed_data["calories"],
                protein=parsed_data["protein"],
                carbs=parsed_data["carbs"],
                fat=parsed_data["fat"],
                fiber=parsed_data["fiber"],
                serving_size=parsed_data["serving_size"],
                usda_fdc_id=parsed_data["fdc_id"]
            )
            db.add(new_data)
            db.commit()
            db.refresh(new_data)
            logger.info(f"Cached nutrition for: {food_name_clean}")
        except Exception as cache_err:
            db.rollback()
            logger.error(f"Failed to cache nutrition for {food_name_clean} (might be unique constraint duplicate): {cache_err}")

        return {
            "name": food_name,
            **parsed_data
        }

usda_service = USDAService()
