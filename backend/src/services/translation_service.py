import json
import logging

import boto3

from ..config import settings

logger = logging.getLogger(__name__)

LANGUAGE_NAMES = {"en": "English", "es": "Spanish", "fr": "French"}

bedrock_client = None


def get_bedrock_client():
    global bedrock_client
    if bedrock_client is None:
        bedrock_client = boto3.client(
            "bedrock-runtime", region_name=settings.AWS_REGION
        )
    return bedrock_client


def translate_text(
    text: str,
    source: str = "en",
    target: str = "en",
    cache_service=None,
) -> str:
    if source == target:
        return text

    # Check cache first
    if cache_service:
        cached = cache_service.get_translation(text, target)
        if cached:
            return cached

    source_name = LANGUAGE_NAMES.get(source, "English")
    target_name = LANGUAGE_NAMES.get(target, "English")

    try:
        client = get_bedrock_client()
        response = client.invoke_model(
            modelId="amazon.nova-micro-v1:0",
            contentType="application/json",
            accept="application/json",
            body=json.dumps(
                {
                    "messages": [
                        {
                            "role": "user",
                            "content": (
                                f"Translate the following text from {source_name} to {target_name}. "
                                f"Return ONLY the translated text, nothing else.\n\n"
                                f"{text}"
                            ),
                        }
                    ],
                    "max_tokens": 200,
                    "temperature": 0.1,
                }
            ),
        )

        result = json.loads(response["body"].read())
        translated = result["output"]["message"]["content"][0]["text"].strip()

        # Cache the translation
        if cache_service:
            cache_service.set_translation(
                text, target, translated, settings.TRANSLATION_CACHE_TTL
            )

        return translated

    except Exception as e:
        logger.error(f"Translation failed: {e}")
        return text
