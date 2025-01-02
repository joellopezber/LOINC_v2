from typing import Optional, Any, Dict, Tuple
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
        logger.debug("💾 Inicializando Storage service")
        
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

    def _sanitize_value(self, value: Any) -> Any:
        """Limpia el valor eliminando tipos de datos no permitidos"""
        if isinstance(value, dict):
            return {k: self._sanitize_value(v) for k, v in value.items()}
        elif isinstance(value, list):
            return [self._sanitize_value(item) for item in value]
        elif isinstance(value, (str, int, float, bool, type(None))):
            return value
        else:
            logger.warning(f"⚠️ Eliminando valor de tipo no permitido: {type(value).__name__}")
            return None

    def _validate_value_size(self, value: Any) -> Tuple[bool, str]:
        """Valida el tamaño del valor"""
        try:
            size = len(json.dumps(value).encode('utf-8'))
            if size > self.MAX_VALUE_SIZE:
                return False, f"Valor demasiado grande: {size} bytes (máx {self.MAX_VALUE_SIZE})"
            return True, ""
        except Exception as e:
            return False, f"Error validando tamaño: {str(e)}"

    def set_value(self, key: str, value: Any, install_id: str) -> bool:
        """Establece un valor en el storage para un usuario específico"""
        try:
            # Validación básica de seguridad
            if not isinstance(key, str):
                logger.error(f"❌ Key debe ser string: {type(key)}")
                return False

            if not install_id:
                logger.error("❌ install_id es requerido")
                return False

            # Debug log
            logger.debug(f"📝 Intentando guardar - Key: {key}, InstallID: {install_id}")
            logger.debug(f"📦 Valor a guardar: {value}")

            # Limpiar valor de tipos no permitidos
            sanitized_value = self._sanitize_value(value)
            if sanitized_value != value:
                logger.warning(f"⚠️ Valor sanitizado para key {key}")
                logger.debug(f"Original: {value}")
                logger.debug(f"Sanitizado: {sanitized_value}")

            # Obtener almacenamiento del usuario
            user_storage = self._get_user_storage(install_id)

            # Log del valor si ha cambiado
            if self._has_value_changed(key, sanitized_value, install_id):
                if key == 'openaiApiKey':
                    logger.info(f"📥 {key}: [ENCRYPTED]")
                else:
                    logger.info(f"📥 {key}: {self._format_value_for_log(key, sanitized_value)}")
                self.last_values[key] = sanitized_value

            # Actualizar valor
            user_storage[key] = sanitized_value

            # Emitir actualización
            self.emit_update(key, sanitized_value, install_id)
            
            return True

        except Exception as e:
            logger.error(f"❌ Error guardando {key}: {str(e)}")
            return False

    def _validate_value(self, key: str, value: Any) -> Dict[str, Any]:
        """Valida la estructura del valor según el tipo"""
        try:
            # Validar tipos básicos permitidos
            if isinstance(value, (dict, list, str, int, float, bool, type(None))):
                # Validación específica por key
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
                elif key == 'openaiApiKey':
                    if not isinstance(value, str):
                        return {'valid': False, 'error': 'API Key debe ser una cadena de texto'}
                elif key == 'searchConfig':
                    if not isinstance(value, dict):
                        return {'valid': False, 'error': 'Configuración debe ser un diccionario'}
                elif key == 'installTimestamp':
                    if not isinstance(value, (int, str)):
                        return {'valid': False, 'error': 'Timestamp debe ser un número o cadena'}
                
                return {'valid': True, 'error': None}
            else:
                return {'valid': False, 'error': f'Tipo de dato no permitido: {type(value).__name__}'}
            
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
                # Mostrar solo el número total de parámetros
                if isinstance(value, dict):
                    total_params = (
                        len(value.get('search', {}).get('openai', {})) +
                        len(value.get('sql', {})) +
                        len(value.get('elastic', {}))
                    )
                    return f"Parámetros actualizados: {total_params}"
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
            from ..on_demand.openai_service import openai_service
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
                self.websocket.socketio.emit(
                    'storage.value_updated',
                    {'key': key, 'value': value},
                    room=install_id
                )
                logger.debug(f"📡 {key}: actualizado")
        except Exception as e:
            logger.error(f"❌ {key}: error en emisión: {str(e)}")

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
            from ..on_demand.openai_service import openai_service
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

# Crear instancia global
storage_service = StorageService() 