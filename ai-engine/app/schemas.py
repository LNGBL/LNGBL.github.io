from pydantic import BaseModel, Field


class CoachRequest(BaseModel):
    question: str = Field(min_length=2, max_length=2000)
    language: str = Field(default="en", min_length=2, max_length=16)


class CoachResponse(BaseModel):
    answer: str
    context_items_used: int
    personal_context_available: bool
