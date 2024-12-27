from typing import List, Dict, Optional
import logging
import time
from .elastic_service import ElasticService
from .sql_service import SQLService
from ..service_locator import service_locator
import json

# Configurar logging
logger = logging.getLogger(__name__)

class DatabaseSearchService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DatabaseSearchService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        """Inicializa los servicios de búsqueda en base de datos de forma lazy"""
        if hasattr(self, 'initialized'):
            return
            
        logger.info("🔍 Inicializando SearchService")
        self._elastic_service = None
        self._sql_service = None
        self._storage = None
        self._default_service = 'sql'
        self._service_stats = {
            'elastic': {
                'requests': 0,
                'errors': 0,
                'last_request': None
            },
            'sql': {
                'requests': 0,
                'errors': 0,
                'last_request': None
            }
        }
        self.initialized = True
        logger.info("✅ SearchService base inicializado")

    @property
    def elastic_service(self):
        """Obtiene ElasticService de forma lazy"""
        if self._elastic_service is None:
            from .elastic_service import ElasticService
            self._elastic_service = ElasticService()
        return self._elastic_service

    @property
    def sql_service(self):
        """Obtiene SQLService de forma lazy"""
        if self._sql_service is None:
            from .sql_service import SQLService
            self._sql_service = SQLService()
        return self._sql_service

    @property
    def storage(self):
        """Obtiene el StorageService de forma lazy"""
        if self._storage is None:
            self._storage = service_locator.get('storage')
            if self._storage is None:
                logger.error("❌ StorageService no encontrado en ServiceLocator")
        return self._storage

    def get_user_preference(self, user_id: str) -> str:
        """
        Obtiene el servicio preferido de un usuario.
        """
        try:
            if not self.storage:
                logger.error("❌ No se pudo obtener StorageService")
                return self._default_service

            # Obtener configuración del usuario
            config = self.storage.get_user_config(user_id)
            service = config.get('search', {}).get('dbMode', self._default_service)
            
            # Validar servicio
            if service not in ['elastic', 'sql']:
                logger.warning(f"⚠️ Servicio inválido {service}, usando default")
                return self._default_service

            return service

        except Exception as e:
            logger.error(f"❌ Error obteniendo preferencia: {e}")
            return self._default_service

    def get_service_status(self, user_id: str = None) -> Dict:
        """
        Obtiene el estado de los servicios.
        
        Args:
            user_id: Identificador del usuario
        """
        status = {
            'services': {
                'elastic': {'available': False, 'stats': {}},
                'sql': {'available': False, 'stats': {}}
            }
        }
        
        # Si tenemos usuario, obtener su configuración
        if user_id and self.storage:
            status['user_config'] = self.storage.get_user_config(user_id)
        
        # Verificar Elasticsearch
        try:
            elastic_stats = self.elastic_service.get_stats()
            status['services']['elastic'] = {
                'available': True,
                'stats': {
                    **elastic_stats,
                    **self._service_stats['elastic']
                }
            }
        except Exception as e:
            logger.warning(f"Elasticsearch no disponible: {e}")
        
        # Verificar SQLite
        try:
            sql_stats = self.sql_service.get_stats()
            status['services']['sql'] = {
                'available': True,
                'stats': {
                    **sql_stats,
                    **self._service_stats['sql']
                }
            }
        except Exception as e:
            logger.warning(f"SQLite no disponible: {e}")

        return status

    def search_loinc(self, query: str, user_id: str, limit: int = 10) -> Dict:
        """
        Realiza una búsqueda usando el servicio configurado por el usuario.
        """
        logger.info("\n1️⃣ Iniciando búsqueda...")
        logger.info(f"📝 Query: {query}")
        logger.info(f"👤 Usuario: {user_id}")
        
        if not self.storage:
            logger.error("❌ No se pudo obtener StorageService")
            return {'error': 'Storage service no disponible'}
        
        # Obtener servicio preferido
        service = self.get_user_preference(user_id)
        logger.info(f"\n2️⃣ Servicio seleccionado: {service}")
        
        # Obtener configuración actual
        config = self.storage.get_user_config(user_id)
        logger.info(f"📦 Configuración actual:")
        logger.info(json.dumps(config, indent=2))
        
        results = []
        error = None
        
        # Actualizar estadísticas
        self._service_stats[service]['requests'] += 1
        self._service_stats[service]['last_request'] = time.strftime('%Y-%m-%d %H:%M:%S')
        
        try:
            logger.info(f"\n3️⃣ Ejecutando búsqueda con {service}...")
            if service == 'elastic':
                results = self.elastic_service.search_loinc(query, limit)
            else:  # sql
                results = self.sql_service.search_loinc(query, limit)
                
            logger.info(f"✅ Búsqueda completada: {len(results)} resultados")
            
        except Exception as e:
            error = str(e)
            self._service_stats[service]['errors'] += 1
            logger.error(f"❌ Error en búsqueda con {service}: {e}")

        response = {
            'results': results,
            'count': len(results),
            'service': service,
            'error': error,
            'config': config
        }
        
        logger.info("\n4️⃣ Respuesta final:")
        logger.info(json.dumps(response, indent=2))
        return response

    def bulk_insert_docs(self, docs: List[Dict], user_id: str) -> Dict:
        """
        Inserta documentos usando el servicio configurado por el usuario.
        
        Args:
            docs: Lista de diccionarios con datos LOINC
            user_id: Identificador del usuario
            
        Returns:
            Estado de la inserción
        """
        if not self.storage:
            return {'success': False, 'error': 'Storage service no disponible'}
            
        service = self.get_user_preference(user_id)
        status = {'success': False, 'error': None, 'service': service}
        
        try:
            if service == 'elastic':
                status['success'] = self.elastic_service.bulk_insert_docs(docs)
            else:  # sql
                status['success'] = self.sql_service.bulk_insert_docs(docs)
        except Exception as e:
            status['error'] = str(e)
            logger.error(f"Error en inserción con {service}: {e}")
            
        return status

# Crear instancia global
database_search_service = DatabaseSearchService() 