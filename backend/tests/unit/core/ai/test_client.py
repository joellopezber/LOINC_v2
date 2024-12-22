import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from core.ai.client import AIClient
from core.security.token_manager import token_manager
from openai.types.chat import ChatCompletion, ChatCompletionMessage

class TestAIClient:
    """Tests para el cliente AI"""

    def test_init_client_success(self):
        """Test inicialización exitosa del cliente"""
        # Configurar API key en token manager
        token_manager.current_api_key = 'sk-test123'
        
        client = AIClient()
        client.initialize()
        assert client.client is not None
        
        # Limpiar
        token_manager.current_api_key = None

    def test_init_client_missing_key(self):
        """Test error cuando falta API key"""
        # Asegurar que no hay API key configurada
        token_manager.current_api_key = None
        
        client = AIClient()
        with pytest.raises(ValueError, match="No hay API key configurada"):
            client.initialize()

    def test_init_client_invalid_key(self):
        """Test error cuando la API key es inválida"""
        # Configurar API key inválida
        token_manager.current_api_key = 'invalid-key'
        
        client = AIClient()
        with pytest.raises(ValueError, match="API key inválida"):
            client.initialize()
            
        # Limpiar
        token_manager.current_api_key = None

    @pytest.mark.asyncio
    async def test_create_chat_completion_success(self, mock_openai_response):
        """Test llamada exitosa a OpenAI"""
        # Configurar API key
        token_manager.current_api_key = 'sk-test123'
        
        client = AIClient()
        client.initialize()
        
        # Mock del método create de completions
        client.client.chat.completions.create = AsyncMock(return_value=mock_openai_response)

        messages = [
            {"role": "user", "content": "Test message"}
        ]

        response = await client.create_chat_completion(messages)
        assert response == mock_openai_response
        assert response.choices[0].message.content is not None
        
        # Limpiar
        token_manager.current_api_key = None

    @pytest.mark.asyncio
    async def test_create_chat_completion_invalid_response(self):
        """Test manejo de respuesta inválida de OpenAI"""
        # Configurar API key
        token_manager.current_api_key = 'sk-test123'
        
        client = AIClient()
        client.initialize()
        
        # Simular respuesta inválida
        invalid_response = ChatCompletion(
            id="chatcmpl-123",
            choices=[],
            created=1677858242,
            model="gpt-4",
            object="chat.completion",
            usage={"prompt_tokens": 50, "completion_tokens": 100, "total_tokens": 150}
        )
        
        # Mock del método create de completions
        client.client.chat.completions.create = AsyncMock(return_value=invalid_response)

        messages = [
            {"role": "user", "content": "Test message"}
        ]

        with pytest.raises(ValueError, match="Respuesta inválida de OpenAI"):
            await client.create_chat_completion(messages)
            
        # Limpiar
        token_manager.current_api_key = None

    @pytest.mark.asyncio
    async def test_create_chat_completion_api_error(self):
        """Test manejo de error en la API"""
        # Configurar API key
        token_manager.current_api_key = 'sk-test123'
        
        client = AIClient()
        client.initialize()
        
        # Mock del método create de completions con error
        client.client.chat.completions.create = AsyncMock(side_effect=Exception("API Error"))

        messages = [
            {"role": "user", "content": "Test message"}
        ]

        with pytest.raises(Exception, match="API Error"):
            await client.create_chat_completion(messages)
            
        # Limpiar
        token_manager.current_api_key = None