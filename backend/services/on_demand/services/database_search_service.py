from typing import List, Dict, Optional, Any
import logging
from ...lazy_load_service import LazyLoadService, lazy_load
from .elastic_service import ElasticService
from .sql_service import SQLService
from ...core.storage_service import storage_service
import json

logger = logging.getLogger(__name__)

class DatabaseSearchService(LazyLoadService):
    """Servicio para gestionar búsquedas en diferentes bases de datos"""
    
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DatabaseSearchService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        """Inicializa el servicio de búsqueda en base de datos"""
        if hasattr(self, '_initialized'):
            return
            
        super().__init__()
        logger.info("🔄 Inicializando Database Search Service")
        
        try:
            self._elastic_service = None
            self._sql_service = None
            self._storage = None
            self._websocket = None
            self._listeners = set()
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
    @lazy_load('websocket')
    def websocket(self):
        """Obtiene el WebSocketService de forma lazy"""
        return self._websocket

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

    def addListener(self, callback):
        """Agrega un listener para recibir actualizaciones"""
        self._listeners.add(callback)
        return lambda: self._listeners.remove(callback)

    def _notify_listeners(self, data):
        """Notifica a todos los listeners registrados"""
        for callback in self._listeners:
            try:
                callback(data)
            except Exception as e:
                logger.error(f"❌ Error en listener: {e}")

    def get_user_preference(self, user_id: str) -> str:
        """
        Obtiene el servicio preferido de un usuario.
        """
        try:
            if not self.storage:
                logger.error("❌ Storage service no disponible")
                return self._default_service

            # Obtener y validar configuración
            search_config = self.storage.get_value('searchConfig', user_id) or {}
            service = search_config.get('search', {}).get('dbMode', self._default_service)
            
            if service not in ['elastic', 'sql']:
                logger.warning(f"⚠️ Servicio '{service}' inválido, usando '{self._default_service}'")
                return self._default_service

            logger.debug(f"⚙️ Servicio configurado: {service}")
            return service

        except Exception as e:
            logger.error(f"❌ Error obteniendo preferencia: {e}")
            return self._default_service

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
            logger.info(f"├── Query: {query}")
            logger.info(f"└── Usuario: {user_id}")
            
            if not self.storage:
                logger.error("❌ Storage service no disponible")
                return {'error': 'Storage service no disponible'}
            
            # 2. Configuración
            service = self.get_user_preference(user_id)
            logger.info("\n⚙️ CONFIGURACIÓN")
            logger.info(f"├── Servicio: {service}")
            
            search_config = self.storage.get_value('searchConfig', user_id) or {}
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
                logger.info(f"└── Resultados: {len(results)}")
                
            except Exception as e:
                error = str(e)
                self._service_stats[service]['errors'] += 1
                logger.error(f"├── Estado: ❌ Error: {e}")
                
                # Fallback
                fallback_service = 'sql' if service == 'elastic' else 'elastic'
                logger.info(f"└── Intentando fallback: {fallback_service}")
                try:
                    if fallback_service == 'elastic' and self.elastic_service:
                        results = self.elastic_service.search_loinc(query, limit)
                    elif fallback_service == 'sql' and self.sql_service:
                        results = self.sql_service.search_loinc(query, limit)
                except Exception as fallback_error:
                    logger.error(f"    └── ❌ Error en fallback: {fallback_error}")

            # 4. Notificar resultado
            response = {
                'status': 'success' if not error else 'error',
                'results': results,
                'count': len(results),
                'service': service,
                'error': error,
                'config': config
            }
            
            self._notify_listeners(response)
            
            if error:
                logger.info("\n📤 RESPUESTA (con errores)")
            else:
                logger.info("\n📤 RESPUESTA")
                logger.debug(f"└── {json.dumps(response, indent=2)}")
            return response

        except Exception as e:
            logger.error(f"❌ Error general: {e}")
            error_response = {
                'status': 'error',
                'error': str(e),
                'results': [],
                'count': 0
            }
            self._notify_listeners(error_response)
            return error_response

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
            search_config = self.storage.get_value('searchConfig', user_id) or {}
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

    def run_test(self, test_data: Dict) -> Dict:
        """
        Ejecuta un test específico en el servicio de base de datos.
        """
        try:
            logger.info("\n🧪 EJECUTANDO TEST")
            logger.info(f"├── Test ID: {test_data.get('test_id')}")
            
            test_type = test_data.get('type', 'search')
            test_params = test_data.get('params', {})
            
            results = {
                'test_id': test_data.get('test_id'),
                'type': test_type,
                'success': False,
                'data': None,
                'error': None
            }
            
            if test_type == 'search':
                # Test de búsqueda
                search_results = self.search_loinc(
                    query=test_params.get('query', ''),
                    user_id=test_params.get('user_id', 'test'),
                    limit=test_params.get('limit', 10)
                )
                results['data'] = search_results
                results['success'] = search_results is not None
                
            elif test_type == 'service_status':
                # Test de estado del servicio
                status = self.get_service_status(test_params.get('user_id'))
                results['data'] = status
                results['success'] = True
                
            elif test_type == 'service_switch':
                # Test de cambio de servicio
                service = test_params.get('service')
                if service not in ['elastic', 'sql']:
                    raise ValueError(f"Servicio inválido: {service}")
                    
                results['data'] = {'service': service}
                results['success'] = True
                
            else:
                raise ValueError(f"Tipo de test no soportado: {test_type}")
            
            logger.info("├── Estado: ✅ Test completado")
            logger.info(f"└── Resultado: {results}")
            return results
            
        except Exception as e:
            logger.error(f"❌ Error ejecutando test: {e}")
            return {
                'test_id': test_data.get('test_id'),
                'success': False,
                'error': str(e)
            }

# Instancia global
database_search_service = DatabaseSearchService() 