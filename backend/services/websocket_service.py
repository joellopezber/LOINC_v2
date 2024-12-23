from flask_socketio import SocketIO, emit
from typing import Dict, Any
import json
import eventlet
import logging
from .encryption_service import encryption_service

# Configurar logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

eventlet.monkey_patch()

class WebSocketService:
    def __init__(self, app):
        self.app = app
        self.socketio = SocketIO(
            app,
            cors_allowed_origins="*",
            async_mode='eventlet',
            logger=False,
            engineio_logger=False,
            transports=['websocket']
        )
        # Almacenamiento en memoria de la configuración
        self.storage_data = {
            'searchConfig': {},
            'openaiApiKey': None,
            'installTimestamp': None
        }
        # Almacenar último valor para comparar cambios
        self.last_values = {}
        self._setup_handlers()
            
    def _has_value_changed(self, key: str, new_value: Any) -> bool:
        """Comprueba si el valor ha cambiado respecto al último almacenado"""
        if key not in self.last_values:
            return True
        return self.last_values[key] != new_value

    def _log_value_update(self, key: str, value: Any, request_id: str):
        """Log formateado para actualizaciones de valores"""
        if self._has_value_changed(key, value):
            # Si el valor ha cambiado, mostrar JSON completo y formateado
            formatted_json = json.dumps({
                'key': key,
                'value': value,
                'request_id': request_id
            }, indent=2)
            logger.info(f"📥 Nuevo valor recibido:\n{formatted_json}")
            self.last_values[key] = value
        else:
            # Si no ha cambiado, mostrar versión simplificada
            logger.debug(f"📤 Solicitud set_value: key='{key}'")
            
    def _setup_handlers(self):
        @self.socketio.on('connect')
        def handle_connect(auth):
            logger.info("🔌 Cliente conectado")
            # No enviamos la master key en la conexión, esperamos el installTimestamp
            emit('connect_response', {'status': 'success'})
            
        @self.socketio.on('disconnect')
        def handle_disconnect():
            logger.info("🔌 Cliente desconectado")
            
        @self.socketio.on('encryption.get_master_key')
        def handle_get_master_key(data):
            """Maneja la solicitud de obtener la master key"""
            logger.info("Cliente solicitando master key")
            install_timestamp = data.get('installTimestamp')
            
            if not install_timestamp:
                logger.error("❌ No se proporcionó installTimestamp")
                emit('encryption.master_key', {'error': 'installTimestamp required'})
                return
                
            master_key = encryption_service.get_key_for_install(install_timestamp)
            emit('encryption.master_key', {'key': master_key})
            logger.info("Master key enviada al cliente")

        @self.socketio.on('storage.get_value')
        def handle_get_value(data: Dict[str, Any]):
            """Maneja la solicitud de valor del localStorage"""
            logger.info(f"📤 Enviando valor de: {data}")
            key = data.get('key')
            request_id = data.get('request_id')
            
            if key:
                value = self.storage_data.get(key)
                logger.info(f"📤 Enviando valor de: {key}")
                emit('storage_value', {
                    'value': value,
                    'request_id': request_id
                })
            else:
                logger.error("❌ Key no proporcionada")
                emit('storage_value', {
                    'error': 'Key not provided',
                    'request_id': request_id
                })
                
        @self.socketio.on('storage.set_value')
        def handle_set_value(data: Dict[str, Any]):
            """Maneja la solicitud de establecer un valor en localStorage"""
            key = data.get('key')
            value = data.get('value')
            request_id = data.get('request_id')
            
            # Validar que la key sea permitida
            allowed_keys = ['searchConfig', 'openaiApiKey', 'installTimestamp']
            if key not in allowed_keys:
                logger.error(f"❌ Key no permitida: {key}")
                emit('storage.value_set', {
                    'status': 'error',
                    'message': f'Key {key} no permitida',
                    'request_id': request_id
                })
                return
            
            if key and value is not None:
                # Log del valor recibido
                self._log_value_update(key, value, request_id)
                
                # Actualizar cache local
                self.storage_data[key] = value
                logger.info(f"💾 Almacenado: {key}")
                
                # Confirmar al cliente original
                emit('storage.value_set', {
                    'status': 'success',
                    'key': key,
                    'request_id': request_id
                })
                
                # Broadcast a todos los clientes excepto al emisor
                emit('storage.value_updated', {
                    'key': key,
                    'value': value
                }, broadcast=True, include_self=False)
                
                logger.debug(f"📡 Broadcast enviado: {key}")
            else:
                logger.error("❌ Key y value son requeridos")
                emit('storage.value_set', {
                    'status': 'error',
                    'message': 'Key and value are required',
                    'request_id': request_id
                })

        @self.socketio.on('storage.get_all')
        def handle_get_all(data: Dict[str, Any]):
            """Maneja la solicitud de obtener todos los valores"""
            logger.info("📤 Enviando todos los valores")
            request_id = data.get('request_id')
            
            # Enviar todos los valores almacenados
            emit('storage.all_values', {
                'values': self.storage_data,
                'request_id': request_id
            })
            logger.info("Todos los valores enviados")

        @self.socketio.on('search.perform')
        def handle_search(data: Dict[str, Any]):
            """Maneja las solicitudes de búsqueda"""
            logger.info(f"Recibida solicitud de búsqueda: {data}")
            term = data.get('term')
            config = data.get('config')
            request_id = data.get('request_id')

            if not term:
                logger.error("Error: Término de búsqueda no proporcionado")
                emit('search.results', {
                    'error': 'Search term is required',
                    'request_id': request_id
                })
                return

            try:
                # Log de la configuración para debug
                logger.debug(f"Configuración de búsqueda: {json.dumps(config, indent=2)}")
                logger.debug(f"Término de búsqueda: {term}")

                # TODO: Implementar la lógica de búsqueda aquí
                # Por ahora, solo devolvemos un mensaje de prueba
                results = {
                    'term': term,
                    'config': config,
                    'results': [],
                    'message': 'Búsqueda recibida correctamente'
                }

                emit('search.results', {
                    'status': 'success',
                    'data': results,
                    'request_id': request_id
                })
                logger.info(f"Resultados enviados para término: {term}")

            except Exception as e:
                logger.error(f"Error procesando búsqueda: {e}")
                emit('search.results', {
                    'status': 'error',
                    'error': str(e),
                    'request_id': request_id
                })

    def run(self, host: str = '0.0.0.0', port: int = 5001):
        self.socketio.run(self.app, host=host, port=port) 