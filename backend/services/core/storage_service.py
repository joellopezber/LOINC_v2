from typing import Optional, Any, Dict
import logging
import time
from .encryption_service import encryption_service
from ..service_locator import service_locator
from ..lazy_load_service import LazyLoadService, lazy_load
import json

logger = logging.getLogger(__name__)

class StorageService(LazyLoadService):
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(StorageService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        """Inicializa el servicio de almacenamiento"""
        if hasattr(self, '_initialized'):
            return
            
        super().__init__()
        logger.info("💾 Inicializando Storage service...")
        
        try:
            self.storage_data = {
                'searchConfig': {},
                'openaiApiKey': None,
                'installTimestamp': None
            }
            self.last_values = {}
            self._websocket = None
            self._set_initialized(True)
            
        except Exception as e:
            self._set_initialized(False, str(e))
            raise

    @property
    @lazy_load('websocket')
    def websocket(self):
        """Obtiene el WebSocketService de forma lazy"""
        return self._websocket

    def emit_update(self, key: str, value: Any):
        """Emite una actualización a través de WebSocket"""
        try:
            if self.websocket and hasattr(self.websocket, 'socketio'):
                # Usar emit con namespace=None para broadcast global
                self.websocket.socketio.emit(
                    'storage.value_updated',
                    {'key': key, 'value': value},
                    namespace=None,
                    skip_sid=None  # Enviar a todos los clientes
                )
                logger.debug(f"📡 Emitida actualización: {key}")
        except Exception as e:
            logger.error(f"❌ Error emitiendo actualización: {e}")

    def _has_value_changed(self, key: str, new_value: Any) -> bool:
        """Comprueba si el valor ha cambiado respecto al último almacenado"""
        if key not in self.last_values:
            return True
        return self.last_values[key] != new_value

    def get_value(self, key: str) -> Any:
        """Obtiene un valor del storage"""
        logger.debug(f"📤 Obteniendo valor de: {key}")
        return self.storage_data.get(key)

    def set_value(self, key: str, value: Any) -> bool:
        """Establece un valor en el storage"""
        try:
            # Validar que la key sea permitida
            allowed_keys = ['searchConfig', 'openaiApiKey', 'installTimestamp', 'openai_test_data']
            if key not in allowed_keys:
                logger.error(f"❌ Key no permitida: {key}")
                return False

            # Log del valor si ha cambiado
            if self._has_value_changed(key, value):
                formatted_json = json.dumps({
                    'key': key,
                    'value': value
                }, indent=2)
                logger.info(f"📥 Nuevo valor recibido:\n{formatted_json}")
                self.last_values[key] = value

            # Actualizar valor
            if key == 'searchConfig':
                self.storage_data[key] = value.get('value', value)
            else:
                self.storage_data[key] = value

            logger.info(f"💾 Almacenado: {key}")
            
            # Emitir actualización solo si no es un dato temporal de test
            if key != 'openai_test_data':
                self.emit_update(key, value)
            
            return True

        except Exception as e:
            logger.error(f"❌ Error almacenando valor: {e}")
            return False

    def get_all(self) -> Dict[str, Any]:
        """Obtiene todos los valores almacenados"""
        return self.storage_data.copy()

    def get_credentials(self) -> Optional[str]:
        """Obtiene y desencripta las credenciales de OpenAI"""
        try:
            # Obtener credenciales encriptadas
            encrypted_key = self.get_value('openaiApiKey')
            install_timestamp = self.get_value('installTimestamp')

            if not encrypted_key or not install_timestamp:
                logger.error("❌ Credenciales no encontradas en storage")
                return None

            # Desencriptar API key
            from .encryption_service import encryption_service
            api_key = encryption_service.decrypt(encrypted_key, install_timestamp)

            if not api_key:
                logger.error("❌ Error desencriptando API key")
                return None

            if not api_key.startswith('sk-'):
                logger.error("❌ API key inválida (debe empezar con sk-)")
                return None

            logger.info("✅ Credenciales obtenidas correctamente")
            return api_key

        except Exception as e:
            logger.error(f"❌ Error obteniendo credenciales: {e}")
            return None 

    def process_openai_test(self) -> Optional[Dict[str, Any]]:
        """Procesa un test de OpenAI usando los datos almacenados"""
        try:
            # 1. Obtener datos del test
            test_data = self.get_value('openai_test_data')
            if not test_data:
                logger.error("❌ No hay datos para el test OpenAI")
                return None

            # 2. Validar datos necesarios
            text = test_data.get('text')
            if not text:
                logger.error("❌ No se proporcionó texto para la consulta")
                return None

            # 3. Obtener OpenAI service de forma lazy
            from .openai_service import openai_service
            if not openai_service:
                logger.error("❌ No se pudo obtener OpenAI service")
                return None

            # 4. Inicializar si es necesario
            if not openai_service.initialized:
                logger.info("🔄 Inicializando OpenAI service...")
                if not openai_service.initialize():
                    logger.error("❌ Error inicializando OpenAI service")
                    return None
                logger.info("✅ OpenAI service inicializado")

            # 5. Procesar consulta
            logger.info("🔄 Procesando consulta OpenAI...")
            response = openai_service.process_query(
                user_prompt=text,
                chat_history=test_data.get('messages', []),
                system_prompt=test_data.get('systemPrompt', '')
            )

            if not response:
                logger.error("❌ No se obtuvo respuesta de OpenAI")
                return None

            # 6. Preparar respuesta
            result = {
                'status': 'success',
                'response': response
            }
            
            return result

        except Exception as e:
            logger.error(f"❌ Error procesando test OpenAI: {e}")
            return None 