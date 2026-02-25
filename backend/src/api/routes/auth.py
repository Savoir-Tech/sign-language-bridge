from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from uuid import UUID

from ...services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    get_user_id_from_token,
)

router = APIRouter()
security = HTTPBearer()


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str
    preferred_lang: str = "en"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UpdateProfileRequest(BaseModel):
    display_name: str | None = None
    preferred_lang: str | None = None


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> UUID:
    user_id = get_user_id_from_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
        )
    return user_id


@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest):
    from ...main import db_service

    existing = await db_service.get_user_by_email(request.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    password_hash = hash_password(request.password)
    user = await db_service.create_user(
        email=request.email,
        password_hash=password_hash,
        display_name=request.display_name,
        preferred_lang=request.preferred_lang,
    )

    return {
        "id": str(user["id"]),
        "email": user["email"],
        "display_name": user["display_name"],
        "preferred_lang": user["preferred_lang"],
        "created_at": user["created_at"].isoformat(),
    }


@router.post("/auth/login")
async def login(request: LoginRequest):
    from ...main import db_service

    user = await db_service.get_user_by_email(request.email)
    if not user or not verify_password(request.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    await db_service.update_last_login(user["id"])
    token = create_access_token(str(user["id"]))

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(user["id"]),
            "display_name": user["display_name"],
            "preferred_lang": user["preferred_lang"],
        },
    }


@router.get("/auth/me")
async def get_me(user_id: UUID = Depends(get_current_user_id)):
    from ...main import db_service

    user = await db_service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": str(user["id"]),
        "email": user["email"],
        "display_name": user["display_name"],
        "preferred_lang": user["preferred_lang"],
        "created_at": user["created_at"].isoformat(),
    }


@router.put("/auth/me")
async def update_me(
    request: UpdateProfileRequest,
    user_id: UUID = Depends(get_current_user_id),
):
    from ...main import db_service

    user = await db_service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # For now, just return the user (extend with actual update logic later)
    return {
        "id": str(user["id"]),
        "email": user["email"],
        "display_name": request.display_name or user["display_name"],
        "preferred_lang": request.preferred_lang or user["preferred_lang"],
    }
