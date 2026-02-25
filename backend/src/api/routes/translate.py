from fastapi import APIRouter
from pydantic import BaseModel

from ...config import settings

router = APIRouter()


class TranslateRequest(BaseModel):
    text: str
    source: str = "en"
    target: str = "es"


@router.post("/translate")
async def translate(request: TranslateRequest):
    from ...main import cache_service
    from ...services.translation_service import translate_text

    supported = settings.SUPPORTED_LANGUAGES.split(",")
    if request.target not in supported:
        return {"error": f"Unsupported language: {request.target}"}

    translated = translate_text(
        request.text, request.source, request.target, cache_service
    )

    return {
        "original": request.text,
        "translated": translated,
        "source": request.source,
        "target": request.target,
    }
