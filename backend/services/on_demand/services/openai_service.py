import os
import logging
from typing import Dict, Any, List, Optional
import openai
from openai import OpenAI
from ...lazy_load_service import LazyLoadService, lazy_load
from ...service_locator import service_locator

# Configurar logging
logger = logging.getLogger(__name__)

# Valores por defecto
DEFAULT_MODEL = "gpt-4o"
DEFAULT_TEMPERATURE = 0.7
DEFAULT_SYSTEM_PROMPT = """Responde la pregunta del usuario de manera clara y concisa."""

class OpenAIService(LazyLoadService):
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(OpenAIService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        """Inicializa el servicio OpenAI de forma lazy"""
        if hasattr(self, '_initialized'):
            return
            
        super().__init__()
        logger.debug("🤖 Inicializando OpenAI service")
        
        try:
            self.client = None
            self._storage = None
            self._set_initialized(True)
        except Exception as e:
            self._set_initialized(False, str(e))
            raise

    @property
    @lazy_load('storage')
    def storage(self):
        """Obtiene el StorageService de forma lazy"""
        return self._storage

    def get_credentials(self, install_id: str) -> Optional[str]:
        """Obtiene las credenciales de OpenAI para un usuario específico"""
        try:
            # Obtener storage de forma lazy
            if not self.storage:
                logger.error("❌ Storage no disponible")
                return None
                
            encrypted_key = self.storage.get_value('openaiApiKey', install_id)
            
            if not encrypted_key:
                logger.error("❌ API key no encontrada")
                return None

            # Obtener encryption service
            encryption_service = service_locator.get('encryption')
            if not encryption_service:
                logger.error("❌ Encryption service no disponible")
                return None

            # Desencriptar API key
            api_key = encryption_service.decrypt(encrypted_key, install_id)

            if not api_key:
                logger.error("❌ Error desencriptando API key")
                return None

            # Validar formato
            if not api_key.startswith('sk-'):
                logger.error("❌ API key inválida")
                return None
            
            return api_key

        except Exception as e:
            logger.error(f"❌ Error obteniendo credenciales: {e}")
            return None

    def process_query(
        self,
        user_prompt: str,
        install_id: str,
        chat_history: List[Dict[str, str]] = None,
        model: str = DEFAULT_MODEL,
        temperature: float = DEFAULT_TEMPERATURE,
        system_prompt: str = DEFAULT_SYSTEM_PROMPT
    ) -> Optional[str]:
        """Procesa una consulta con OpenAI"""
        try:
            logger.info(f"🔄 Procesando consulta OpenAI [modelo: {model}, temp: {temperature}]")
            
            # Obtener credenciales
            api_key = self.get_credentials(install_id)
            if not api_key:
                return None
                
            # Crear cliente con las credenciales del usuario
            client = OpenAI(api_key=api_key)

            # Preparar mensajes
            messages = []
            
            # Añadir system prompt
            if system_prompt:
                messages.append({
                    "role": "system",
                    "content": system_prompt
                })
                
            # Añadir historial de chat
            if chat_history:
                messages.extend(chat_history)
                
            # Añadir prompt actual
            messages.append({
                "role": "user",
                "content": user_prompt
            })
            
            # Realizar llamada a OpenAI
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature
            )
            
            # Extraer respuesta
            if not response.choices:
                logger.error("❌ No se obtuvo respuesta de OpenAI")
                return None
                
            result = response.choices[0].message.content
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Error procesando consulta: {e}")
            return None

# Instancia del servicio
openai_service = OpenAIService() 