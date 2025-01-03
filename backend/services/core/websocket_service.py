from flask_socketio import SocketIO, emit
from typing import Dict, Any, Optional, Tuple
import json
import eventlet
import logging
from .encryption_service import encryption_service
from .master_key_service import master_key_service
from ..service_locator import service_locator
from ..lazy_load_service import LazyLoadService, lazy_load
import time
from flask import request

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

    def _emit_error(self, event: str, message: str, request_id: Optional[str] = None):
        """Emite un error estandarizado"""
        logger.error(f"❌ {event}: {message}")
        emit(event, {
            'status': 'error',
            'message': message,
            'request_id': request_id
        })

    def _validate_storage(self, event: str, request_id: Optional[str] = None) -> bool:
        """Valida que el storage esté disponible"""
        if not self.storage:
            self._emit_error(event, "StorageService no disponible", request_id)
            return False
        return True

    def _validate_data(self, data: Dict[str, Any], required_fields: list, 
                      event: str) -> Tuple[bool, Optional[str], Optional[str]]:
        """Valida los datos recibidos"""
        if not isinstance(data, dict):
            return False, "Datos inválidos", data.get('request_id')
            
        request_id = data.get('request_id')
        missing = [f for f in required_fields if f not in data]
        
        if missing:
            return False, f"Campos requeridos: {', '.join(missing)}", request_id
            
        return True, None, request_id

    def _setup_handlers(self):
        # Handlers básicos
        @self.socketio.on('connect')
        def handle_connect():
            """Handler de conexión WebSocket"""
            sid = request.sid
            environ = request.environ
            self.handle_connect(sid, environ)

        @self.socketio.on('disconnect')
        def handle_disconnect():
            """Handler de desconexión WebSocket"""
            sid = request.sid
            self.handle_disconnect(sid)

        # Handler de encryption (core)
        @self.socketio.on('encryption.get_master_key')
        def handle_get_master_key(data):
            try:
                if not isinstance(data, dict):
                    logger.error("❌ master_key: datos inválidos")
                    emit('encryption.master_key', {
                        'status': 'error', 
                        'message': 'Datos inválidos',
                        'request_id': data.get('request_id')
                    })
                    return

                install_timestamp = data.get('installTimestamp')
                request_id = data.get('request_id')
                
                if not install_timestamp:
                    logger.error("❌ master_key: falta installTimestamp")
                    emit('encryption.master_key', {
                        'status': 'error', 
                        'message': 'installTimestamp requerido',
                        'request_id': request_id
                    })
                    return

                # Delegar obtención de master key al encryption_service
                master_key = encryption_service.get_key_for_install(install_timestamp)
                
                if not master_key:
                    logger.error("❌ master_key: error generando key")
                    emit('encryption.master_key', {
                        'status': 'error', 
                        'message': 'Error generando key',
                        'request_id': request_id
                    })
                    return

                logger.debug("✓ master_key: enviada")
                emit('encryption.master_key', {
                    'status': 'success',
                    'key': master_key,
                    'request_id': request_id
                })

            except Exception as e:
                logger.error(f"❌ master_key: {str(e)}")
                emit('encryption.master_key', {
                    'status': 'error', 
                    'message': str(e)
                })

        # Handlers de storage (core)
        @self.socketio.on('storage.get_all_for_user')
        def handle_get_all_for_user(data: Dict[str, Any]):
            logger.info("📥 Solicitud de storage.get_all_for_user recibida")
            
            # Validar datos
            is_valid, error, request_id = self._validate_data(
                data, ['install_id'], 'storage.all_data'
            )
            if not is_valid:
                self._emit_error('storage.all_data', error, request_id)
                return

            # Validar storage
            if not self._validate_storage('storage.all_data', request_id):
                return

            try:
                install_id = data['install_id']
                logger.debug(f"Obteniendo datos para install_id: {install_id}")
                all_data = self.storage.get_all_for_user(install_id)
                
                emit('storage.all_data', {
                    'status': 'success',
                    'data': all_data,
                    'request_id': request_id
                })
                logger.info("✅ Datos enviados correctamente")
                
            except Exception as e:
                self._emit_error('storage.all_data', str(e), request_id)
        
        @self.socketio.on('storage.set_value')
        def handle_set_value(data: Dict[str, Any]):
            logger.info("📥 Solicitud de storage.set_value recibida")
            
            # Validar datos
            is_valid, error, request_id = self._validate_data(
                data, ['key', 'value', 'install_id'], 'storage.value_set'
            )
            if not is_valid:
                self._emit_error('storage.value_set', error, request_id)
                return

            # Validar storage
            if not self._validate_storage('storage.value_set', request_id):
                return

            try:
                key = data['key']
                value = data['value']
                install_id = data['install_id']
                
                logger.debug(f"Guardando valor - Key: {key}, InstallID: {install_id}")
                
                if self.storage.set_value(key, value, install_id):
                    emit('storage.value_set', {
                        'status': 'success',
                        'key': key,
                        'request_id': request_id
                    })
                    # Notificar a otros clientes
                    emit('storage.value_updated', {
                        'key': key,
                        'value': value
                    }, broadcast=True, include_self=False)
                    logger.info(f"✅ Valor guardado y notificado: {key}")
                else:
                    self._emit_error('storage.value_set', 'Error guardando valor', request_id)
                    
            except Exception as e:
                self._emit_error('storage.value_set', str(e), request_id)
                
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
        """Manejador de conexión de cliente WebSocket"""
        try:
            ip = environ.get('HTTP_X_REAL_IP', environ.get('REMOTE_ADDR', 'desconocida'))
            self.active_connections[sid] = {
                'ip': ip,
                'connected_at': time.time(),
                'last_activity': time.time()
            }
            
            log_message = f"""INFO: ====================👥 Conexiones activas: {len(self.active_connections)} ===================
📡 Nueva conexión WebSocket  -  ID: {sid} - IP: {ip}
============================================================================\n"""
            logger.info(log_message)

        except Exception as e:
            logger.error(f"❌ Error en handle_connect: {e}")
            
    def handle_disconnect(self, sid):
        """Manejador de desconexión de cliente WebSocket"""
        try:
            if sid in self.active_connections:
                del self.active_connections[sid]
            
            log_message = f"""====================👥 Conexiones activas: {len(self.active_connections)} ===================
👋 Desconexión WebSocket  -  ID: {sid}
============================================================================\n"""
            logger.info(log_message)
        except Exception as e:
            logger.error(f"❌ Error en handle_disconnect: {e}")

    def handle_error(self, sid, error):
        """Maneja errores de WebSocket"""
        client = self.active_connections.get(sid, {})
        self.logger.error(
            f"\n{'='*50}\n"
            f"❌ Error WebSocket  -  ID: {sid} - IP: {client.get('ip', 'unknown')}\n"
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