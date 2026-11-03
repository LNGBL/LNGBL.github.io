from types import SimpleNamespace

import pytest

from app.services.learning_engine import answer_learning_question


class FakeQuery:
    def __init__(self, rows):
        self.rows = rows
        self.filters = []

    def select(self, fields):
        return self

    def eq(self, key, value):
        self.filters.append((key, value))
        return self

    def order(self, key):
        return self

    def limit(self, value):
        return self

    def execute(self):
        return SimpleNamespace(data=self.rows)


class FakeDB:
    def __init__(self, rows):
        self.query = FakeQuery(rows)

    def table(self, name):
        assert name == "learning_review_items"
        return self.query


class FakeResponses:
    async def create(self, **kwargs):
        assert kwargs["model"] == "test-model"
        return SimpleNamespace(output_text="توضیح آزمایشی")


class FakeLLM:
    responses = FakeResponses()


@pytest.mark.asyncio
async def test_context_query_is_scoped_to_verified_user():
    db = FakeDB([{"title": "Present perfect", "prompt": "Have you...?", "answer": "Yes"}])

    answer, count = await answer_learning_question(
        db=db,
        llm=FakeLLM(),
        user_id="verified-user-123",
        question="این قاعده را توضیح بده",
        language="en",
        model="test-model",
        context_limit=5,
    )

    assert answer == "توضیح آزمایشی"
    assert count == 1
    assert ("user_id", "verified-user-123") in db.query.filters


@pytest.mark.asyncio
async def test_empty_personal_context_is_supported():
    db = FakeDB([])

    answer, count = await answer_learning_question(
        db=db,
        llm=FakeLLM(),
        user_id="verified-user-456",
        question="What is a noun?",
        language="en",
        model="test-model",
        context_limit=5,
    )

    assert answer
    assert count == 0
    assert ("user_id", "verified-user-456") in db.query.filters
