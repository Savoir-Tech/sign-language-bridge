import hashlib
import json
import logging

import redis

logger = logging.getLogger(__name__)


class CacheService:
    def __init__(self):
        self.client = None

    def connect(self, redis_url: str):
        self.client = redis.from_url(redis_url, decode_responses=True)
        logger.info("Redis connected")

    def disconnect(self):
        if self.client:
            self.client.close()

    def get_sign(self, landmark_hash: str) -> dict | None:
        cached = self.client.get(f"sign:{landmark_hash}")
        if cached:
            self.client.incr("stats:cache_hits")
            return json.loads(cached)
        self.client.incr("stats:cache_misses")
        return None

    def set_sign(self, landmark_hash: str, result: dict, ttl: int = 3600):
        self.client.setex(f"sign:{landmark_hash}", ttl, json.dumps(result))

    def get_translation(self, text: str, target: str) -> str | None:
        key = f"translation:{hashlib.md5(f'{text}:{target}'.encode()).hexdigest()}"
        return self.client.get(key)

    def set_translation(self, text: str, target: str, translated: str, ttl: int = 86400):
        key = f"translation:{hashlib.md5(f'{text}:{target}'.encode()).hexdigest()}"
        self.client.setex(key, ttl, translated)

    def get_stats(self) -> dict:
        hits = int(self.client.get("stats:cache_hits") or 0)
        misses = int(self.client.get("stats:cache_misses") or 0)
        total = hits + misses
        return {
            "hits": hits,
            "misses": misses,
            "total": total,
            "hit_rate": round(hits / total, 4) if total > 0 else 0,
        }
