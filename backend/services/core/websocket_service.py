from flask_socketio import SocketIO, emit
from typing import Dict, Any
import json
import eventlet
import logging
from .encryption_service import encryption_service
from .master_key_service import master_key_service
from ..service_locator import service_locator
from .lazy_load_service import LazyLoadService, lazy_load

# Configurar logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

eventlet.monkey_patch()

class WebSocketService(LazyLoadService):
    def __init__(self, app):
        """Inicializa el servicio WebSocket"""
        super().__init__()
        logger.info("🔌 Inicializando WebSocket")
        
        try:
            self.app = app
            self.socketio = SocketIO(app, cors_allowed_origins="*")
            self._storage = None
            self._setup_handlers()
            self._set_initialized(True)
            
        except Exception as e:
            self._set_initialized(False, str(e))
            raise
    
    @property
    @lazy_load('storage')
    def storage(self):
        """Obtiene el StorageService de forma lazy"""
        return self._storage

    def _setup_handlers(self):
        @self.socketio.on('connect')
        def handle_connect():
            """Maneja la conexión de un cliente"""
            logger.info("📡 Nueva conexión WebSocket")
            
        @self.socketio.on('disconnect')
        def handle_disconnect():
            """Maneja la desconexión de un cliente"""
            logger.info("👋 Cliente desconectado")

        @self.socketio.on('encryption.get_master_key')
        def handle_get_master_key(data):
            """Maneja la solicitud de obtener la master key"""
            try:
                logger.info("🔐 Solicitud de master key recibida")
                
                # 1. Validar datos
                if not isinstance(data, dict):
                    error_msg = "❌ Datos recibidos no son un diccionario válido"
                    logger.error(error_msg)
                    emit('encryption.master_key', {'status': 'error', 'message': error_msg})
                    return

                # 2. Obtener timestamp
                install_timestamp = data.get('installTimestamp')
                if not install_timestamp:
                    error_msg = "❌ No se proporcionó installTimestamp"
                    logger.error(error_msg)
                    emit('encryption.master_key', {'status': 'error', 'message': error_msg})
                    return

                # 3. Obtener master key usando el servicio dedicado
                master_key = master_key_service.get_key_for_install(install_timestamp)
                if not master_key:
                    error_msg = "❌ Error generando master key"
                    logger.error(error_msg)
                    emit('encryption.master_key', {'status': 'error', 'message': error_msg})
                    return

                # 4. Enviar respuesta
                logger.info("✅ Master key generada correctamente")
                emit('encryption.master_key', {
                    'status': 'success',
                    'key': master_key
                })

            except Exception as e:
                error_msg = f"❌ Error obteniendo master key: {str(e)}"
                logger.error(error_msg)
                emit('encryption.master_key', {'status': 'error', 'message': error_msg})

        @self.socketio.on('openai.test_search')
        def handle_test_search(data):
            """Maneja la solicitud de prueba de búsqueda con OpenAI"""
            try:
                logger.info("\n🔍 Iniciando prueba OpenAI...")
                logger.info(f"📦 Datos recibidos: {json.dumps(data, indent=2)}")
                
                # 1. Validar datos de entrada
                if not isinstance(data, dict):
                    error_msg = "❌ Datos recibidos no son un diccionario válido"
                    logger.error(error_msg)
                    emit('openai.test_result', {'status': 'error', 'message': error_msg})
                    return

                # 2. Almacenar datos en storage
                if not self.storage:
                    error_msg = "❌ StorageService no disponible"
                    logger.error(error_msg)
                    emit('openai.test_result', {'status': 'error', 'message': error_msg})
                    return

                # Almacenar datos temporales para el test
                self.storage.set_value('openai_test_data', {
                    'text': data.get('text'),
                    'messages': data.get('messages', []),
                    'systemPrompt': data.get('systemPrompt', '')
                })
                
                # 3. Obtener respuesta del storage
                response = self.storage.process_openai_test()
                
                # 4. Enviar respuesta
                logger.info(f"📤 Enviando resultado: {json.dumps(response, indent=2)}")
                emit('openai.test_result', {
                    'status': 'success',
                    'query': data.get('text', ''),
                    'response': response.get('response') if response else None
                })
                
            except Exception as e:
                error_msg = f"❌ Error en handle_test_search: {str(e)}"
                logger.error(error_msg)
                emit('openai.test_result', {'status': 'error', 'message': error_msg})

        @self.socketio.on('storage.set_value')
        def handle_set_value(data: Dict[str, Any]):
            """Maneja la solicitud de establecer un valor"""
            key = data.get('key')
            value = data.get('value')
            request_id = data.get('request_id')
            
            if not self.storage:
                error_msg = "❌ StorageService no disponible"
                logger.error(error_msg)
                emit('storage.value_set', {
                    'status': 'error',
                    'message': error_msg,
                    'request_id': request_id
                })
                return
                
            if key and value is not None:
                if self.storage.set_value(key, value):
                    # Confirmar al cliente original
                    emit('storage.value_set', {
                        'status': 'success',
                        'key': key,
                        'request_id': request_id
                    })
                    
                    # Broadcast a todos excepto al emisor
                    emit('storage.value_updated', {
                        'key': key,
                        'value': value
                    }, broadcast=True, include_self=False)
                else:
                    emit('storage.value_set', {
                        'status': 'error',
                        'message': 'Error setting value',
                        'request_id': request_id
                    })
            else:
                emit('storage.value_set', {
                    'status': 'error',
                    'message': 'Key and value are required',
                    'request_id': request_id
                })

        @self.socketio.on('storage.get_value')
        def handle_get_value(data: Dict[str, Any]):
            """Maneja la solicitud de obtener un valor"""
            key = data.get('key')
            request_id = data.get('request_id')
            
            if not self.storage:
                error_msg = "❌ StorageService no disponible"
                logger.error(error_msg)
                emit('storage.value', {
                    'error': error_msg,
                    'request_id': request_id
                })
                return
                
            if key:
                value = self.storage.get_value(key)
                emit('storage.value', {
                    'value': value,
                    'request_id': request_id
                })
            else:
                emit('storage.value', {
                    'error': 'Key not provided',
                    'request_id': request_id
                })

    def run(self, host: str = '0.0.0.0', port: int = 5001):
        self.socketio.run(self.app, host=host, port=port) 