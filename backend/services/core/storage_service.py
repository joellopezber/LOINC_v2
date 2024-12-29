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
                'installTimestamp': None,
                'ontologyResults': {}
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
                    skip_sid=None
                )
                logger.debug(f"📡 [Storage:{key}] Actualización emitida")
        except Exception as e:
            logger.error(f"❌ [Storage:{key}] Error en emisión: {str(e)}")

    def _has_value_changed(self, key: str, new_value: Any) -> bool:
        """Comprueba si el valor ha cambiado respecto al último almacenado"""
        if key not in self.last_values:
            return True
        return self.last_values[key] != new_value

    def get_value(self, key: str) -> Any:
        """Obtiene un valor del storage"""
        logger.debug(f"📤 [Storage:{key}] Obteniendo valor")
        return self.storage_data.get(key)

    def set_value(self, key: str, value: Any) -> bool:
        """Establece un valor en el storage"""
        try:
            timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
            logger.debug(f"\n{'='*50}")
            logger.debug(f"⏱️ [{timestamp}] Iniciando operación para {key}")
            logger.debug(f"{'='*50}")

            # Validar que la key sea permitida
            allowed_keys = ['searchConfig', 'openaiApiKey', 'installTimestamp', 'openai_test_data', 'ontologyResults']
            if key not in allowed_keys:
                logger.error(f"❌ [Storage] Key no permitida: {key}")
                return False

            # Validar estructura del valor
            validation_result = self._validate_value(key, value)
            if not validation_result['valid']:
                logger.error(f"❌ [Storage:{key}] Error de validación: {validation_result['error']}")
                return False

            # Log del valor si ha cambiado
            if self._has_value_changed(key, value):
                # Formatear el valor para el log según el tipo
                log_value = self._format_value_for_log(key, value)
                size = self._get_value_size(value)
                logger.info(f"📥 [Storage:{key}] Nuevo valor recibido")
                logger.info(f"📊 Tamaño: {size} bytes")
                logger.info(f"📝 Contenido:\n{log_value}")
                self.last_values[key] = value

            # Actualizar valor
            if key == 'searchConfig':
                self.storage_data[key] = value.get('value', value)
            else:
                self.storage_data[key] = value

            logger.info(f"💾 [Storage:{key}] Almacenado correctamente en {timestamp}")
            
            # Emitir actualización solo si no es un dato temporal de test
            if key != 'openai_test_data':
                self.emit_update(key, value)
                
            logger.debug(f"{'='*50}\n")
            
            return True

        except Exception as e:
            logger.error(f"❌ [Storage:{key}] Error: {str(e)}")
            return False

    def _validate_value(self, key: str, value: Any) -> Dict[str, Any]:
        """Valida la estructura del valor según el tipo"""
        try:
            if key == 'ontologyResults':
                if not isinstance(value, dict):
                    return {'valid': False, 'error': 'Debe ser un diccionario'}
                for term, data in value.items():
                    if not isinstance(data, dict):
                        return {'valid': False, 'error': f'Datos inválidos para término {term}'}
                    required_fields = ['data', 'timestamp', 'searchCount']
                    missing_fields = [f for f in required_fields if f not in data]
                    if missing_fields:
                        return {'valid': False, 'error': f'Campos faltantes: {missing_fields}'}
            return {'valid': True, 'error': None}
        except Exception as e:
            return {'valid': False, 'error': str(e)}

    def _get_value_size(self, value: Any) -> int:
        """Calcula el tamaño aproximado del valor en bytes"""
        try:
            return len(json.dumps(value).encode('utf-8'))
        except Exception:
            return 0

    def _format_value_for_log(self, key: str, value: Any) -> str:
        """Formatea el valor para el log según el tipo de dato"""
        try:
            if key == 'ontologyResults':
                # Para ontologyResults, mostrar resumen detallado
                num_results = len(value) if isinstance(value, dict) else 0
                if num_results > 0:
                    last_term = list(value.keys())[-1]
                    last_data = value[last_term]
                    return (
                        f"Total términos: {num_results}\n"
                        f"Último término: {last_term}\n"
                        f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(last_data['timestamp']/1000))}\n"
                        f"Búsquedas: {last_data['searchCount']}"
                    )
                return "Sin resultados"
            elif key == 'openaiApiKey':
                return "********"
            elif key == 'searchConfig':
                # Mostrar resumen de la configuración
                if isinstance(value, dict):
                    search = value.get('search', {})
                    return (
                        f"Modo ontología: {search.get('ontologyMode', 'N/A')}\n"
                        f"Modo DB: {search.get('dbMode', 'N/A')}\n"
                        f"OpenAI config: {len(search.get('openai', {}))} opciones\n"
                        f"SQL config: {len(value.get('sql', {}))} opciones\n"
                        f"Elastic config: {len(value.get('elastic', {}))} opciones"
                    )
                return str(value)
            else:
                return json.dumps(value, indent=2)
        except Exception as e:
            return f"Error formateando valor: {str(e)}"

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