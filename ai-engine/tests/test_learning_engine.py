from types import SimpleNamespace

import pytest

from app.services.learning_engine import answer_learning_question


class FakeResponse:
    def __init__(self, rows):
        self.rows = rows

    def raise_for_status(self):
        return None

    def json(self):
        return self.rows


class FakeHTTPClient:
    def __init__(self, rows):
        self.rows = rows
        self.request = None

    async def get(self, path, *, params, headers):
        self.request = {"path": path, "params": params, "headers": headers}
        return FakeResponse(self.rows)


class FakeResponses:
    async def create(self, **kwargs):
        assert kwargs["model"] == "test-model"
        return SimpleNamespace(output_text="توضیح آزمایشی")


class FakeLLM:
    responses = FakeResponses()


@pytest.mark.asyncio
async def test_context_query_uses_verified_user_token_and_owner_filter():
    db = FakeHTTPClient(
        [{"title": "Present perfect", "prompt": "Have you...?", "answer": "Yes"}]
    )

    answer, count = await answer_learning_question(
        db=db,
        llm=FakeLLM(),
        user_id="verified-user-123",
        access_token="verified-access-token",
        anon_key="publishable-test-key",
        question="این قاعده را توضیح بده",
        language="en",
        model="test-model",
        context_limit=5,
    )

    assert answer == "توضیح آزمایشی"
    assert count == 1
    assert db.request["path"] == "learning_review_items"
    assert db.request["params"]["user_id"] == "eq.verified-user-123"
    assert db.request["headers"] == {
        "apikey": "publishable-test-key",
        "Authorization": "Bearer verified-access-token",
    }


@pytest.mark.asyncio
async def test_empty_personal_context_is_supported():
    db = FakeHTTPClient([])

    answer, count = await answer_learning_question(
        db=db,
        llm=FakeLLM(),
        user_id="verified-user-456",
        access_token="another-verified-token",
        anon_key="publishable-test-key",
        question="What is a noun?",
        language="en",
        model="test-model",
        context_limit=5,
    )

    assert answer
    assert count == 0
    assert db.request["params"]["user_id"] == "eq.verified-user-456"
