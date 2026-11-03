from contextlib import asynccontextmanager
from typing import Any

import httpx
import structlog
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from supabase import create_client
from supabase.client import ClientOptions

from app.core.auth import require_access_token, require_user
from app.core.config import get_settings
from app.schemas import CoachRequest, CoachResponse
from app.services.learning_engine import answer_learning_question

settings = get_settings()
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.supabase_auth = create_client(
        settings.supabase_url,
        settings.supabase_anon_key,
        options=ClientOptions(auto_refresh_token=False, persist_session=False),
    )
    app.state.supabase_rest = httpx.AsyncClient(
        base_url=f"{settings.supabase_url.rstrip('/')}/rest/v1/",
        timeout=settings.request_timeout_seconds,
    )
    app.state.llm = (
        AsyncOpenAI(api_key=settings.openai_api_key, timeout=settings.request_timeout_seconds)
        if settings.openai_api_key
        else None
    )
    try:
        yield
    finally:
        await app.state.supabase_rest.aclose()
        if app.state.llm is not None:
            await app.state.llm.close()


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "langblue-ai-engine"}


@app.post(f"{settings.api_prefix}/coach", response_model=CoachResponse)
async def coach(
    payload: CoachRequest,
    user: Any = Depends(require_user),
    access_token: str = Depends(require_access_token),
):
    llm = app.state.llm
    if llm is None:
        raise HTTPException(status_code=503, detail="AI provider is not configured")

    try:
        answer, used = await answer_learning_question(
            db=app.state.supabase_rest,
            llm=llm,
            user_id=str(user.id),
            access_token=access_token,
            anon_key=settings.supabase_anon_key,
            question=payload.question,
            language=payload.language,
            model=settings.openai_model,
            context_limit=settings.max_context_items,
        )
    except Exception:
        # Do not log prompts, answers, access tokens, or learner records.
        logger.exception("learning_request_failed", user_id=str(user.id))
        raise HTTPException(
            status_code=502,
            detail="The learning assistant is temporarily unavailable",
        ) from None

    return CoachResponse(
        answer=answer,
        context_items_used=used,
        personal_context_available=used > 0,
    )
