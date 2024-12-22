import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from core.ontology.service import OntologyService
from flask import Flask
import json
from openai.types.chat import ChatCompletion, ChatCompletionMessage

@pytest.fixture
def app():
    """Fixture que proporciona una instancia de Flask para testing"""
    app = Flask(__name__)
    app.config['TESTING'] = True
    return app

@pytest.fixture
def mock_openai_response():
    """Fixture que simula una respuesta de OpenAI"""
    message_content = json.dumps({
        "term_in_english": "glycated hemoglobin",
        "related_terms": ["HbA1c", "hemoglobin A1c"],
        "test_types": ["blood test", "diabetes monitoring"],
        "loinc_codes": ["4548-4"],
        "keywords": ["diabetes", "glucose", "monitoring"]
    })
    
    message = ChatCompletionMessage(
        content=message_content,
        role="assistant",
        function_call=None,
        tool_calls=None
    )
    
    response = ChatCompletion(
        id="chatcmpl-123",
        choices=[{
            "finish_reason": "stop",
            "index": 0,
            "message": message
        }],
        created=1677858242,
        model="gpt-4",
        object="chat.completion",
        usage={"prompt_tokens": 50, "completion_tokens": 100, "total_tokens": 150}
    )
    
    return response

@pytest.fixture
def mock_ai_client(mock_openai_response):
    """Fixture que proporciona un cliente AI mockeado"""
    mock_client = MagicMock()
    mock_client.chat = MagicMock()
    mock_client.chat.completions = MagicMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_openai_response)
    return mock_client

@pytest.fixture
def mock_ontology_service(mock_ai_client):
    """Fixture que proporciona un servicio de ontología mockeado"""
    with patch('core.ontology.service.ai_client', mock_ai_client):
        service = OntologyService()
        return service 