import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

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

    # Production safety: reject weak JWT_SECRET
    if settings.ENVIRONMENT == "production" and settings.JWT_SECRET == "change-this-secret-in-production":
        raise ValueError(
            "JWT_SECRET must be set to a strong random value in production. "
            "Generate with: python -c \"import secrets; print(secrets.token_hex(32))\""
        )

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

# Rate limiting: 100/min per IP globally
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Security headers
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

# CORS: use CORS_ORIGINS env var (comma-separated)
_cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
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
