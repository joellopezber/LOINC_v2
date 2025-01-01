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
            # Almacenar datos por usuario usando installId como clave
            self.storage_data = {}
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

    def _get_user_storage(self, install_id: str) -> dict:
        """Obtiene el almacenamiento específico del usuario"""
        if install_id not in self.storage_data:
            self.storage_data[install_id] = {
                'searchConfig': {},
                'openaiApiKey': None,
                'installTimestamp': install_id,
                'ontologyResults': {}
            }
        return self.storage_data[install_id]

    def get_value(self, key: str, install_id: str) -> Any:
        """Obtiene un valor del storage para un usuario específico"""
        logger.debug(f"📤 [Storage:{key}] Obteniendo valor para usuario {install_id}")
        user_storage = self._get_user_storage(install_id)
        value = user_storage.get(key)
        logger.debug(f"📥 [Storage:{key}] Valor obtenido: {'[ENCRYPTED]' if key == 'openaiApiKey' else str(value)}")
        logger.debug(f"🗄️ [Storage] Estado actual: {json.dumps(self.storage_data, indent=2)}")
        return value

    def set_value(self, key: str, value: Any, install_id: str) -> bool:
        """Establece un valor en el storage para un usuario específico"""
        try:
            timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
            logger.debug(f"\n{'='*50}")
            logger.debug(f"⏱️ [{timestamp}] Iniciando operación para {key} (Usuario: {install_id})")
            logger.debug(f"{'='*50}")

            # Validar que la key sea permitida
            allowed_keys = ['searchConfig', 'openaiApiKey', 'installTimestamp', 'ontologyResults']
            if key not in allowed_keys:
                logger.error(f"❌ [Storage] Key no permitida: {key}")
                return False

            # Validar estructura del valor
            validation_result = self._validate_value(key, value)
            if not validation_result['valid']:
                logger.error(f"❌ [Storage:{key}] Error de validación: {validation_result['error']}")
                return False

            # Obtener almacenamiento del usuario
            user_storage = self._get_user_storage(install_id)

            # Log del valor si ha cambiado
            if self._has_value_changed(key, value, install_id):
                log_value = self._format_value_for_log(key, value)
                size = self._get_value_size(value)
                logger.info(f"📥 [Storage:{key}] Nuevo valor recibido para usuario {install_id}")
                logger.info(f"📊 Tamaño: {size} bytes")
                logger.info(f"📝 Contenido:\n{log_value}")
                self.last_values[key] = value

            # Actualizar valor
            user_storage[key] = value

            logger.info(f"💾 [Storage:{key}] Almacenado correctamente en {timestamp}")
            
            # Emitir actualización
            self.emit_update(key, value, install_id)
                
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

    def get_credentials(self, install_id: str) -> Optional[str]:
        """Obtiene las credenciales de OpenAI para un usuario específico"""
        try:
            # Obtener datos encriptados
            encrypted_key = self.get_value('openaiApiKey', install_id)

            if not encrypted_key:
                logger.error("❌ Credenciales no encontradas en storage")
                return None

            # Validación básica del formato
            if not encrypted_key.startswith('sk-'):
                logger.error("❌ API key inválida (debe empezar con sk-)")
                return None

            logger.info("✅ Credenciales obtenidas correctamente")
            return encrypted_key

        except Exception as e:
            logger.error(f"❌ Error obteniendo credenciales: {e}")
            return None

    def process_openai_test(self, install_id: str) -> Optional[Dict[str, Any]]:
        """Procesa un test de OpenAI usando los datos almacenados"""
        try:
            # 1. Obtener datos del test
            test_data = self.get_value('openai_test_data', install_id)
            if not test_data:
                logger.error("❌ No hay datos para el test")
                return None

            # 2. Validar datos necesarios
            text = test_data.get('text')
            if not text:
                logger.error("❌ No se proporcionó texto")
                return None

            # 3. Obtener OpenAI service
            from .openai_service import openai_service
            if not openai_service:
                logger.error("❌ OpenAI service no disponible")
                return None

            # 4. Inicializar si es necesario
            if not openai_service.initialized:
                if not openai_service.initialize():
                    logger.error("❌ Error inicializando OpenAI")
                    return None

            # 5. Procesar consulta usando las credenciales del usuario
            api_key = self.get_credentials(install_id)
            if not api_key:
                logger.error("❌ Credenciales no válidas")
                return None

            logger.info("🔄 Procesando consulta")
            response = openai_service.process_query(
                user_prompt=text,
                chat_history=test_data.get('messages', []),
                system_prompt=test_data.get('systemPrompt', ''),
                api_key=api_key
            )

            if not response:
                logger.error("❌ Sin respuesta de OpenAI")
                return None

            # 6. Preparar respuesta
            result = {
                'status': 'success',
                'response': response
            }
            
            return result

        except Exception as e:
            logger.error(f"❌ Error en test: {e}")
            return None

    def _has_value_changed(self, key: str, value: Any, install_id: str) -> bool:
        """Comprueba si el valor ha cambiado respecto al último almacenado"""
        if key not in self.last_values:
            return True
        try:
            current = json.dumps(self.last_values[key])
            new = json.dumps(value)
            return current != new
        except Exception:
            return True

    def emit_update(self, key: str, value: Any, install_id: str):
        """Emite una actualización a través de WebSocket"""
        try:
            if self.websocket and hasattr(self.websocket, 'socketio'):
                # Emitir solo al usuario correcto usando su installId
                self.websocket.socketio.emit(
                    'storage.value_updated',
                    {'key': key, 'value': value},
                    room=install_id  # Usar installId como room
                )
                logger.debug(f"📡 [Storage:{key}] Actualización emitida para usuario {install_id}")
        except Exception as e:
            logger.error(f"❌ [Storage:{key}] Error en emisión: {str(e)}")

    def get_all_for_user(self, install_id: str) -> Dict[str, Any]:
        """Obtiene todos los valores almacenados para un usuario específico"""
        return self._get_user_storage(install_id).copy()

    def process_openai_test(self, install_id: str) -> Optional[Dict[str, Any]]:
        """Procesa un test de OpenAI usando los datos almacenados"""
        try:
            # 1. Obtener datos del test
            test_data = self.get_value('openai_test_data', install_id)
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

            # 5. Procesar consulta usando las credenciales del usuario
            api_key = self.get_credentials(install_id)
            if not api_key:
                logger.error("❌ No se encontraron credenciales válidas")
                return None

            logger.info("🔄 Procesando consulta OpenAI...")
            response = openai_service.process_query(
                user_prompt=text,
                chat_history=test_data.get('messages', []),
                system_prompt=test_data.get('systemPrompt', ''),
                api_key=api_key
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