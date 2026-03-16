import asyncio
import hashlib
import json
import logging

import boto3
from botocore.exceptions import ClientError, BotoCoreError

from ..config import settings

logger = logging.getLogger(__name__)

VOICE_MAP = {
    "en": "tiffany",
    "es": "lucia",
    "fr": "lea",
}

POLLY_VOICE_MAP = {
    "en": "Joanna",
    "es": "Lucia",
    "fr": "Lea",
}

audio_store: dict[str, tuple[bytes, str]] = {}  # audio_id -> (bytes, content_type)

bedrock_client = None
polly_client = None


def get_bedrock_client():
    global bedrock_client
    if bedrock_client is None:
        bedrock_client = boto3.client(
            "bedrock-runtime", region_name=settings.AWS_REGION
        )
    return bedrock_client


def get_polly_client():
    global polly_client
    if polly_client is None:
        polly_client = boto3.client("polly", region_name=settings.AWS_REGION)
    return polly_client


async def _try_nova_sonic(text: str, language: str) -> bytes | None:
    """Attempt TTS via Amazon Nova Sonic (Bedrock). Returns audio bytes or None."""
    try:
        client = get_bedrock_client()
        response = await asyncio.to_thread(
            client.invoke_model,
            modelId="amazon.nova-sonic-v1:0",
            contentType="application/json",
            accept="audio/wav",
            body=json.dumps({
                "text": text,
                "voice": VOICE_MAP.get(language, "tiffany"),
                "language": language,
            }),
        )
        return response["body"].read()
    except Exception as e:
        logger.warning(f"Nova Sonic TTS failed, will try Polly: {e}")
        return None


async def _try_polly(text: str, language: str) -> bytes | None:
    """Fallback TTS via Amazon Polly. Returns audio bytes or None."""
    try:
        client = get_polly_client()
        voice = POLLY_VOICE_MAP.get(language, "Joanna")
        response = await asyncio.to_thread(
            client.synthesize_speech,
            Text=text,
            OutputFormat="mp3",
            VoiceId=voice,
            Engine="neural",
        )
        stream = response.get("AudioStream")
        if stream:
            return stream.read()
        return None
    except (ClientError, BotoCoreError) as e:
        logger.warning(f"Polly TTS failed: {e}")
        return None
    except Exception as e:
        logger.warning(f"Polly TTS unexpected error: {e}")
        return None


async def text_to_speech(text: str, language: str = "en") -> str | None:
    """Convert text to speech. Returns audio_id on success, None on failure."""
    audio_id = hashlib.md5(f"{text}:{language}".encode()).hexdigest()[:12]

    if audio_id in audio_store:
        return audio_id

    audio_bytes = await _try_nova_sonic(text, language)
    content_type = "audio/wav"
    if audio_bytes is None:
        audio_bytes = await _try_polly(text, language)
        content_type = "audio/mpeg"

    if audio_bytes and len(audio_bytes) > 0:
        audio_store[audio_id] = (audio_bytes, content_type)
        return audio_id

    logger.error(f"All TTS providers failed for: {text[:50]}...")
    return None


def get_audio(audio_id: str) -> tuple[bytes, str] | None:
    """Returns (audio_bytes, content_type) or None."""
    return audio_store.get(audio_id)
