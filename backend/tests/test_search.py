import pytest
import logging
import json
from services.on_demand.database_search_service import DatabaseSearchService
from services.core.websocket_service import WebSocketService

# Configurar logging con formato personalizado
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(name)s] %(levelname)s: %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger('test.search')

def log_section(title: str):
    """Helper para mostrar secciones en los logs"""
    logger.info("=" * 50)
    logger.info(f"📍 {title}")
    logger.info("=" * 50)

def log_step(step: str, message: str):
    """Helper para mostrar pasos en los logs"""
    logger.info(f"[{step}] {message}")

def log_error(message: str, error: Exception = None):
    """Helper para mostrar errores en los logs"""
    logger.error(f"❌ {message}")
    if error:
        logger.error(f"  └─ {type(error).__name__}: {str(error)}")

def log_data(title: str, data: dict):
    """Helper para mostrar datos de forma estructurada"""
    logger.info(f"📋 {title}:")
    for key, value in data.items():
        logger.info(f"  └─ {key}: {value}")

def log_results(results: list, limit: int = 3):
    """Helper para mostrar resultados de búsqueda"""
    total = len(results)
    logger.info(f"📊 Resultados encontrados: {total}")
    if total > 0:
        logger.info(f"  Mostrando primeros {min(limit, total)} resultados:")
        for i, result in enumerate(results[:limit], 1):
            logger.info(f"  {i}. {result.get('loinc_num', 'N/A')} - {result.get('component', 'N/A')}")
        if total > limit:
            logger.info(f"  ... y {total - limit} más")

def error_response(message: str, details: dict = None):
    """Helper para generar respuestas de error"""
    return {
        'status': 'error',
        'message': message,
        'details': details or {}
    }

def test_search_service(data, websocket_instance=None):
    """Test de integración del servicio de búsqueda"""
    log_section("INICIO TEST BÚSQUEDA")
    
    try:
        # 1. Validar websocket
        log_step("1/5", "Validando conexión WebSocket")
        if not websocket_instance:
            log_error("No se proporcionó instancia de WebSocket")
            return error_response("Se requiere instancia de WebSocket")

        # 2. Validar datos de entrada
        log_step("2/5", "Validando datos de entrada")
        term = data.get('text', '')
        config = data.get('config', {})
        
        if not term:
            log_error("No se proporcionó término de búsqueda")
            return error_response("Se requiere término para buscar")

        # 3. Preparar configuración
        log_step("3/5", "Preparando configuración de búsqueda")
        search_config = {
            'mode': config.get('mode', 'elastic'),  # elastic o sql
            'limit': config.get('limit', 100),
            'fuzzy': config.get('fuzzy', True),
            'fields': config.get('fields', ['component', 'system']),
            'sort': config.get('sort', [{'_score': 'desc'}])
        }
        log_data("Configuración de búsqueda", search_config)
            
        # 4. Ejecutar búsqueda
        log_step("4/5", f"Buscando término: '{term}'")
        search_service = DatabaseSearchService()
        results = search_service.search(
            term=term,
            mode=search_config['mode'],
            limit=search_config['limit'],
            fuzzy=search_config['fuzzy'],
            fields=search_config['fields'],
            sort=search_config['sort']
        )

        if results is None:
            log_error("Error ejecutando búsqueda")
            return error_response("Error al procesar la búsqueda")

        # Logging de resultados
        log_results(results)

        # 5. Preparar respuesta
        log_step("5/5", "Preparando respuesta")
        result = {
            'status': 'success',
            'query': term,
            'config': search_config,
            'results': results
        }
        
        logger.info("✅ Test completado exitosamente")
        return result
        
    except Exception as e:
        log_error("Error inesperado en test", e)
        return error_response(str(e))
    finally:
        log_section("FIN TEST BÚSQUEDA")

def handle_search(data, websocket_instance=None):
    """Maneja la solicitud de búsqueda desde el frontend"""
    log_section("SOLICITUD DE BÚSQUEDA")
    logger.info("📥 Datos recibidos del frontend:")
    logger.info(f"  └─ Término: {data.get('text', '')}")
    logger.info(f"  └─ Modo: {data.get('config', {}).get('mode', 'elastic')}")
    return test_search_service(data, websocket_instance) 