from flask_socketio import SocketIO, emit
from typing import Dict, Any
from .storage_service import storage_service

class WebSocketService:
    """
    Servicio para sincronizar localStorage entre frontend y backend
    """
    def __init__(self, app):
        self.app = app
        self.socketio = SocketIO(app, cors_allowed_origins="*")
        self._setup_handlers()
        storage_service.set_websocket(self)
        
    def emit(self, event: str, data: Dict[str, Any]):
        """Envía un evento al cliente"""
        self.socketio.emit(event, data)
        
    def _setup_handlers(self):
        """Configurar los manejadores de eventos WebSocket"""
        
        @self.socketio.on('connect')
        def handle_connect():
            print("Cliente conectado")
            
        @self.socketio.on('disconnect')
        def handle_disconnect():
            print("Cliente desconectado")
            
        @self.socketio.on('storage.register_schema')
        def handle_register_schema(schema: Dict[str, Any]):
            """
            Registra el schema del localStorage desde el frontend
            
            Args:
                schema (dict): Estructura del localStorage
            """
            try:
                storage_service.update_schema(schema)
                emit('storage.schema_registered', {
                    'status': 'success',
                    'message': 'Schema registrado correctamente'
                })
            except Exception as e:
                emit('storage.error', {
                    'error': f"Error registrando schema: {str(e)}"
                })
                
        @self.socketio.on('storage.value_response')
        def handle_value_response(data: Dict[str, Any]):
            """
            Maneja la respuesta del frontend a una solicitud de valor
            
            Args:
                data (dict): Datos de la respuesta con:
                    - request_id: str
                    - key: str
                    - value: Any
                    - status: str
                    - error: str (opcional)
            """
            request_id = data.get('request_id')
            if not request_id:
                return
                
            if data.get('status') == 'success':
                storage_service.handle_frontend_response(
                    request_id,
                    data.get('value')
                )
            else:
                print(f"Error obteniendo valor: {data.get('error')}")
            
        @self.socketio.on('storage.sync')
        def handle_storage_sync(data: Dict[str, Any]):
            """
            Recibe y almacena datos del localStorage
            
            Args:
                data (dict): Datos a sincronizar con:
                    - key: str
                    - value: Any
                    - encrypted: bool
            """
            try:
                key = data.get('key')
                value = data.get('value')
                encrypted = data.get('encrypted', False)
                
                if not key or value is None:
                    raise ValueError("Key y value son requeridos")
                
                print(f"Recibido del localStorage - Key: {key}")
                
                # Almacenar en el storage service
                storage_service.set_value(key, value, encrypted)
                
                # Confirmar al cliente
                emit('storage.synced', {
                    'key': key,
                    'status': 'success'
                })
                
            except Exception as e:
                print(f"Error sincronizando localStorage: {str(e)}")
                emit('storage.error', {
                    'key': key if key else 'unknown',
                    'error': str(e)
                })
    
    def run(self, host='127.0.0.1', port=3000):
        """
        Inicia el servidor WebSocket usando IPv4
        """
        self.socketio.run(self.app, host=host, port=port, debug=True) 