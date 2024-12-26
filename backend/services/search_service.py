from typing import List, Dict, Optional
import logging
import time
from .elastic_service import ElasticService
from .sql_service import SQLService
import json

# Configurar logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class SearchService:
    def __init__(self, websocket_service=None):
        """
        Inicializa los servicios de búsqueda.
        
        Args:
            websocket_service: Instancia de WebSocketService para acceder al storage
        """
        logger.info("🔍 Inicializando SearchService")
        self.elastic_service = ElasticService()
        self.sql_service = SQLService()
        self.websocket = websocket_service
        self._user_configs = {}  # Almacena configuración por usuario
        self._default_service = 'sql'  # Por defecto usamos SQL (más seguro)
        self._service_stats = {  # Estadísticas globales de uso
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
        logger.info("✅ SearchService inicializado")

    def initialize_user_config(self, user_id: str, websocket_instance = None) -> bool:
        """
        Inicializa la configuración de un usuario desde el WebSocket.
        """
        try:
            # 1. Validar acceso al storage
            if not self.websocket:
                logger.error("❌ No hay WebSocket configurado")
                return False

            # 2. Obtener datos del storage
            storage_data = self.websocket.storage_data

            # 3. Obtener searchConfig
            search_config = storage_data.get('searchConfig', {})
            if isinstance(search_config, dict) and 'value' in search_config:
                search_config = search_config['value']
            
            if not search_config or not isinstance(search_config, dict):
                logger.error("❌ searchConfig inválido")
                return False

            # 4. Obtener configuración de búsqueda
            config = search_config.get('search', {})
            if not config:
                logger.error("❌ No hay configuración de búsqueda")
                return False

            # 5. Obtener dbMode
            db_mode = config.get('dbMode', self._default_service)
            if not db_mode or db_mode not in ['elastic', 'sql']:
                logger.warning(f"⚠️ dbMode inválido: {db_mode}, usando default")
                db_mode = self._default_service

            # 6. Guardar configuración
            self._user_configs[user_id] = {
                'preferred_service': db_mode,
                'last_activity': time.strftime('%Y-%m-%d %H:%M:%S'),
                'config': search_config
            }

            logger.debug(f"✅ Configuración inicializada para usuario {user_id}")
            return True

        except Exception as e:
            logger.error(f"❌ Error inicializando configuración: {e}")
            return False

    def get_user_preference(self, user_id: str, websocket_instance = None) -> str:
        """
        Obtiene el servicio preferido de un usuario.
        """
        try:
            # Si no hay configuración y tenemos websocket, intentar inicializar
            if user_id not in self._user_configs:
                self.initialize_user_config(user_id, websocket_instance)

            # Obtener preferencia
            user_config = self._user_configs.get(user_id, {})
            service = user_config.get('preferred_service', self._default_service)
            
            # Validar servicio
            if service not in ['elastic', 'sql']:
                logger.warning(f"⚠️ Servicio inválido {service}, usando default")
                return self._default_service

            return service

        except Exception as e:
            logger.error(f"❌ Error obteniendo preferencia: {e}")
            return self._default_service

    def get_service_status(self, user_id: str = None, websocket_instance = None) -> Dict:
        """
        Obtiene el estado de los servicios.
        
        Args:
            user_id: Identificador del usuario
            websocket_instance: Instancia de WebSocket para obtener configuración
        """
        status = {
            'services': {
                'elastic': {'available': False, 'stats': {}},
                'sql': {'available': False, 'stats': {}}
            }
        }
        
        # Si tenemos websocket y usuario, intentamos inicializar config
        if websocket_instance and user_id:
            self.initialize_user_config(user_id, websocket_instance)
        
        if user_id:
            status['user_config'] = self._user_configs.get(user_id, {})
        
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
            logging.warning(f"Elasticsearch no disponible: {e}")
        
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
            logging.warning(f"SQLite no disponible: {e}")
            
        return status

    def search_loinc(self, query: str, user_id: str, websocket_instance = None, limit: int = 10) -> Dict:
        """
        Realiza una búsqueda usando el servicio configurado por el usuario.
        """
        logger.info("\n1️⃣ Iniciando búsqueda...")
        logger.info(f"📝 Query: {query}")
        logger.info(f"👤 Usuario: {user_id}")
        
        # Asegurarnos de tener la configuración más reciente
        if websocket_instance and hasattr(websocket_instance, 'storage_data'):
            logger.info("\n2️⃣ Actualizando configuración desde WebSocket...")
            self.initialize_user_config(user_id, websocket_instance)
            
        service = self.get_user_preference(user_id, websocket_instance)
        logger.info(f"\n3️⃣ Servicio seleccionado: {service}")
        logger.info(f"📦 Configuración actual:")
        logger.info(json.dumps(self._user_configs.get(user_id, {}), indent=2))
        
        results = []
        error = None
        
        # Actualizar estadísticas
        self._service_stats[service]['requests'] += 1
        self._service_stats[service]['last_request'] = time.strftime('%Y-%m-%d %H:%M:%S')
        
        if user_id in self._user_configs:
            self._user_configs[user_id]['last_activity'] = time.strftime('%Y-%m-%d %H:%M:%S')
        
        try:
            logger.info(f"\n4️⃣ Ejecutando búsqueda con {service}...")
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
            'config': self._user_configs.get(user_id, {}).get('config', {})
        }
        
        logger.info("\n5️⃣ Respuesta final:")
        logger.info(json.dumps(response, indent=2))
        return response

    def bulk_insert_docs(self, docs: List[Dict], user_id: str, websocket_instance = None) -> Dict:
        """
        Inserta documentos usando el servicio configurado por el usuario.
        
        Args:
            docs: Lista de diccionarios con datos LOINC
            user_id: Identificador del usuario
            websocket_instance: Opcional, para obtener configuración
            
        Returns:
            Estado de la inserción
        """
        service = self.get_user_preference(user_id, websocket_instance)
        status = {'success': False, 'error': None, 'service': service}
        
        try:
            if service == 'elastic':
                status['success'] = self.elastic_service.bulk_insert_docs(docs)
            else:  # sql
                status['success'] = self.sql_service.bulk_insert_docs(docs)
        except Exception as e:
            status['error'] = str(e)
            logging.error(f"Error en inserción con {service}: {e}")
            
        return status 