import os
from typing import Optional
try:
    from pydantic_settings import BaseSettings
except ImportError:
    from pydantic import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Food Detection & Calorie Calculator"
    API_V1_STR: str = "/api"
    
    # JWT security settings
    JWT_SECRET: str = "super-secret-key-change-in-production-123456"
    SECRET_KEY: str = "super-secret-key-change-in-production-123456"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days
    
    # Database URL: SQLite by default when running locally; overridden by DATABASE_URL env var if set
    DATABASE_URL: str = "sqlite:///./food_calorie.db"
    
    # USDA API Key
    USDA_API_KEY: str = "DEMO_KEY"
    
    # Upload and model configuration
    UPLOAD_DIR: str = "uploads"
    MODEL_DIR: str = "models"
    
    class Config:
        env_file = ".env"
        extra = "ignore"
        case_sensitive = False

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.JWT_SECRET and self.SECRET_KEY == "super-secret-key-change-in-production-123456":
            self.SECRET_KEY = self.JWT_SECRET

settings = Settings()
