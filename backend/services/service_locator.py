"""
Service Locator para gestionar las instancias de servicios.
Este módulo evita las dependencias circulares y proporciona acceso global a los servicios.
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class ServiceLocator:
    _instance = None
    _services: Dict[str, Any] = {}
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ServiceLocator, cls).__new__(cls)
        return cls._instance
    
    @classmethod
    def register(cls, name: str, service: Any) -> None:
        """Registra un servicio en el locator"""
        if name in cls._services:
            logger.warning(f"⚠️ Servicio {name} ya registrado, será reemplazado")
        cls._services[name] = service
        logger.info(f"✅ Servicio {name} registrado")
    
    @classmethod
    def get(cls, name: str) -> Optional[Any]:
        """Obtiene un servicio del locator"""
        service = cls._services.get(name)
        if service is None:
            logger.warning(f"⚠️ Servicio {name} no encontrado")
        return service
    
    @classmethod
    def clear(cls) -> None:
        """Limpia todos los servicios registrados"""
        cls._services.clear()
        logger.info("🧹 Servicios limpiados")

# Instancia global
service_locator = ServiceLocator() 