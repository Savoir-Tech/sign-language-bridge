from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from uuid import UUID

from .auth import get_current_user_id

router = APIRouter()


class CreateSessionRequest(BaseModel):
    language: str = "en"


class UpdateSessionRequest(BaseModel):
    title: str | None = None
    language: str | None = None


@router.post("/sessions", status_code=201)
async def create_session(
    request: CreateSessionRequest,
    user_id: UUID = Depends(get_current_user_id),
):
    from ...main import db_service

    session = await db_service.create_session(user_id, request.language)
    return {
        "id": str(session["id"]),
        "title": session["title"],
        "language": session["language"],
        "created_at": session["created_at"].isoformat(),
        "updated_at": session["updated_at"].isoformat(),
    }


@router.get("/sessions")
async def list_sessions(user_id: UUID = Depends(get_current_user_id)):
    from ...main import db_service

    sessions = await db_service.get_sessions_for_user(user_id)
    return {
        "sessions": [
            {
                "id": str(s["id"]),
                "title": s["title"],
                "language": s["language"],
                "created_at": s["created_at"].isoformat(),
                "updated_at": s["updated_at"].isoformat(),
                "translation_count": s["translation_count"],
            }
            for s in sessions
        ]
    }


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
):
    from ...main import db_service

    session = await db_service.get_session(session_id, user_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "id": str(session["id"]),
        "title": session["title"],
        "language": session["language"],
        "created_at": session["created_at"].isoformat(),
        "updated_at": session["updated_at"].isoformat(),
    }


@router.put("/sessions/{session_id}")
async def update_session(
    session_id: UUID,
    request: UpdateSessionRequest,
    user_id: UUID = Depends(get_current_user_id),
):
    from ...main import db_service

    session = await db_service.get_session(session_id, user_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if request.title:
        await db_service.update_session_title(session_id, request.title)
    if request.language:
        await db_service.update_session_language(session_id, user_id, request.language)

    return {"status": "updated"}


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
):
    from ...main import db_service

    await db_service.soft_delete_session(session_id, user_id)
    return {"status": "deleted"}


@router.get("/sessions/{session_id}/translations")
async def get_session_translations(
    session_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
):
    from ...main import db_service

    session = await db_service.get_session(session_id, user_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    translations = await db_service.get_translations_for_session(session_id)

    return {
        "session": {
            "id": str(session["id"]),
            "title": session["title"],
            "language": session["language"],
            "created_at": session["created_at"].isoformat(),
        },
        "translations": [
            {
                "id": str(t["id"]),
                "gloss_sequence": t["gloss_sequence"],
                "source_text": t["source_text"],
                "translated_text": t["translated_text"],
                "source_lang": t["source_lang"],
                "target_lang": t["target_lang"],
                "confidence_avg": t["confidence_avg"],
                "created_at": t["created_at"].isoformat(),
            }
            for t in translations
        ],
    }
