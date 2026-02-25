import hashlib
import json
import logging
import uuid

import boto3

from ..config import settings

logger = logging.getLogger(__name__)

VOICE_MAP = {
    "en": "tiffany",
    "es": "lucia",
    "fr": "lea",
}

# In-memory store for audio files (for demo; production would use S3 or disk)
audio_store: dict[str, bytes] = {}

bedrock_client = None


def get_bedrock_client():
    global bedrock_client
    if bedrock_client is None:
        bedrock_client = boto3.client(
            "bedrock-runtime", region_name=settings.AWS_REGION
        )
    return bedrock_client


async def text_to_speech(text: str, language: str = "en") -> str:
    audio_id = hashlib.md5(f"{text}:{language}".encode()).hexdigest()[:12]

    # Check in-memory store
    if audio_id in audio_store:
        return audio_id

    try:
        client = get_bedrock_client()
        response = client.invoke_model(
            modelId="amazon.nova-sonic-v1:0",
            contentType="application/json",
            accept="audio/wav",
            body=json.dumps(
                {
                    "text": text,
                    "voice": VOICE_MAP.get(language, "tiffany"),
                    "language": language,
                }
            ),
        )

        audio_bytes = response["body"].read()
        audio_store[audio_id] = audio_bytes
        return audio_id

    except Exception as e:
        logger.error(f"TTS failed: {e}")
        return audio_id


def get_audio(audio_id: str) -> bytes | None:
    return audio_store.get(audio_id)
