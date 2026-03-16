from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    BACKEND_PORT: int = 8000
    ENVIRONMENT: str = "development"

    # PostgreSQL
    DATABASE_URL: str = "postgresql://admin:password@localhost:5432/signbridge"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # AWS
    AWS_REGION: str = "us-east-1"

    # Auth (JWT)
    JWT_SECRET: str = "change-this-secret-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 24

    # Model
    MODEL_PATH: str = "trained_models/best_model.pt"
    VOCAB_PATH: str = "trained_models/sign_vocab.json"
    CONFIDENCE_THRESHOLD: float = 0.75

    # Cache TTL (in seconds)
    SIGN_CACHE_TTL: int = 3600
    TRANSLATION_CACHE_TTL: int = 86400
    TTS_CACHE_TTL: int = 86400

    # Translation
    DEFAULT_LANGUAGE: str = "en"
    SUPPORTED_LANGUAGES: str = "en,es,fr"

    class Config:
        env_file = ".env"


settings = Settings()
