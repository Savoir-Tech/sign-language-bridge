import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()
logger = logging.getLogger(__name__)


@router.websocket("/ws/recognize")
async def websocket_recognize(ws: WebSocket):
    await ws.accept()
    language = "en"
    gloss_buffer = []

    try:
        while True:
            data = await ws.receive_text()
            message = json.loads(data)

            if message["type"] == "set_language":
                language = message["language"]
                await ws.send_json({"type": "language_set", "language": language})
                continue

            if message["type"] == "frame":
                from ...main import model_service, cache_service
                from ...config import settings

                frame_b64 = message["data"]
                result = model_service.process_frame(frame_b64)

                if result and result["confidence"] > settings.CONFIDENCE_THRESHOLD:
                    gloss_buffer.append(result["sign"])

                    await ws.send_json(
                        {
                            "type": "prediction",
                            "sign": result["sign"],
                            "confidence": result["confidence"],
                            "language": language,
                            "cached": result.get("cached", False),
                        }
                    )

            if message["type"] == "end_sentence":
                if gloss_buffer:
                    from ...services.gloss_service import gloss_to_text
                    from ...services.translation_service import translate_text
                    from ...services.tts_service import text_to_speech
                    from ...main import cache_service

                    text = gloss_to_text(gloss_buffer)
                    translated = translate_text(text, "en", language, cache_service)
                    audio_id = await text_to_speech(translated, language)

                    await ws.send_json(
                        {
                            "type": "sentence",
                            "signs": gloss_buffer,
                            "text": text,
                            "translated": translated,
                            "language": language,
                            "audio_url": f"/api/tts/audio/{audio_id}",
                        }
                    )
                    gloss_buffer = []

    except WebSocketDisconnect:
        logger.info("Client disconnected")
