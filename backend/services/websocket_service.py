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
        self._setup_handlers()
            
    def _setup_handlers(self):
        @self.socketio.on('connect')
        def handle_connect():
            logger.info("🔌 Cliente conectado")
            master_key = encryption_service.get_master_key()
            emit('encryption.master_key', {'key': master_key})
            emit('connect_response', {'status': 'success'})
            
        @self.socketio.on('disconnect')
        def handle_disconnect():
            logger.info("🔌 Cliente desconectado")
            
        @self.socketio.on('encryption.get_master_key')
        def handle_get_master_key():
            """Maneja la solicitud de obtener la master key"""
            logger.info("Cliente solicitando master key")
            master_key = encryption_service.get_master_key()
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
            logger.info(f"📤 Recibida solicitud set_value: {data}")
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