from flask_socketio import SocketIO, emit
from typing import Dict, Any
import json

class WebSocketService:
    def __init__(self, app):
        self.app = app
        self.socketio = SocketIO(
            app,
            cors_allowed_origins="*",
            async_mode='threading',
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
            
        @self.socketio.on('disconnect')
        def handle_disconnect():
            print("Cliente desconectado")
            
        @self.socketio.on('storage.value')
        def handle_storage_value(data: Dict[str, Any]):
            """Maneja la respuesta del frontend con un valor del localStorage"""
            request_id = data.get('request_id')
            if request_id in self.pending_requests:
                callback = self.pending_requests.pop(request_id)
                callback(data.get('value'))
                
        @self.socketio.on('storage.tables')
        def handle_storage_tables(data: Dict[str, Any]):
            """Recibe la lista de tablas disponibles en localStorage"""
            print(f"Tablas disponibles: {data.get('tables', [])}")
            emit('storage.tables_received', {
                'status': 'success',
                'message': 'Tablas recibidas correctamente'
            })
            
    async def get_storage_value(self, key: str) -> Any:
        """
        Solicita un valor del localStorage
        """
        request_id = f"req_{len(self.pending_requests)}"
        
        # Crear una Promise para esperar la respuesta
        future = self.app.async_loop.create_future()
        self.pending_requests[request_id] = future.set_result
        
        # Solicitar el valor al frontend
        self.socketio.emit('storage.get_value', {
            'request_id': request_id,
            'key': key
        })
        
        # Esperar respuesta
        try:
            value = await future
            return value
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