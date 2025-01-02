from elasticsearch import Elasticsearch
from typing import List, Dict, Optional
import logging
from ...lazy_load_service import LazyLoadService

logger = logging.getLogger(__name__)

class ElasticService(LazyLoadService):
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ElasticService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        """Inicializa el servicio de Elasticsearch de forma lazy"""
        if hasattr(self, '_initialized'):
            return
            
        super().__init__()
        logger.info("🔌 Inicializando ElasticService")
        
        try:
            self._client = None
            self._set_initialized(True)
            
        except Exception as e:
            self._set_initialized(False, str(e))
            raise

    @property
    def client(self):
        """Obtiene el cliente de Elasticsearch de forma lazy"""
        if self._client is None:
            logger.info("🔌 Conectando a Elasticsearch en localhost:9200")
            self._client = Elasticsearch("http://localhost:9200")
            if self._client.ping():
                logger.info("✅ Conexión a Elasticsearch establecida")
            else:
                logger.error("❌ No se pudo conectar a Elasticsearch")
        return self._client

    def setup_index(self, index_name: str = 'loinc_docs') -> bool:
        """Configura el índice con los mappings apropiados"""
        try:
            if not self.client:
                logger.error("❌ Cliente Elasticsearch no inicializado")
                return False

            # Definir mappings
            mappings = {
                "properties": {
                    "loinc_num": {"type": "keyword"},
                    "component": {"type": "text"},
                    "property": {"type": "text"},
                    "time_aspect": {"type": "text"},
                    "system": {"type": "text"},
                    "scale_type": {"type": "keyword"},
                    "method_type": {"type": "keyword"},
                    "class": {"type": "keyword"},
                    "description": {"type": "text"}
                }
            }

            # Crear índice si no existe
            if not self.client.indices.exists(index=index_name):
                self.client.indices.create(
                    index=index_name,
                    body={
                        "settings": {
                            "number_of_shards": 1,
                            "number_of_replicas": 0
                        },
                        "mappings": mappings
                    }
                )
                logger.info(f"✅ Índice {index_name} creado correctamente")
            return True

        except Exception as e:
            logger.error(f"❌ Error al configurar índice: {str(e)}")
            return False

    def search_loinc(self, query: str, limit: int = 10) -> List[Dict]:
        """Busca documentos LOINC basados en la query"""
        try:
            if not self.client:
                logger.error("❌ Cliente Elasticsearch no inicializado")
                return []

            # Construir query de búsqueda
            search_query = {
                "query": {
                    "multi_match": {
                        "query": query,
                        "fields": ["component", "system", "description"],
                        "type": "best_fields",
                        "fuzziness": "AUTO"
                    }
                },
                "size": limit
            }

            # Ejecutar búsqueda
            results = self.client.search(
                index='loinc_docs',
                body=search_query
            )

            # Procesar resultados
            hits = results.get('hits', {}).get('hits', [])
            return [hit['_source'] for hit in hits]

        except Exception as e:
            logger.error(f"❌ Error en búsqueda: {str(e)}")
            return []

    def bulk_insert_docs(self, docs: List[Dict]) -> Dict:
        """Inserta múltiples documentos en el índice"""
        try:
            if not self.client:
                logger.error("❌ Cliente Elasticsearch no inicializado")
                return {"success": False, "error": "Cliente no inicializado"}

            # Preparar documentos para inserción bulk
            bulk_data = []
            for doc in docs:
                bulk_data.extend([
                    {"index": {"_index": "loinc_docs"}},
                    doc
                ])

            # Ejecutar inserción bulk
            if bulk_data:
                response = self.client.bulk(body=bulk_data, refresh=True)
                success = not response.get('errors', False)
                return {
                    "success": success,
                    "doc_count": len(docs),
                    "errors": not success
                }
            return {"success": False, "error": "No hay documentos para insertar"}

        except Exception as e:
            logger.error(f"❌ Error en inserción bulk: {str(e)}")
            return {"success": False, "error": str(e)}

    def get_stats(self) -> Dict:
        """Obtiene estadísticas del índice"""
        try:
            if not self.client:
                return {
                    "available": False,
                    "doc_count": 0,
                    "error": "Cliente no inicializado"
                }

            # Verificar si el índice existe
            if not self.client.indices.exists(index='loinc_docs'):
                return {
                    "available": True,
                    "doc_count": 0,
                    "message": "Índice no existe"
                }

            # Obtener estadísticas
            stats = self.client.indices.stats(index='loinc_docs')
            doc_count = stats['_all']['primaries']['docs']['count']

            return {
                "available": True,
                "doc_count": doc_count
            }

        except Exception as e:
            logger.error(f"❌ Error al obtener estadísticas: {str(e)}")
            return {
                "available": False,
                "doc_count": 0,
                "error": str(e)
            } 