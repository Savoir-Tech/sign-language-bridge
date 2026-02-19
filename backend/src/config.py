from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    BACKEND_PORT: int = 8000
    ENVIRONMENT: str = "development"
    REDIS_URL: str = "redis://localhost:6379"
    AWS_REGION: str = "us-east-1"
    MODEL_PATH: str = "trained_models/asl_classifier.pth"
    VOCAB_PATH: str = "trained_models/sign_vocab.json"
    CONFIDENCE_THRESHOLD: float = 0.75
    SIGN_CACHE_TTL: int = 3600
    TRANSLATION_CACHE_TTL: int = 86400
    TTS_CACHE_TTL: int = 86400
    DEFAULT_LANGUAGE: str = "en"
    SUPPORTED_LANGUAGES: str = "en,es,fr"

    class Config:
        env_file = ".env"

settings = Settings()
