import os
import logging
from openai import OpenAI
from typing import Optional, Dict, Any
from .encryption_service import encryption_service
from .websocket_service import WebSocketService

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class OpenAIService:
    def __init__(self):
        """Inicializa el servicio de OpenAI"""
        self.client = None
        self.model = "gpt-4"  # Modelo por defecto
        self.initialized = False
        self.websocket_service = None
        self.encryption_service = encryption_service  # Usar instancia global
        logger.info("🤖 Servicio OpenAI creado")

    def initialize(self, websocket_service):
        """Inicializa el servicio OpenAI con la API key del WebSocket"""
        try:
            # Obtener datos del WebSocket
            storage_data = websocket_service.storage_data
            if not storage_data:
                logger.error("❌ No hay datos en el WebSocket")
                return False
                
            # Obtener API key y timestamp
            encrypted_key = storage_data.get('openai_api_key')
            install_timestamp = storage_data.get('installTimestamp')
            
            if not encrypted_key or not install_timestamp:
                logger.error("❌ Falta API key o timestamp en el WebSocket")
                logger.debug(f"📝 Datos disponibles: {list(storage_data.keys())}")
                return False
                
            # Desencriptar API key
            logger.info("\n🔄 Desencriptando API key...")
            api_key = self.encryption_service.decrypt(encrypted_key, install_timestamp)
            
            if not api_key:
                logger.error("❌ Error desencriptando API key")
                return False
                
            # Validar formato de API key
            if not api_key.startswith('sk-'):
                logger.error("❌ API key inválida (debe empezar con 'sk-')")
                return False
                
            logger.info(f"\n🔓 API Key desencriptada: {api_key}")
                
            # Inicializar cliente OpenAI
            logger.debug("🔄 Inicializando cliente OpenAI...")
            self.client = OpenAI(api_key=api_key)
            self.initialized = True
            logger.debug("✅ Cliente OpenAI inicializado")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error inicializando OpenAI: {e}")
            return False

    def test_connection(self) -> Dict[str, Any]:
        """
        Prueba la conexión con OpenAI
        Returns:
            Dict con el estado de la conexión
        """
        if not self.initialized:
            return {
                'status': 'error',
                'message': 'Cliente no inicializado'
            }

        try:
            # Hacer una llamada simple para probar la conexión
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "user", "content": "Test connection"}
                ],
                max_tokens=5
            )
            
            return {
                'status': 'success',
                'message': 'Conexión exitosa',
                'model': self.model,
                'response': response.choices[0].message.content
            }

        except Exception as e:
            logger.error(f"❌ Error en test de conexión: {e}")
            return {
                'status': 'error',
                'message': str(e)
            }

    def set_model(self, model: str) -> bool:
        """
        Cambia el modelo de OpenAI a utilizar
        Args:
            model: Nombre del modelo (ej: "gpt-4", "gpt-3.5-turbo")
        Returns:
            bool: True si el cambio fue exitoso
        """
        try:
            self.model = model
            logger.info(f"✅ Modelo cambiado a: {model}")
            return True
        except Exception as e:
            logger.error(f"❌ Error cambiando modelo: {e}")
            return False

# Crear instancia global
openai_service = OpenAIService() 