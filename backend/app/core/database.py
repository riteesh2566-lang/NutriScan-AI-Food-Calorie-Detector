import logging
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

engine = None

# Attempt to connect to the specified database url (MySQL).
# If the connection fails, fall back to SQLite to maintain an instantly running app.
try:
    if settings.DATABASE_URL.startswith("mysql"):
        # Use pymysql and set a 1s connect timeout so fallback triggers fast if MySQL is not running
        engine = create_engine(
            settings.DATABASE_URL,
            pool_pre_ping=True,
            connect_args={"connect_timeout": 1}
        )
        # Test the connection immediately
        with engine.connect() as conn:
            pass
        logger.info("Connected successfully to the MySQL database.")
    else:
        engine = create_engine(settings.DATABASE_URL)
except Exception as e:
    logger.warning(
        f"MySQL Connection failed: {e}. "
        "Falling back to local SQLite database (sqlite:///./food_calorie.db)"
    )
    sqlite_url = "sqlite:///./food_calorie.db"
    # check_same_thread=False is only required for SQLite
    engine = create_engine(
        sqlite_url,
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency to get db session in API endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
