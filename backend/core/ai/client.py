import os
from openai import OpenAI
from typing import Dict, List
import logging
from dotenv import load_dotenv
from ..security.token_manager import token_manager

# Cargar variables de entorno
load_dotenv()
logger = logging.getLogger(__name__)

class AIClient:
    _instance = None

    @classmethod
    def get_instance(cls):
        """Obtiene la instancia del cliente AI (singleton)"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        self.logger = logging.getLogger('backend.core.ai.client')
        self.client = None

    def initialize(self):
        """Inicializa el cliente de OpenAI"""
        if self.client is not None:
            return

        # Obtener API key del token manager
        api_key = getattr(token_manager, 'current_api_key', None)
        
        if not api_key:
            raise ValueError("No hay API key configurada")
        
        if not api_key.startswith('sk-'):
            raise ValueError("API key inválida")
            
        try:
            # Inicializar cliente solo con API key
            self.client = OpenAI(api_key=api_key)
            self.logger.info("✅ Cliente OpenAI inicializado")
        except Exception as e:
            self.logger.error(f"❌ Error al inicializar cliente OpenAI: {e}")
            raise

    async def create_chat_completion(
        self, 
        messages: List[Dict],
        model: str = 'gpt-4',
        temperature: float = 0.7,
        max_tokens: int = 2000
    ) -> Dict:
        """Crea una completion de chat"""
        if self.client is None:
            self.initialize()

        try:
            response = await self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            
            if not response.choices or not response.choices[0].message:
                raise ValueError("Respuesta inválida de OpenAI")
                
            return response
            
        except Exception as e:
            self.logger.error(f"❌ Error en llamada a OpenAI: {e}")
            raise

# Instancia global
ai_client = AIClient() 