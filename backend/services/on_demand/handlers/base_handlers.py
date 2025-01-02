import logging
from typing import Optional
from ...service_locator import service_locator

logger = logging.getLogger(__name__)

class OnDemandHandlers:
    """Clase base para handlers de servicios on-demand"""
    
    def __init__(self, socketio, service_name: str):
        """
        Inicializa los handlers base
        
        Args:
            socketio: Instancia de SocketIO
            service_name: Nombre del servicio (ej: 'openai', 'ontology')
        """
        self.socketio = socketio
        self.service_name = service_name
        
        # Obtener servicio
        self.service = service_locator.get(service_name)
        if not self.service:
            logger.error(f"❌ Servicio {service_name} no disponible")
            return
            
        logger.info(f"🔄 Inicializando handlers de {service_name}")
        self._register_handlers()
        
    def _register_handlers(self):
        """
        Método abstracto para registrar handlers.
        Debe ser implementado por las clases hijas.
        """
        raise NotImplementedError("Las clases hijas deben implementar _register_handlers")
        
    def _emit_error(self, event: str, message: str, request_id: Optional[str] = None):
        """Emite un error estandarizado"""
        logger.error(f"❌ {event}: {message}")
        self.socketio.emit(event, {
            'status': 'error',
            'message': message,
            'request_id': request_id
        })
        
    def _validate_data(self, data: dict, required_fields: list, event: str) -> tuple[bool, Optional[str], Optional[str]]:
        """
        Valida los datos recibidos
        
        Args:
            data: Datos a validar
            required_fields: Lista de campos requeridos
            event: Nombre del evento para el log
            
        Returns:
            tuple: (is_valid, error_message, request_id)
        """
        if not isinstance(data, dict):
            return False, "Datos inválidos", data.get('request_id')
            
        request_id = data.get('request_id')
        missing = [f for f in required_fields if f not in data]
        
        if missing:
            return False, f"Campos requeridos: {', '.join(missing)}", request_id
            
        return True, None, request_id 