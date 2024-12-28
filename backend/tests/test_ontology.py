import pytest
import logging
import json
import re
from services.on_demand.ontology_service import ontology_service
from services.on_demand.openai_service import OpenAIService
from services.core.websocket_service import WebSocketService

# Configurar logging con formato personalizado
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(name)s] %(levelname)s: %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger('test.ontology')

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

def clean_json_response(response: str) -> str:
    """
    Limpia la respuesta de OpenAI para obtener un JSON válido
    1. Elimina los bloques de código markdown
    2. Elimina los comentarios del JSON
    3. Encuentra el JSON válido
    """
    try:
        # 1. Eliminar bloques de código markdown
        response = re.sub(r'```json\n|\n```', '', response)
        
        # 2. Eliminar comentarios del JSON (// comments)
        response = re.sub(r'//.*$', '', response, flags=re.MULTILINE)
        
        # 3. Encontrar el primer JSON válido
        json_match = re.search(r'(\{.*\})', response, re.DOTALL)
        if not json_match:
            raise ValueError("No se encontró un JSON válido en la respuesta")
            
        json_str = json_match.group(1)
        
        # 4. Limpiar espacios extra y líneas vacías
        json_str = re.sub(r',(\s*[\]}])', r'\1', json_str)
        
        return json_str
    except Exception as e:
        log_error("Error limpiando JSON", e)
        raise

def error_response(message: str, details: dict = None):
    """Helper para generar respuestas de error"""
    return {
        'status': 'error',
        'message': message,
        'details': details or {}
    }

def test_ontology_service(data, websocket_instance=None):
    """Test de integración del servicio de ontología"""
    log_section("INICIO TEST ONTOLOGÍA")
    
    try:
        # 1. Validar websocket
        log_step("1/4", "Validando conexión WebSocket")
        if not websocket_instance:
            log_error("No se proporcionó instancia de WebSocket")
            return error_response("Se requiere instancia de WebSocket")

        # 2. Obtener y validar término
        log_step("2/4", "Validando término de búsqueda")
        term = data.get('text', '')
        if not term:
            log_error("Término de búsqueda vacío")
            return error_response("Se requiere término a buscar")
            
        # 3. Procesar término
        log_step("3/4", f"Procesando término: '{term}'")
        response = ontology_service.process_term(term)
        
        if not response:
            log_error("Error procesando término")
            return error_response("Error al procesar el término")

        # 4. Retornar respuesta exitosa
        log_step("4/4", "Preparando respuesta")
        result = {
            'status': 'success',
            'query': term,
            'response': response
        }
        
        logger.info("✅ Test completado exitosamente")
        return result
        
    except Exception as e:
        log_error("Error inesperado en test", e)
        return error_response(str(e))
    finally:
        log_section("FIN TEST ONTOLOGÍA")

def handle_ontology_search(data, websocket_instance=None):
    """Maneja la solicitud de búsqueda ontológica desde el frontend"""
    log_section("SOLICITUD BÚSQUEDA ONTOLÓGICA")
    logger.info("📥 Datos recibidos del frontend:")
    logger.info(f"  └─ Término: {data.get('text', '')}")
    return test_ontology_service(data, websocket_instance) 