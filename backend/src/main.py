import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .services.cache_service import CacheService
from .services.db_service import DatabaseService
from .services.model_service import ModelService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global service instances
model_service = ModelService()
cache_service = CacheService()
db_service = DatabaseService()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Sign Language Bridge API...")

    # Connect PostgreSQL
    try:
        await db_service.connect(settings.DATABASE_URL)
        logger.info("PostgreSQL connected")
    except Exception as e:
        logger.error(f"PostgreSQL connection failed: {e}")

    # Connect Redis
    try:
        cache_service.connect(settings.REDIS_URL)
        logger.info("Redis connected")
    except Exception as e:
        logger.error(f"Redis connection failed: {e}")

    # Load ML model (falls back to demo mode if .pt file is missing)
    try:
        model_service.load_model(settings.MODEL_PATH, settings.VOCAB_PATH)
        logger.info(
            "MODEL STATUS: loaded=%s demo=%s seq_len=%d vocab_size=%d",
            model_service.model_loaded,
            model_service.demo_mode,
            model_service.sequence_length,
            len(model_service.vocab) if model_service.vocab else 0,
        )
        if model_service.demo_mode:
            logger.info("ML model running in DEMO mode (no .pt file)")
        else:
            logger.info("ML model loaded")
    except Exception as e:
        logger.warning(f"Model loading failed (will run without inference): {e}")

    yield

    # Shutdown
    logger.info("Shutting down...")
    await db_service.disconnect()
    cache_service.disconnect()


app = FastAPI(title="Sign Language Bridge", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and register routes
from .api.routes import health, signs, translate, tts, auth, sessions
from .api.routes.websocket import router as ws_router

app.include_router(health.router, prefix="/api")
app.include_router(signs.router, prefix="/api")
app.include_router(translate.router, prefix="/api")
app.include_router(tts.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")
app.include_router(ws_router)


@app.get("/")
async def root():
    return {
        "message": "Sign Language Bridge API",
        "docs": "/docs",
        "health": "/api/health",
    }
