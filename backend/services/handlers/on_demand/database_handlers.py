import logging
from typing import Dict, Any
from ...on_demand.database_search_service import database_search_service

logger = logging.getLogger(__name__)

def handle_database_search(data: Dict[str, Any], websocket_instance=None) -> Dict:
    """
    Maneja las solicitudes de búsqueda en base de datos
    
    Args:
        data: Datos de la solicitud
        websocket_instance: Instancia de WebSocket
        
    Returns:
        Dict con resultado de la búsqueda
    """
    try:
        logger.info("🔍 Procesando solicitud de búsqueda en base de datos")
        logger.debug(f"📥 Datos recibidos: {data}")
        
        # Validar servicio
        if not database_search_service.initialized:
            logger.error("❌ Servicio de búsqueda no inicializado")
            return {
                'status': 'error',
                'message': 'Servicio de búsqueda no inicializado'
            }
        
        # Validar datos de entrada
        if not data or 'text' not in data:
            logger.error("❌ Datos de entrada inválidos")
            return {
                'status': 'error',
                'message': 'Se requiere texto para búsqueda'
            }
            
        # Obtener configuración
        user_id = data.get('user_id', 'default')
        limit = data.get('limit', 10)
            
        # Ejecutar búsqueda
        result = database_search_service.search_loinc(
            query=data['text'],
            user_id=user_id,
            limit=limit
        )
        
        if not result:
            logger.error("❌ Error en búsqueda")
            return {
                'status': 'error',
                'message': 'Error ejecutando búsqueda'
            }
            
        logger.info("✅ Búsqueda completada correctamente")
        logger.debug(f"📤 Resultado: {result}")
        
        return {
            'status': 'success',
            'query': data['text'],
            'response': result
        }
        
    except Exception as e:
        logger.error(f"❌ Error en handler búsqueda: {e}")
        return {
            'status': 'error',
            'message': str(e)
        }

def handle_database_test(data: Dict[str, Any], websocket_instance=None) -> Dict:
    """
    Maneja las solicitudes de test del servicio de búsqueda
    
    Args:
        data: Datos de la solicitud
        websocket_instance: Instancia de WebSocket
        
    Returns:
        Dict con resultado del test
    """
    try:
        logger.info("🧪 Iniciando test de búsqueda")
        logger.debug(f"📥 Datos de test: {data}")
        
        # Validar servicio
        if not database_search_service.initialized:
            logger.error("❌ Servicio no inicializado")
            return {
                'status': 'error',
                'message': 'Servicio de búsqueda no inicializado'
            }
            
        # Obtener estado de servicios
        status = database_search_service.get_service_status(
            user_id=data.get('user_id', 'default')
        )
        
        logger.info("✅ Test completado correctamente")
        return {
            'status': 'success',
            'message': 'Test de búsqueda exitoso',
            'test_result': status
        }
        
    except Exception as e:
        logger.error(f"❌ Error en test de búsqueda: {e}")
        return {
            'status': 'error',
            'message': str(e)
        } 