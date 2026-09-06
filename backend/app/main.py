import os
import asyncio
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .database import engine, Base, SessionLocal
from .routers import auth_router, user_router, payment_router, contact_router, tools_router, system_router
from .services.storage_service import purge_expired_files

# Create DB tables
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Background task 1: Clean up old temporary files every 10 minutes
    async def periodic_purge():
        while True:
            await asyncio.sleep(600)
            try:
                db = SessionLocal()
                purge_expired_files(db)
                db.close()
            except Exception as e:
                print(f"File purge error: {e}")

    # Background task 2: Keep-alive self ping to prevent Render free tier idle sleep
    async def periodic_keepalive():
        import httpx
        await asyncio.sleep(15)
        while True:
            try:
                render_url = os.getenv("RENDER_EXTERNAL_URL", "https://docflow-backend-8rwy.onrender.com")
                async with httpx.AsyncClient(timeout=10.0) as client:
                    await client.get(f"{render_url}/health")
            except Exception:
                pass
            await asyncio.sleep(540) # Ping every 9 minutes

    purge_task = asyncio.create_task(periodic_purge())
    keepalive_task = asyncio.create_task(periodic_keepalive())
    yield
    purge_task.cancel()
    keepalive_task.cancel()

app = FastAPI(
    title="DocFlow API",
    description="Production backend document processing engine for DocFlow",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception Handler to avoid [object Object] errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"Global Exception caught: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong. Unable to process request."}
    )

# Routers
app.include_router(auth_router.router)
app.include_router(user_router.router)
app.include_router(payment_router.router)
app.include_router(contact_router.router)
app.include_router(tools_router.router)
app.include_router(system_router.router)

@app.api_route("/", methods=["GET", "HEAD"])
def read_root():
    return {"message": "DocFlow Backend API is running.", "status": "healthy"}

@app.api_route("/health", methods=["GET", "HEAD"])
def health_check():
    return {"status": "healthy"}
