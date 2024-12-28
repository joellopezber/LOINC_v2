from flask_socketio import SocketIO, emit
from typing import Dict, Any
import json
import eventlet
import logging
from .encryption_service import encryption_service
from .master_key_service import master_key_service
from ..service_locator import service_locator
from ..lazy_load_service import LazyLoadService, lazy_load

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
        # Handlers básicos
        @self.socketio.on('connect')
        def handle_connect():
            logger.info("📡 Nueva conexión WebSocket")
            
        @self.socketio.on('disconnect')
        def handle_disconnect():
            logger.info("👋 Cliente desconectado")

        # Handler de encryption (core)
        @self.socketio.on('encryption.get_master_key')
        def handle_get_master_key(data):
            try:
                logger.info("🔐 Solicitud de master key recibida")
                
                if not isinstance(data, dict):
                    error_msg = "❌ Datos recibidos no son un diccionario válido"
                    logger.error(error_msg)
                    emit('encryption.master_key', {'status': 'error', 'message': error_msg})
                    return

                install_timestamp = data.get('installTimestamp')
                if not install_timestamp:
                    error_msg = "❌ No se proporcionó installTimestamp"
                    logger.error(error_msg)
                    emit('encryption.master_key', {'status': 'error', 'message': error_msg})
                    return

                master_key = master_key_service.get_key_for_install(install_timestamp)
                if not master_key:
                    error_msg = "❌ Error generando master key"
                    logger.error(error_msg)
                    emit('encryption.master_key', {'status': 'error', 'message': error_msg})
                    return

                logger.info("✅ Master key generada correctamente")
                emit('encryption.master_key', {
                    'status': 'success',
                    'key': master_key
                })

            except Exception as e:
                error_msg = f"❌ Error obteniendo master key: {str(e)}"
                logger.error(error_msg)
                emit('encryption.master_key', {'status': 'error', 'message': error_msg})

        # Handlers de storage (core)
        @self.socketio.on('storage.set_value')
        def handle_set_value(data: Dict[str, Any]):
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
                    emit('storage.value_set', {
                        'status': 'success',
                        'key': key,
                        'request_id': request_id
                    })
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