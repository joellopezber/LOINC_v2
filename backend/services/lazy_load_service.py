import logging
from functools import wraps
from typing import Optional, Any, Type
from .service_locator import service_locator

logger = logging.getLogger(__name__)

def lazy_load(service_name: str):
    """
    Decorador para implementar lazy loading de servicios
    
    Args:
        service_name: Nombre del servicio a cargar
    """
    def decorator(func):
        @wraps(func)
        def wrapper(self, *args, **kwargs):
            # Obtener el atributo privado
            attr_name = f"_{func.__name__}"
            service = getattr(self, attr_name, None)
            
            # Si no existe, intentar cargarlo
            if service is None:
                logger.debug(f"🔄 Lazy loading de {service_name}...")
                service = service_locator.get(service_name)
                if service:
                    setattr(self, attr_name, service)
                    logger.debug(f"✅ {service_name} cargado correctamente")
                else:
                    logger.error(f"❌ Error cargando {service_name}")
            
            return service
        return wrapper
    return decorator

class LazyLoadService:
    """Clase base para servicios con lazy loading"""
    
    def __init__(self):
        """Inicializa el servicio base"""
        self._initialized = False
        self._initialization_error = None
        self._socketio = None
        
    @property
    def initialized(self) -> bool:
        """Indica si el servicio está inicializado"""
        return self._initialized
        
    @property
    def initialization_error(self) -> Optional[str]:
        """Devuelve el error de inicialización si existe"""
        return self._initialization_error

    @property
    def socketio(self):
        """Obtiene la instancia de SocketIO"""
        return self._socketio

    @socketio.setter
    def socketio(self, value):
        """Establece la instancia de SocketIO y registra handlers si es necesario"""
        self._socketio = value
        if value and hasattr(self, 'register_handlers'):
            self.register_handlers(value)
        
    def _set_initialized(self, success: bool, error: Optional[str] = None):
        """
        Establece el estado de inicialización
        
        Args:
            success: Si la inicialización fue exitosa
            error: Mensaje de error si hubo fallo
        """
        self._initialized = success
        self._initialization_error = error
        
        if success:
            logger.info(f"✅ {self.__class__.__name__} inicializado correctamente")
        else:
            logger.error(f"❌ Error inicializando {self.__class__.__name__}: {error}")

    def register_handlers(self, socketio) -> None:
        """
        Método base para registrar handlers de WebSocket.
        Los servicios que necesiten handlers deben sobrescribir este método.
        
        Args:
            socketio: Instancia de SocketIO
        """
        pass 