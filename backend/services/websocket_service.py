from flask_socketio import SocketIO, emit
from typing import Dict, Any
import json
import eventlet
eventlet.monkey_patch()

class WebSocketService:
    def __init__(self, app):
        self.app = app
        self.socketio = SocketIO(
            app,
            cors_allowed_origins="*",
            async_mode='eventlet',
            logger=True,
            engineio_logger=True,
            transports=['websocket']
        )
        self.pending_requests = {}
        self._setup_handlers()
        
    def _setup_handlers(self):
        @self.socketio.on('connect')
        def handle_connect():
            print("Cliente conectado")
            emit('connect_response', {'status': 'success'})
            
        @self.socketio.on('disconnect')
        def handle_disconnect():
            print("Cliente desconectado")
            
        @self.socketio.on('storage.get_value')
        def handle_get_value(data: Dict[str, Any]):
            """Maneja la solicitud de valor del localStorage"""
            key = data.get('key')
            if key:
                # Aquí simularemos obtener el valor del storage
                # En una implementación real, esto vendría del frontend
                mock_data = {
                    'searchConfig': {
                        'search': {
                            'ontologyMode': 'multi_match',
                            'dbMode': 'elastic'
                        },
                        'elastic': {
                            'limits': {
                                'maxTotal': 100,
                                'maxPerKeyword': 10
                            }
                        }
                    }
                }
                emit('storage.value', {'value': mock_data.get(key)})
            else:
                emit('storage.value', {'error': 'Key not provided'})
                
        @self.socketio.on('storage.set_value')
        def handle_set_value(data: Dict[str, Any]):
            """Maneja la solicitud de establecer un valor en localStorage"""
            key = data.get('key')
            value = data.get('value')
            
            if key and value is not None:
                # Aquí simularemos guardar el valor
                # En una implementación real, esto se sincronizaría con el frontend
                print(f"Guardando valor para {key}: {json.dumps(value, indent=2)}")
                emit('storage.value_set', {
                    'status': 'success',
                    'key': key
                })
            else:
                emit('storage.value_set', {
                    'status': 'error',
                    'message': 'Key and value are required'
                })
                
        @self.socketio.on('storage.get_tables')
        def handle_get_tables():
            """Maneja la solicitud de tablas disponibles"""
            # Aquí simularemos las tablas disponibles
            # En una implementación real, esto vendría del frontend
            mock_tables = ['searchConfig', 'apiKeys', 'history']
            emit('storage.tables_received', {
                'status': 'success',
                'tables': mock_tables
            })
            
    def get_storage_value(self, key: str) -> Any:
        """
        Solicita un valor del localStorage
        """
        request_id = f"req_{len(self.pending_requests)}"
        
        # Solicitar el valor al frontend
        self.socketio.emit('storage.get_value', {
            'request_id': request_id,
            'key': key
        })
        
        # Esperar respuesta usando eventlet
        try:
            with eventlet.Timeout(5.0):
                while request_id in self.pending_requests:
                    eventlet.sleep(0.1)
                return self.pending_requests.get(request_id)
        except eventlet.Timeout:
            print(f"Timeout esperando valor para {key}")
            return None
        except Exception as e:
            print(f"Error obteniendo valor: {e}")
            return None
            
    def set_storage_value(self, key: str, value: Any):
        """
        Establece un valor en el localStorage
        """
        self.socketio.emit('storage.set_value', {
            'key': key,
            'value': value
        })
        
    def request_tables(self):
        """
        Solicita la lista de tablas disponibles en localStorage
        """
        self.socketio.emit('storage.get_tables')
        
    def run(self, host: str = '0.0.0.0', port: int = 5001):
        self.socketio.run(self.app, host=host, port=port) 