import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.database import engine, Base
from app.api import auth, users, food, reports, admin

# Automatically create database tables (runs on startup)
Base.metadata.create_all(bind=engine)

# ── Migration: add is_active column if missing (create_all won't ALTER) ──────
try:
    from sqlalchemy import inspect as sa_inspect, text
    _insp = sa_inspect(engine)
    if _insp.has_table("users"):
        _user_cols = [c["name"] for c in _insp.get_columns("users")]
        if "is_active" not in _user_cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1"))
                conn.commit()
except Exception as _mig_err:
    import logging
    logging.warning(f"DB Migration check skipped: {_mig_err}")

# Seed default administrator account if not present
from app.core.database import SessionLocal
from app.models import User
from app.core.security import get_password_hash

db = SessionLocal()
try:
    admin_user = db.query(User).filter(User.username == "admin").first()
    if not admin_user:
        admin_user = User(
            username="admin",
            email="admin@nutriscan.ai",
            hashed_password=get_password_hash("adminpassword"),
            is_admin=True,
            daily_calorie_target=2000
        )
        db.add(admin_user)
        db.commit()
finally:
    db.close()


# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for food detection using YOLOv8 and classification with MobileNetV2.",
    version="1.0.0"
)

# Set up CORS middleware to allow frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the static directory containing user food images
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include api routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["users"])
app.include_router(food.router, prefix=f"{settings.API_V1_STR}/food", tags=["food"])
app.include_router(reports.router, prefix=f"{settings.API_V1_STR}/reports", tags=["reports"])
app.include_router(admin.router, prefix=f"{settings.API_V1_STR}/admin", tags=["admin"])

# ── Serve the Frontend SPA ─────────────────────────────────────────────────
# Resolve the frontend directory relative to this file (works in dev & docker)
_FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend"

if _FRONTEND_DIR.exists():
    # Serve index.html at root
    @app.get("/", include_in_schema=False)
    def serve_spa():
        return FileResponse(str(_FRONTEND_DIR / "index.html"))

    # Catch-all for SPA deep links (must be LAST mount)
    app.mount("/", StaticFiles(directory=str(_FRONTEND_DIR), html=True), name="frontend")
else:
    @app.get("/")
    def read_root():
        return {
            "status": "online",
            "message": f"Welcome to {settings.PROJECT_NAME} API. Access docs at /docs"
        }
