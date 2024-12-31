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

    def _get_credentials(self, install_id):
        """Obtiene y desencripta las credenciales desde storage"""
        try:
            logger.info(f"\n{'='*50}")
            logger.info(f"🔑 Obteniendo credenciales para install_id: {install_id}")
            
            if not self.storage:
                logger.error("❌ No se pudo obtener StorageService")
                return None

            # Obtener credenciales encriptadas
            logger.info("📤 Solicitando API key del storage...")
            encrypted_key = self.storage.get_value('openaiApiKey', install_id)
            logger.info(f"📥 API key encriptada: {'[ENCONTRADA]' if encrypted_key else '[NO ENCONTRADA]'}")

            if not encrypted_key:
                logger.error("❌ API key no encontrada - Necesita configuración")
                return None

            # Obtener servicio de encriptación
            encryption_service = service_locator.get('encryption')
            if not encryption_service:
                logger.error("❌ No se pudo obtener encryption service")
                return None

            # Desencriptar API key
            logger.info("🔓 Desencriptando API key...")
            api_key = encryption_service.decrypt(encrypted_key, install_id)
            logger.info(f"🔐 API key desencriptada: {'[OK]' if api_key else '[ERROR]'}")

            if not api_key:
                logger.error("❌ Error desencriptando API key")
                return None

            logger.info("✅ API key obtenida y desencriptada correctamente")
            logger.info(f"{'='*50}\n")
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
        install_id: str,
        chat_history: List[Dict[str, str]] = None,
        model: str = DEFAULT_MODEL,
        temperature: float = DEFAULT_TEMPERATURE,
        system_prompt: str = DEFAULT_SYSTEM_PROMPT
    ) -> Optional[str]:
        """Procesa una consulta usando OpenAI"""
        if not user_prompt:
            return "Se requiere un mensaje para procesar"

        if not install_id:
            return "Se requiere ID de instalación"

        try:
            # Log de parámetros
            logger.info(f"🔄 Procesando consulta:")
            logger.info(f"📝 Prompt: {user_prompt[:50]}...")
            logger.info(f"🤖 Modelo: {model}")
            logger.info(f"🌡️ Temperatura: {temperature}")
            
            # Inicializar cliente si es necesario
            if not self.client:
                api_key = self._get_credentials(install_id)
                if not api_key:
                    return "Por favor, configura tu API key de OpenAI en el panel de configuración antes de continuar"
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