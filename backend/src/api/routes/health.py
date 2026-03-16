from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    from ...main import model_service, cache_service, db_service

    checks = {}

    # Check Redis
    try:
        cache_service.client.ping()
        checks["redis"] = "ok"
    except Exception:
        checks["redis"] = "error"

    if model_service.model_loaded:
        checks["model"] = "ok"
    elif model_service.demo_mode:
        checks["model"] = "demo"
    else:
        checks["model"] = "not_loaded"

    # Check PostgreSQL
    try:
        if db_service.pool:
            await db_service.pool.fetchval("SELECT 1")
            checks["postgres"] = "ok"
        else:
            checks["postgres"] = "not_connected"
    except Exception:
        checks["postgres"] = "error"

    all_ok = all(v in ("ok", "demo") for v in checks.values())
    return {
        "status": "healthy" if all_ok else "degraded",
        "checks": checks,
        "model_info": {
            "vocabulary_size": len(model_service.vocab) if model_service.vocab else 0,
            "model_version": "v2.0-stgcn",
        },
    }
