from fastapi import APIRouter

router = APIRouter()


@router.get("/signs")
async def list_signs():
    from ...main import model_service

    if model_service.vocab:
        return {
            "signs": list(model_service.vocab.keys()),
            "count": len(model_service.vocab),
        }
    return {"signs": [], "count": 0}
