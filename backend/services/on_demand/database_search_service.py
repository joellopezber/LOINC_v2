from typing import List, Dict, Optional
import logging
import time
from .elastic_service import ElasticService
from .sql_service import SQLService
from ..service_locator import service_locator
from ..lazy_load_service import LazyLoadService, lazy_load
import json

# Configurar logging
logger = logging.getLogger(__name__)

class DatabaseSearchService(LazyLoadService):
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DatabaseSearchService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        """Inicializa los servicios de búsqueda en base de datos de forma lazy"""
        if hasattr(self, '_initialized'):
            return
            
        super().__init__()
        logger.info("🔍 Inicializando DatabaseSearchService")
        
        try:
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
            self._set_initialized(True)
            
        except Exception as e:
            self._set_initialized(False, str(e))
            raise

    @property
    @lazy_load('storage')
    def storage(self):
        """Obtiene el StorageService de forma lazy"""
        return self._storage

    @property
    def elastic_service(self):
        """Obtiene ElasticService de forma lazy"""
        if self._elastic_service is None:
            logger.debug("🔄 Lazy loading de ElasticService...")
            self._elastic_service = ElasticService()
            if not self._elastic_service.initialized:
                logger.error("❌ Error inicializando ElasticService")
                return None
            logger.debug("✅ ElasticService cargado")
        return self._elastic_service

    @property
    def sql_service(self):
        """Obtiene SQLService de forma lazy"""
        if self._sql_service is None:
            logger.debug("🔄 Lazy loading de SQLService...")
            self._sql_service = SQLService()
            if not self._sql_service.initialized:
                logger.error("❌ Error inicializando SQLService")
                return None
            logger.debug("✅ SQLService cargado")
        return self._sql_service

    def search_loinc(self, query: str, user_id: str, limit: int = 10) -> Dict:
        """
        Realiza una búsqueda usando el servicio configurado por el usuario.
        """
        try:
            if not self.initialized:
                logger.error("❌ Servicio no inicializado")
                return None

            # 1. Validación inicial
            logger.info("\n🔍 BÚSQUEDA LOINC")
            logger.info("├── Query: %s", query)
            logger.info("└── Usuario: %s", user_id)
            
            if not self.storage:
                logger.error("❌ Storage service no disponible")
                return {'error': 'Storage service no disponible'}
            
            # 2. Configuración
            service = self.get_user_preference(user_id)
            logger.info("\n⚙️ CONFIGURACIÓN")
            logger.info("├── Servicio: %s", service)
            
            search_config = self.storage.get_value('searchConfig') or {}
            config = {
                'search': search_config.get('search', {}),
                'elastic': search_config.get('elastic', {}),
                'sql': search_config.get('sql', {})
            }
            
            # 3. Ejecución búsqueda
            logger.info("\n🔎 EJECUTANDO BÚSQUEDA")
            results = []
            error = None
            
            self._service_stats[service]['requests'] += 1
            self._service_stats[service]['last_request'] = time.strftime('%Y-%m-%d %H:%M:%S')
            
            try:
                if service == 'elastic':
                    if not self.elastic_service:
                        raise Exception("ElasticService no disponible")
                    results = self.elastic_service.search_loinc(query, limit)
                else:  # sql
                    if not self.sql_service:
                        raise Exception("SQLService no disponible")
                    results = self.sql_service.search_loinc(query, limit)
                    
                logger.info("├── Estado: ✅ Completada")
                logger.info("└── Resultados: %d", len(results))
                
            except Exception as e:
                error = str(e)
                self._service_stats[service]['errors'] += 1
                logger.error("├── Estado: ❌ Error: %s", e)
                
                # Fallback
                fallback_service = 'sql' if service == 'elastic' else 'elastic'
                logger.info("└── Intentando fallback: %s", fallback_service)
                try:
                    if fallback_service == 'elastic' and self.elastic_service:
                        results = self.elastic_service.search_loinc(query, limit)
                    elif fallback_service == 'sql' and self.sql_service:
                        results = self.sql_service.search_loinc(query, limit)
                except Exception as fallback_error:
                    logger.error("    └── ❌ Error en fallback: %s", fallback_error)

            # 4. Respuesta
            response = {
                'results': results,
                'count': len(results),
                'service': service,
                'error': error,
                'config': config
            }
            
            if error:
                logger.info("\n📤 RESPUESTA (con errores)")
            else:
                logger.info("\n📤 RESPUESTA")
                logger.debug("└── %s", json.dumps(response, indent=2))
            return response

        except Exception as e:
            logger.error("❌ Error general: %s", e)
            return {'error': str(e)}

    def get_user_preference(self, user_id: str) -> str:
        """
        Obtiene el servicio preferido de un usuario.
        """
        try:
            if not self.storage:
                logger.error("❌ Storage service no disponible")
                return self._default_service

            # Obtener y validar configuración
            search_config = self.storage.get_value('searchConfig') or {}
            service = search_config.get('search', {}).get('dbMode', self._default_service)
            
            if service not in ['elastic', 'sql']:
                logger.warning("⚠️ Servicio '%s' inválido, usando '%s'", service, self._default_service)
                return self._default_service

            logger.debug("⚙️ Servicio configurado: %s", service)
            return service

        except Exception as e:
            logger.error("❌ Error obteniendo preferencia: %s", e)
            return self._default_service

    def get_service_status(self, user_id: str = None) -> Dict:
        """
        Obtiene el estado de los servicios.
        """
        status = {
            'services': {
                'elastic': {'available': False, 'stats': {}},
                'sql': {'available': False, 'stats': {}}
            }
        }
        
        # Si tenemos usuario, obtener su configuración
        if user_id and self.storage:
            search_config = self.storage.get_value('searchConfig') or {}
            status['user_config'] = {
                'search': search_config.get('search', {}),
                'elastic': search_config.get('elastic', {}),
                'sql': search_config.get('sql', {})
            }
        
        # Verificar Elasticsearch
        try:
            if self.elastic_service:
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
            if self.sql_service:
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

# Instancia global
database_search_service = DatabaseSearchService() 