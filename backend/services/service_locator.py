"""
Service Locator para gestionar las instancias de servicios.
Este módulo evita las dependencias circulares y proporciona acceso global a los servicios.
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class ServiceLocator:
    """
    Localizador de servicios con soporte para lazy loading
    """
    def __init__(self):
        self._services: Dict[str, Any] = {}
        self._initialized = False
        logger.info("🔧 Service Locator inicializado")
    
    def initialize_core_services(self, app) -> Any:
        """
        Inicializa los servicios core en el orden correcto
        
        Args:
            app: Instancia de Flask
            
        Returns:
            WebSocketService: Instancia del servicio WebSocket
        """
        try:
            logger.info("🚀 Iniciando servicios core...")
            self.clear()
            
            # 1. Servicios de seguridad
            websocket = self._init_core_services(app)
            
            logger.info("✅ Servicios core inicializados")
            return websocket
            
        except Exception as e:
            logger.error(f"❌ Error inicializando servicios core: {e}")
            raise

    def _init_core_services(self, app):
        """
        Inicializa los servicios core en orden
        
        Args:
            app: Instancia de Flask
            
        Returns:
            WebSocketService: Instancia del servicio WebSocket
        """
        # 1. Servicios de seguridad
        from .core.master_key_service import master_key_service
        from .core.encryption_service import encryption_service
        self.register('master_key', master_key_service)
        self.register('encryption', encryption_service)
        
        # 2. Servicios de comunicación
        from .core.websocket_service import WebSocketService
        websocket = WebSocketService(app)
        self.register('websocket', websocket)
        
        # 3. Servicios de datos
        from .core.storage_service import StorageService
        storage = StorageService()
        self.register('storage', storage)
        
        return websocket
    
    def register(self, name: str, service: Any) -> bool:
        """
        Registra un servicio
        
        Args:
            name: Nombre del servicio
            service: Instancia del servicio
            
        Returns:
            bool: True si se registró correctamente
        """
        try:
            if name in self._services:
                logger.warning(f"⚠️ Servicio {name} ya registrado, actualizando...")
            
            self._services[name] = service
            logger.info(f"✅ Servicio {name} registrado correctamente")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error registrando servicio {name}: {e}")
            return False
    
    def get(self, name: str) -> Optional[Any]:
        """
        Obtiene un servicio por nombre
        
        Args:
            name: Nombre del servicio
            
        Returns:
            Instancia del servicio o None si no existe
        """
        service = self._services.get(name)
        if service is None:
            logger.error(f"❌ Servicio {name} no encontrado")
        return service
    
    def clear(self):
        """Limpia todos los servicios registrados"""
        self._services.clear()
        logger.info("🧹 Service Locator limpiado")
    
    def is_registered(self, name: str) -> bool:
        """
        Comprueba si un servicio está registrado
        
        Args:
            name: Nombre del servicio
            
        Returns:
            bool: True si el servicio está registrado
        """
        return name in self._services
    
    def get_service_status(self) -> Dict[str, bool]:
        """
        Obtiene el estado de inicialización de todos los servicios
        
        Returns:
            Dict[str, bool]: Diccionario con el estado de cada servicio
        """
        status = {}
        for name, service in self._services.items():
            is_initialized = getattr(service, 'initialized', None)
            status[name] = bool(is_initialized)
        return status

# Instancia global
service_locator = ServiceLocator() 