from flask_socketio import SocketIO, emit
from typing import Dict, Any
import json
import eventlet
import logging
from .encryption_service import encryption_service
from .master_key_service import master_key_service
from ..service_locator import service_locator
from ..lazy_load_service import LazyLoadService, lazy_load
import time

# Configurar logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

eventlet.monkey_patch()

class WebSocketService(LazyLoadService):
    def __init__(self, app):
        """Inicializa el servicio WebSocket"""
        super().__init__()
        self.active_connections = {}
        self.logger = logging.getLogger(__name__)
        self.logger.info("🔌 Inicializando WebSocket")
        
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
        def handle_connect(sid, environ):
            self.handle_connect(sid, environ)

        @self.socketio.on('disconnect')
        def handle_disconnect(sid):
            self.handle_disconnect(sid)

        # Handler de encryption (core)
        @self.socketio.on('encryption.get_master_key')
        def handle_get_master_key(data):
            try:
                logger.info("🔐 Solicitud de master key recibida")
                
                if not isinstance(data, dict):
                    error_msg = "❌ Datos recibidos no son un diccionario válido"
                    logger.error(error_msg)
                    emit('encryption.master_key', {
                        'status': 'error', 
                        'message': error_msg,
                        'request_id': data.get('request_id')
                    })
                    return

                install_timestamp = data.get('installTimestamp')
                request_id = data.get('request_id')
                
                if not install_timestamp:
                    error_msg = "❌ No se proporcionó installTimestamp"
                    logger.error(error_msg)
                    emit('encryption.master_key', {
                        'status': 'error', 
                        'message': error_msg,
                        'request_id': request_id
                    })
                    return

                # Delegar obtención de master key al encryption_service
                master_key = encryption_service.get_key_for_install(install_timestamp)
                
                if not master_key:
                    error_msg = "❌ Error generando master key"
                    logger.error(error_msg)
                    emit('encryption.master_key', {
                        'status': 'error', 
                        'message': error_msg,
                        'request_id': request_id
                    })
                    return

                logger.info("✅ Master key generada correctamente")
                emit('encryption.master_key', {
                    'status': 'success',
                    'key': master_key,
                    'request_id': request_id
                })

            except Exception as e:
                error_msg = f"❌ Error obteniendo master key: {str(e)}"
                logger.error(error_msg)
                emit('encryption.master_key', {'status': 'error', 'message': error_msg})

        # Handlers de storage (core)
        @self.socketio.on('storage.get_all_for_user')
        def handle_get_all_for_user(data: Dict[str, Any]):
            logger.info("📥 Solicitud de storage.get_all_for_user recibida")
            logger.debug(f"Datos recibidos: {data}")
            
            install_id = data.get('install_id')
            request_id = data.get('request_id')
            
            if not self.storage:
                error_msg = "❌ StorageService no disponible"
                logger.error(error_msg)
                emit('storage.all_data', {
                    'status': 'error',
                    'message': error_msg,
                    'request_id': request_id
                })
                return
                
            if not install_id:
                error_msg = "install_id es requerido"
                logger.error(error_msg)
                emit('storage.all_data', {
                    'status': 'error',
                    'message': error_msg,
                    'request_id': request_id
                })
                return

            try:
                logger.debug(f"Obteniendo datos para install_id: {install_id}")
                all_data = self.storage.get_all_for_user(install_id)
                logger.debug(f"Datos obtenidos: {all_data}")
                
                emit('storage.all_data', {
                    'status': 'success',
                    'data': all_data,
                    'request_id': request_id
                })
                logger.info("✅ Datos enviados correctamente")
                
            except Exception as e:
                error_msg = f"Error en handle_get_all_for_user: {e}"
                logger.error(error_msg)
                emit('storage.all_data', {
                    'status': 'error',
                    'message': str(e),
                    'request_id': request_id
                })
        
        @self.socketio.on('storage.set_value')
        def handle_set_value(data: Dict[str, Any]):
            key = data.get('key')
            value = data.get('value')
            install_id = data.get('install_id')
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
                
            if not all([key, value, install_id]):
                error_msg = "Key, value e install_id son requeridos"
                logger.error(error_msg)
                emit('storage.value_set', {
                    'status': 'error',
                    'message': error_msg,
                    'request_id': request_id
                })
                return

            try:
                if self.storage.set_value(key, value, install_id):
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
            except Exception as e:
                logger.error(f"Error en handle_set_value: {e}")
                emit('storage.value_set', {
                    'status': 'error',
                    'message': str(e),
                    'request_id': request_id
                })
                
        @self.socketio.on('storage.get_value')
        def handle_get_value(data: Dict[str, Any]):
            key = data.get('key')
            request_id = data.get('request_id')
            install_id = data.get('install_id')
            
            if not self.storage:
                error_msg = "❌ StorageService no disponible"
                logger.error(error_msg)
                emit('storage.value', {
                    'status': 'error',
                    'message': error_msg,
                    'request_id': request_id
                })
                return
                
            if not all([key, install_id]):
                error_msg = "Key e install_id son requeridos"
                logger.error(error_msg)
                emit('storage.value', {
                    'status': 'error',
                    'message': error_msg,
                    'request_id': request_id
                })
                return

            try:
                value = self.storage.get_value(key, install_id)
                emit('storage.value', {
                    'status': 'success',
                    'value': value,
                    'request_id': request_id
                })
            except Exception as e:
                logger.error(f"Error en handle_get_value: {e}")
                emit('storage.value', {
                    'status': 'error',
                    'message': str(e),
                    'request_id': request_id
                })

    def handle_connect(self, sid, environ):
        """Maneja nueva conexión WebSocket"""
        timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
        client_info = {
            'sid': sid,
            'ip': environ.get('REMOTE_ADDR', 'unknown'),
            'user_agent': environ.get('HTTP_USER_AGENT', 'unknown'),
            'connected_at': time.time(),
            'last_activity': time.time()
        }
        self.active_connections[sid] = client_info
        
        self.logger.info(
            f"\n{'='*50}\n"
            f"📡 Nueva conexión WebSocket\n"
            f"🔍 ID: {sid}\n"
            f"⏰ Timestamp: {timestamp}\n"
            f"🌐 IP: {client_info['ip']}\n"
            f"📱 User Agent: {client_info['user_agent']}\n"
            f"👥 Conexiones activas: {len(self.active_connections)}\n"
            f"{'='*50}"
        )

    def handle_disconnect(self, sid):
        """Maneja desconexión WebSocket"""
        if sid in self.active_connections:
            client = self.active_connections[sid]
            duration = time.time() - client['connected_at']
            timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
            
            self.logger.info(
                f"\n{'='*50}\n"
                f"👋 Desconexión WebSocket\n"
                f"🔍 ID: {sid}\n"
                f"⏰ Timestamp: {timestamp}\n"
                f"⏱️ Duración: {int(duration)}s\n"
                f"🌐 IP: {client['ip']}\n"
                f"👥 Conexiones restantes: {len(self.active_connections) - 1}\n"
                f"{'='*50}"
            )
            
            del self.active_connections[sid]

    def handle_error(self, sid, error):
        """Maneja errores de WebSocket"""
        timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
        client = self.active_connections.get(sid, {})
        
        self.logger.error(
            f"\n{'='*50}\n"
            f"❌ Error en WebSocket\n"
            f"🔍 ID: {sid}\n"
            f"⏰ Timestamp: {timestamp}\n"
            f"🌐 IP: {client.get('ip', 'unknown')}\n"
            f"💥 Error: {str(error)}\n"
            f"{'='*50}"
        )

    def update_activity(self, sid):
        """Actualiza timestamp de última actividad"""
        if sid in self.active_connections:
            self.active_connections[sid]['last_activity'] = time.time()

    def get_connection_info(self, sid):
        """Obtiene información de una conexión"""
        return self.active_connections.get(sid)

    def run(self, host: str = '0.0.0.0', port: int = 5001):
        self.socketio.run(self.app, host=host, port=port) 

    async def handle_set_value(self, key: str, value: Any, install_id: str) -> Dict[str, Any]:
        """
        Maneja la petición de guardar un valor
        
        Args:
            key: Clave a guardar
            value: Valor a guardar
            install_id: ID de instalación del cliente
            
        Returns:
            dict: Estado de la operación
        """
        try:
            logger.debug(f"Guardando valor para key={key}, install_id={install_id}")
            if self.storage.set_value(key, value, install_id):
                logger.debug(f"Valor guardado correctamente para key={key}")
                return {'status': 'success'}
            logger.error(f"Error guardando valor para key={key}")
            return {'status': 'error', 'message': 'Error guardando valor'}
        except Exception as e:
            logger.error(f"Error en handle_set_value: {e}")
            return {'status': 'error', 'message': str(e)} 