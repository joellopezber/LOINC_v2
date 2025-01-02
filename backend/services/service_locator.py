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
        logger.debug("🔧 Service Locator inicializado")
    
    def initialize_core_services(self, app) -> None:
        """Inicializa todos los servicios core"""
        if self._initialized:
            return
        
        try:
            logger.info("🚀 Iniciando servicios core")
            self.clear()
            
            # 1. Servicios de seguridad
            self._init_security_services()
            
            # 2. Servicios de comunicación
            self._init_communication_services(app)
            
            # 3. Servicios de datos
            self._init_data_services()
            
            logger.info("✅ Servicios core inicializados")
            self._initialized = True
            
        except Exception as e:
            logger.error(f"❌ Error inicializando servicios core: {e}")
            raise

    def _init_security_services(self):
        """Inicializa servicios de seguridad"""
        try:
            from .core.master_key_service import master_key_service
            from .core.encryption_service import encryption_service
            
            # Registrar servicios
            self.register('master_key', master_key_service)
            self.register('encryption', encryption_service)
            
            logger.debug("🔐 Servicios de seguridad inicializados")
            
        except Exception as e:
            logger.error(f"❌ Error inicializando servicios de seguridad: {e}")
            raise

    def _init_communication_services(self, app):
        """Inicializa servicios de comunicación"""
        try:
            from .core.websocket_service import WebSocketService
            
            # Inicializar WebSocket
            websocket = WebSocketService(app)
            self.register('websocket', websocket)
            
            logger.debug("🔌 Servicios de comunicación inicializados")
            
        except Exception as e:
            logger.error(f"❌ Error inicializando servicios de comunicación: {e}")
            raise

    def _init_data_services(self):
        """Inicializa servicios de datos"""
        try:
            from .core.storage_service import storage_service
            
            # Registrar Storage
            self.register('storage', storage_service)
            
            logger.debug("💾 Servicios de datos inicializados")
            
        except Exception as e:
            logger.error(f"❌ Error inicializando servicios de datos: {e}")
            raise

    def get_on_demand_service(self, name: str) -> Optional[Any]:
        """Obtiene un servicio on-demand, registrándolo si es necesario"""
        try:
            # Si ya está registrado, devolverlo
            if self.is_registered(name):
                return self.get(name)

            # Validar dependencias antes de registrar
            if not self.validate_dependencies(name):
                logger.error(f"❌ Dependencias no satisfechas para {name}")
                return None

            # Obtener websocket si está disponible
            websocket = self.get('websocket')
            socketio = websocket.socketio if websocket else None

            # Registrar según el tipo de servicio
            service = None
            if name == 'openai':
                from .on_demand.services.openai_service import openai_service
                service = openai_service
                logger.debug("🤖 Cargando servicio OpenAI")
            elif name == 'ontology':
                from .on_demand.services.ontology_service import ontology_service
                service = ontology_service
                logger.debug("🔍 Cargando servicio Ontología")
            elif name == 'database_search':
                from .on_demand.services.database_search_service import database_search_service
                service = database_search_service
                logger.debug("🔍 Cargando servicio Database")

            # Configurar socketio si está disponible
            if service and socketio:
                service.socketio = socketio

            # Registrar y devolver
            if service and self.register(name, service):
                return service
            return None

        except Exception as e:
            logger.error(f"❌ Error registrando servicio on-demand {name}: {e}")
            return None

    def validate_dependencies(self, service_name: str) -> bool:
        """
        Valida que las dependencias de un servicio estén disponibles
        
        Args:
            service_name: Nombre del servicio a validar
            
        Returns:
            bool: True si todas las dependencias están disponibles
        """
        dependencies = {
            'openai': ['storage', 'encryption', 'websocket'],
            'ontology': ['openai', 'storage'],
            'database_search': ['storage']
        }

        required_deps = dependencies.get(service_name, [])
        missing_deps = [dep for dep in required_deps if not self.is_registered(dep)]
        
        if missing_deps:
            logger.error(f"❌ Faltan dependencias para {service_name}: {missing_deps}")
            return False
            
        return True
    
    def register(self, name: str, service: Any) -> bool:
        """Registra un servicio"""
        try:
            if name in self._services:
                return True
            
            self._services[name] = service
            logger.debug(f"✅ Servicio {name} registrado")
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
        # Primero intentar obtener servicio core
        service = self._services.get(name)
        if service is not None:
            return service
            
        # Si no existe, intentar cargar on-demand
        if name in ['openai', 'ontology', 'database_search']:
            return self.get_on_demand_service(name)
            
        logger.error(f"❌ Servicio {name} no encontrado")
        return None
    
    def clear(self):
        """Limpia todos los servicios registrados"""
        self._services.clear()
        logger.debug("🧹 Service Locator limpiado")
    
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