import os
import logging
from openai import OpenAI
from typing import Optional, Dict, Any, List
from ..lazy_load_service import LazyLoadService, lazy_load
from ..service_locator import service_locator

# Configurar logging
logger = logging.getLogger(__name__)

# Valores por defecto
DEFAULT_MODEL = "gpt-4o"
DEFAULT_TEMPERATURE = 0.7
DEFAULT_SYSTEM_PROMPT = """Responde la pregunta del usuario de manera clara y concisa."""

class OpenAIService(LazyLoadService):
    _instance = None

    def __new__(cls, socketio=None):
        if cls._instance is None:
            cls._instance = super(OpenAIService, cls).__new__(cls)
        return cls._instance

    def __init__(self, socketio=None):
        """Inicializa el servicio OpenAI de forma lazy"""
        if hasattr(self, '_initialized'):
            return
            
        super().__init__()
        logger.info("🤖 Inicializando OpenAI service...")
        
        try:
            self.client = None
            self._storage = None
            self._set_initialized(True)
            
            self.socketio = socketio
            if socketio:
                self._register_handlers()
            
        except Exception as e:
            self._set_initialized(False, str(e))
            raise

    @property
    @lazy_load('storage')
    def storage(self):
        """Obtiene el StorageService de forma lazy"""
        return self._storage

    def _get_credentials(self):
        """Obtiene y desencripta las credenciales desde storage"""
        try:
            if not self.storage:
                logger.error("❌ No se pudo obtener StorageService")
                return None

            # Obtener credenciales encriptadas
            encrypted_key = self.storage.get_value('openaiApiKey')
            install_timestamp = self.storage.get_value('installTimestamp')

            if not encrypted_key or not install_timestamp:
                logger.error("❌ Credenciales no encontradas en storage")
                return None

            # Desencriptar API key usando el servicio de encriptación
            encryption_service = service_locator.get('encryption')
            if not encryption_service:
                logger.error("❌ No se pudo obtener encryption service")
                return None

            api_key = encryption_service.decrypt(encrypted_key, install_timestamp)
            if not api_key:
                logger.error("❌ Error desencriptando API key")
                return None

            logger.info("✅ Credenciales obtenidas correctamente")
            return api_key

        except Exception as e:
            logger.error(f"❌ Error obteniendo credenciales: {e}")
            return None

    def initialize(self) -> bool:
        """Inicializa el cliente OpenAI con las credenciales"""
        try:
            logger.info("🔄 Inicializando cliente OpenAI...")
            
            api_key = self._get_credentials()
            if not api_key:
                return False

            self.client = OpenAI(api_key=api_key)
            self.initialized = True
            logger.info("✅ Cliente OpenAI inicializado correctamente")
            return True

        except Exception as e:
            logger.error(f"❌ Error inicializando OpenAI: {e}")
            return False

    def process_query(
        self, 
        user_prompt: str,
        chat_history: List[Dict[str, str]] = None,
        model: str = DEFAULT_MODEL,
        temperature: float = DEFAULT_TEMPERATURE,
        system_prompt: str = DEFAULT_SYSTEM_PROMPT
    ) -> Optional[str]:
        """
        Procesa una consulta usando OpenAI
        Args:
            user_prompt: Texto de la consulta (obligatorio)
            chat_history: Historial de conversación (opcional)
            model: Modelo a usar (default: gpt-4o)
            temperature: Temperatura para la respuesta (default: 0.7)
            system_prompt: Prompt de sistema (default: prompt básico)
        Returns:
            Respuesta de OpenAI o None si hay error
        """
        if not user_prompt:
            logger.error("❌ Se requiere user_prompt")
            return None

        try:
            # Log de parámetros usados
            logger.info(f"🔄 Procesando consulta:")
            logger.info(f"📝 Prompt: {user_prompt[:50]}...")
            logger.info(f"🤖 Modelo: {model}")
            logger.info(f"🌡️ Temperatura: {temperature}")
            
            # Inicializar cliente si es necesario
            if not self.client:
                api_key = self._get_credentials()
                if not api_key:
                    logger.error("❌ No se pudieron obtener credenciales")
                    return None
                self.client = OpenAI(api_key=api_key)
                logger.info("✅ Cliente OpenAI inicializado")
            
            # Construir mensajes
            messages = [{"role": "system", "content": system_prompt}]
            
            # Añadir historial si existe
            if chat_history:
                messages.extend([
                    {"role": msg["role"], "content": msg["content"]}
                    for msg in chat_history
                ])
            
            # Añadir mensaje actual
            messages.append({"role": "user", "content": user_prompt})

            response = self.client.chat.completions.create(
                model=model,
                temperature=temperature,
                messages=messages
            )
            
            result = response.choices[0].message.content
            logger.info("✅ Respuesta obtenida correctamente")
            return result
            
        except Exception as e:
            logger.error(f"❌ Error procesando consulta: {e}")
            return None

    def _register_handlers(self):
        if self.socketio:
            @self.socketio.on('openai.test_search')
            def handle_test_search(data):
                try:
                    # ... lógica del handler
                    pass
                except Exception as e:
                    logger.error(f"Error: {str(e)}")

# Instancia del servicio
openai_service = OpenAIService() 