import asyncpg
import logging
from uuid import UUID

logger = logging.getLogger(__name__)


class DatabaseService:
    def __init__(self):
        self.pool = None

    async def connect(self, database_url: str):
        self.pool = await asyncpg.create_pool(database_url, min_size=5, max_size=20)
        logger.info("PostgreSQL connected")

    async def disconnect(self):
        if self.pool:
            await self.pool.close()

    # ── Users ──────────────────────────────────────────────

    async def create_user(
        self,
        email: str,
        password_hash: str,
        display_name: str,
        preferred_lang: str = "en",
    ) -> dict:
        row = await self.pool.fetchrow(
            """INSERT INTO users (email, password_hash, display_name, preferred_lang)
               VALUES ($1, $2, $3, $4) RETURNING *""",
            email,
            password_hash,
            display_name,
            preferred_lang,
        )
        return dict(row)

    async def get_user_by_email(self, email: str) -> dict | None:
        row = await self.pool.fetchrow("SELECT * FROM users WHERE email = $1", email)
        return dict(row) if row else None

    async def get_user_by_id(self, user_id: UUID) -> dict | None:
        row = await self.pool.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
        return dict(row) if row else None

    async def update_last_login(self, user_id: UUID):
        await self.pool.execute(
            "UPDATE users SET last_login_at = NOW() WHERE id = $1", user_id
        )

    # ── Sessions ───────────────────────────────────────────

    async def create_session(self, user_id: UUID, language: str = "en") -> dict:
        row = await self.pool.fetchrow(
            """INSERT INTO sessions (user_id, language)
               VALUES ($1, $2) RETURNING *""",
            user_id,
            language,
        )
        return dict(row)

    async def get_sessions_for_user(self, user_id: UUID) -> list[dict]:
        rows = await self.pool.fetch(
            """SELECT s.*, COUNT(t.id) AS translation_count
               FROM sessions s
               LEFT JOIN translations t ON t.session_id = s.id
               WHERE s.user_id = $1 AND s.is_active = TRUE
               GROUP BY s.id
               ORDER BY s.updated_at DESC""",
            user_id,
        )
        return [dict(r) for r in rows]

    async def get_session(self, session_id: UUID, user_id: UUID) -> dict | None:
        row = await self.pool.fetchrow(
            "SELECT * FROM sessions WHERE id = $1 AND user_id = $2",
            session_id,
            user_id,
        )
        return dict(row) if row else None

    async def update_session_title(self, session_id: UUID, title: str):
        await self.pool.execute(
            """UPDATE sessions SET title = $1, updated_at = NOW()
               WHERE id = $2""",
            title,
            session_id,
        )

    async def update_session_language(self, session_id: UUID, user_id: UUID, language: str):
        await self.pool.execute(
            """UPDATE sessions SET language = $1, updated_at = NOW()
               WHERE id = $2 AND user_id = $3""",
            language,
            session_id,
            user_id,
        )

    async def soft_delete_session(self, session_id: UUID, user_id: UUID):
        await self.pool.execute(
            """UPDATE sessions SET is_active = FALSE
               WHERE id = $1 AND user_id = $2""",
            session_id,
            user_id,
        )

    # ── Translations ───────────────────────────────────────

    async def save_translation(
        self,
        session_id: UUID,
        user_id: UUID,
        gloss_sequence: list[str],
        source_text: str,
        translated_text: str | None,
        source_lang: str,
        target_lang: str,
        confidence_avg: float,
    ) -> dict:
        row = await self.pool.fetchrow(
            """INSERT INTO translations
               (session_id, user_id, gloss_sequence, source_text, translated_text,
                source_lang, target_lang, confidence_avg)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *""",
            session_id,
            user_id,
            gloss_sequence,
            source_text,
            translated_text,
            source_lang,
            target_lang,
            confidence_avg,
        )
        # Update session timestamp + auto-title if first translation
        await self.pool.execute(
            """UPDATE sessions SET updated_at = NOW(),
               title = CASE WHEN title = 'New Conversation' THEN $1 ELSE title END
               WHERE id = $2""",
            source_text[:100],
            session_id,
        )
        return dict(row)

    async def get_translations_for_session(self, session_id: UUID) -> list[dict]:
        rows = await self.pool.fetch(
            """SELECT * FROM translations
               WHERE session_id = $1
               ORDER BY created_at ASC""",
            session_id,
        )
        return [dict(r) for r in rows]
