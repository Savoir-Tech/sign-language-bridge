from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: placeholder for model loading and Redis connection
    print(" Application starting up...")
    yield
    # Shutdown
    print(" Application shutting down...")

app = FastAPI(title="Sign Language Bridge", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health_check():
    """Basic health check endpoint for Docker verification"""
    return {
        "status": "healthy",
        "message": "Sign Language Bridge API is running",
        "environment": "development"
    }

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Sign Language Bridge API",
        "docs": "/docs",
        "health": "/api/health"
    }
