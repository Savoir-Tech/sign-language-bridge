import asyncio
import json
import logging
from uuid import UUID

import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()
logger = logging.getLogger(__name__)


@router.websocket("/ws/recognize")
async def websocket_recognize(ws: WebSocket):
    await ws.accept()

    from ...main import model_service, cache_service, db_service
    from ...config import settings

    language = "en"
    session_id: str | None = None
    user_id: str | None = None
    gloss_buffer: list[str] = []
    frame_buffer: list[np.ndarray] = []
    hands_seen_count: list[int] = [0]
    idle_sentence_task: asyncio.Task | None = None
    IDLE_SENTENCE_TIMEOUT = 2.0  # seconds of no predictions before auto-completing

    async def auto_complete_sentence():
        """Auto-send sentence after idle timeout with no new predictions."""
        await asyncio.sleep(IDLE_SENTENCE_TIMEOUT)
        if not gloss_buffer:
            return
        try:
            from ...services.gloss_service import gloss_to_text
            from ...services.translation_service import translate_text
            from ...services.tts_service import text_to_speech

            text = gloss_to_text(gloss_buffer)
            translated = await asyncio.to_thread(
                translate_text, text, "en", language, cache_service
            )
            audio_id = await text_to_speech(translated, language)
            audio_url = f"/api/tts/audio/{audio_id}" if audio_id else None

            await ws.send_json({
                "type": "sentence",
                "signs": list(gloss_buffer),
                "text": text,
                "translated": translated,
                "language": language,
                "audio_url": audio_url,
            })

            if session_id and db_service.pool:
                try:
                    sid = UUID(session_id) if not isinstance(session_id, UUID) else session_id
                    uid = UUID(user_id) if user_id else None
                    if uid:
                        await db_service.save_translation(
                            session_id=sid, user_id=uid,
                            gloss_sequence=list(gloss_buffer),
                            source_text=text, translated_text=translated,
                            source_lang="en", target_lang=language,
                            confidence_avg=0.9,
                        )
                except Exception as db_err:
                    logger.warning(f"DB persistence failed (auto): {db_err}")

            gloss_buffer.clear()
            logger.info("Auto-completed sentence after idle timeout")
        except Exception as e:
            logger.error(f"Auto sentence error: {e}", exc_info=True)

    try:
        while True:
            data = await ws.receive_text()
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                await ws.send_json({"type": "error", "message": "Invalid JSON"})
                continue

            msg_type = message.get("type")
            logger.info("WS-RECV type=%s payload_size=%d", msg_type, len(data))

            # ── set_language ──────────────────────────────────
            if msg_type == "set_language":
                language = message.get("language", "en")
                await ws.send_json({"type": "language_set", "language": language})
                continue

            # ── set_session ───────────────────────────────────
            if msg_type == "set_session":
                session_id = message.get("session_id")
                user_id = message.get("user_id")
                await ws.send_json({"type": "session_set", "session_id": session_id})
                continue

            # ── frame ─────────────────────────────────────────
            if msg_type == "frame":
                try:
                    frame_b64 = message["data"]
                    logger.debug("Processing frame (%d bytes)", len(frame_b64))
                    result, buf_len = await asyncio.to_thread(
                        model_service.process_frame, frame_b64, frame_buffer, hands_seen_count
                    )

                    seq_len = model_service.sequence_length
                    logger.info(
                        "FRAME result=%s buf_len=%d/%d demo=%s",
                        "HIT" if result else "MISS",
                        buf_len, seq_len,
                        model_service.demo_mode,
                    )
                    await ws.send_json({
                        "type": "buffer_progress",
                        "frames": buf_len,
                        "required": seq_len,
                        "demo": model_service.demo_mode,
                    })

                    if result:
                        logger.info(
                            "THRESHOLD sign=%s conf=%.4f threshold=%.2f pass=%s",
                            result["sign"], result["confidence"],
                            settings.CONFIDENCE_THRESHOLD,
                            result["confidence"] > settings.CONFIDENCE_THRESHOLD,
                        )
                    if result and result["confidence"] > settings.CONFIDENCE_THRESHOLD:
                        gloss_buffer.append(result["sign"])
                        await ws.send_json({
                            "type": "prediction",
                            "sign": result["sign"],
                            "confidence": result["confidence"],
                            "language": language,
                            "cached": result.get("cached", False),
                            "demo": result.get("demo", False),
                        })
                        # Reset idle timer — auto-complete after IDLE_SENTENCE_TIMEOUT
                        if idle_sentence_task and not idle_sentence_task.done():
                            idle_sentence_task.cancel()
                        idle_sentence_task = asyncio.create_task(auto_complete_sentence())
                except Exception as e:
                    logger.error(f"Frame processing error: {e}", exc_info=True)
                    await ws.send_json({"type": "error", "message": f"Frame error: {e}"})
                continue

            # ── end_sentence ──────────────────────────────────
            if msg_type == "end_sentence":
                # Cancel auto-complete timer since user triggered manually
                if idle_sentence_task and not idle_sentence_task.done():
                    idle_sentence_task.cancel()
                    idle_sentence_task = None
                if not gloss_buffer:
                    continue
                try:
                    from ...services.gloss_service import gloss_to_text
                    from ...services.translation_service import translate_text
                    from ...services.tts_service import text_to_speech

                    text = gloss_to_text(gloss_buffer)

                    translated = await asyncio.to_thread(
                        translate_text, text, "en", language, cache_service
                    )

                    audio_id = await text_to_speech(translated, language)
                    audio_url = f"/api/tts/audio/{audio_id}" if audio_id else None

                    sentence_msg = {
                        "type": "sentence",
                        "signs": list(gloss_buffer),
                        "text": text,
                        "translated": translated,
                        "language": language,
                        "audio_url": audio_url,
                    }
                    await ws.send_json(sentence_msg)

                    # Persist to PostgreSQL if we have session context
                    if session_id and db_service.pool:
                        try:
                            sid = UUID(session_id) if not isinstance(session_id, UUID) else session_id
                            uid = UUID(user_id) if user_id else None
                            if uid:
                                await db_service.save_translation(
                                    session_id=sid,
                                    user_id=uid,
                                    gloss_sequence=list(gloss_buffer),
                                    source_text=text,
                                    translated_text=translated,
                                    source_lang="en",
                                    target_lang=language,
                                    confidence_avg=0.9,
                                )
                        except Exception as db_err:
                            logger.warning(f"DB persistence failed: {db_err}")

                    gloss_buffer = []

                except Exception as e:
                    logger.error(f"Sentence processing error: {e}", exc_info=True)
                    await ws.send_json({"type": "error", "message": f"Sentence error: {e}"})
                continue

    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"WebSocket fatal error: {e}", exc_info=True)
