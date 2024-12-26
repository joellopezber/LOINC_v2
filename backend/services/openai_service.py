import os
import logging
from openai import OpenAI
from typing import Optional, Dict, Any, List
from .service_locator import service_locator

# Configurar logging
logger = logging.getLogger(__name__)

# Valores por defecto
DEFAULT_MODEL = "gpt-4o"
DEFAULT_TEMPERATURE = 0.7
DEFAULT_SYSTEM_PROMPT = """Responde la pregunta del usuario de manera clara y concisa."""

class OpenAIService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(OpenAIService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        """Inicializa el servicio OpenAI de forma lazy"""
        if hasattr(self, 'initialized'):
            return
            
        logger.info("🤖 Inicializando OpenAI service...")
        self.client = None
        self.initialized = False
        self._storage = None
        logger.info("✅ OpenAI service base inicializado (pendiente conexión)")

    @property
    def storage(self):
        """Obtiene el StorageService de forma lazy"""
        if self._storage is None:
            self._storage = service_locator.get('storage')
            if self._storage is None:
                logger.error("❌ StorageService no encontrado en ServiceLocator")
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

            # Desencriptar API key
            from .encryption_service import encryption_service
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
        if not self.initialized and not self.initialize():
            logger.error("❌ Servicio no inicializado")
            return None

        if not user_prompt:
            logger.error("❌ Se requiere user_prompt")
            return None

        try:
            # Log de parámetros usados
            logger.info(f"🔄 Procesando consulta:")
            logger.info(f"📝 Prompt: {user_prompt[:50]}...")
            logger.info(f"🤖 Modelo: {model}")
            logger.info(f"🌡️ Temperatura: {temperature}")
            
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

# Crear instancia global
openai_service = OpenAIService() 