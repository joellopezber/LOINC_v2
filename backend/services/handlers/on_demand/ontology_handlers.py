import logging
from typing import Dict, Any
from ...on_demand.ontology_service import ontology_service

logger = logging.getLogger(__name__)

def handle_ontology_search(data: Dict[str, Any], websocket_instance=None) -> Dict:
    """
    Maneja las solicitudes de búsqueda ontológica
    
    Args:
        data: Datos de la solicitud
        websocket_instance: Instancia de WebSocket
        
    Returns:
        Dict con resultado de la búsqueda
    """
    try:
        logger.info("🔍 Procesando solicitud de búsqueda ontológica")
        logger.debug(f"📥 Datos recibidos: {data}")
        
        # Validar servicio
        if not ontology_service.initialized:
            logger.error("❌ Servicio de ontología no inicializado")
            return {
                'status': 'error',
                'message': 'Servicio de ontología no inicializado'
            }
        
        # Validar datos de entrada
        if not data or 'text' not in data:
            logger.error("❌ Datos de entrada inválidos")
            return {
                'status': 'error',
                'message': 'Se requiere texto para búsqueda'
            }
            
        # Procesar término
        result = ontology_service.process_term(term=data['text'])
        
        if not result:
            logger.error("❌ Error procesando término")
            return {
                'status': 'error',
                'message': 'Error procesando término'
            }
            
        logger.info("✅ Término procesado correctamente")
        logger.debug(f"📤 Resultado: {result}")
        
        return {
            'status': 'success',
            'query': data['text'],
            'response': result
        }
        
    except Exception as e:
        logger.error(f"❌ Error en handler ontología: {e}")
        return {
            'status': 'error',
            'message': str(e)
        }

def handle_ontology_test(data: Dict[str, Any], websocket_instance=None) -> Dict:
    """
    Maneja las solicitudes de test del servicio ontológico
    
    Args:
        data: Datos de la solicitud
        websocket_instance: Instancia de WebSocket
        
    Returns:
        Dict con resultado del test
    """
    try:
        logger.info("🧪 Iniciando test de ontología")
        logger.debug(f"📥 Datos de test: {data}")
        
        # Validar servicio
        if not ontology_service.initialized:
            logger.error("❌ Servicio no inicializado")
            return {
                'status': 'error',
                'message': 'Servicio de ontología no inicializado'
            }
            
        # Ejecutar test básico
        test_term = data.get('text', 'test')
        result = ontology_service.process_term(
            term=test_term,
            config={'test_mode': True}
        )
        
        if not result:
            logger.error("❌ Test fallido")
            return {
                'status': 'error',
                'message': 'Test de ontología fallido'
            }
            
        logger.info("✅ Test completado correctamente")
        return {
            'status': 'success',
            'message': 'Test de ontología exitoso',
            'test_result': result
        }
        
    except Exception as e:
        logger.error(f"❌ Error en test de ontología: {e}")
        return {
            'status': 'error',
            'message': str(e)
        } 