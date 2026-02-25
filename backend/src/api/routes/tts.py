from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel

from ...services.tts_service import text_to_speech, get_audio

router = APIRouter()


class TTSRequest(BaseModel):
    text: str
    language: str = "en"


@router.post("/tts")
async def create_tts(request: TTSRequest):
    audio_id = await text_to_speech(request.text, request.language)
    return {
        "audio_id": audio_id,
        "audio_url": f"/api/tts/audio/{audio_id}",
        "language": request.language,
    }


@router.get("/tts/audio/{audio_id}")
async def get_tts_audio(audio_id: str):
    audio_bytes = get_audio(audio_id)
    if audio_bytes:
        return Response(content=audio_bytes, media_type="audio/wav")
    return {"error": "Audio not found"}
