import pytest
import logging
import json
from services.on_demand.openai_service import OpenAIService
from services.core.websocket_service import WebSocketService

# Configurar logging con formato personalizado
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(name)s] %(levelname)s: %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger('test.openai')

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
        if key == 'api_key':
            # Ocultar API key en logs
            value = f"{value[:8]}...{value[-4:]}"
        logger.info(f"  └─ {key}: {value}")

def error_response(message: str, details: dict = None):
    """Helper para generar respuestas de error"""
    return {
        'status': 'error',
        'message': message,
        'details': details or {}
    }

def test_openai_service(data, websocket_instance=None):
    """Test de integración del servicio OpenAI"""
    log_section("INICIO TEST OPENAI")
    
    try:
        # 1. Validar websocket
        log_step("1/5", "Validando conexión WebSocket")
        if not websocket_instance:
            log_error("No se proporcionó instancia de WebSocket")
            return error_response("Se requiere instancia de WebSocket")

        # 2. Validar datos de entrada
        log_step("2/5", "Validando datos de entrada")
        messages = data.get('messages', [])
        system_prompt = data.get('systemPrompt')
        
        if not messages:
            log_error("No se proporcionaron mensajes")
            return error_response("Se requieren mensajes para procesar")

        # 3. Preparar request
        log_step("3/5", "Preparando solicitud OpenAI")
        request_data = {
            'messages': messages,
            'model': data.get('model', 'gpt-4o'),
            'temperature': data.get('temperature', 0.5),
            'system_prompt': system_prompt
        }
        log_data("Datos de solicitud", {
            'model': request_data['model'],
            'temperature': request_data['temperature'],
            'messages_count': len(messages),
            'last_message': messages[-1]['content'][:50] + '...' if messages else 'N/A'
        })
            
        # 4. Procesar con OpenAI
        log_step("4/5", "Procesando con OpenAI")
        openai_service = OpenAIService()
        
        # Construir historial de chat
        chat_history = []
        if system_prompt:
            chat_history.append({
                'role': 'system',
                'content': system_prompt
            })
        chat_history.extend(messages)
        
        response = openai_service.process_query(
            user_prompt=messages[-1]['content'],
            chat_history=chat_history[:-1],  # Excluir último mensaje que ya va en user_prompt
            model=request_data['model'],
            temperature=request_data['temperature']
        )

        if not response:
            log_error("No se obtuvo respuesta de OpenAI")
            return error_response("Error al procesar con OpenAI")

        # 5. Preparar respuesta
        log_step("5/5", "Preparando respuesta")
        result = {
            'status': 'success',
            'query': messages[-1]['content'],
            'response': response,
            'messages': chat_history + [{
                'role': 'assistant',
                'content': response
            }]
        }
        
        logger.info("✅ Test completado exitosamente")
        return result
        
    except Exception as e:
        log_error("Error inesperado en test", e)
        return error_response(str(e))
    finally:
        log_section("FIN TEST OPENAI")

def handle_test_search(data, websocket_instance=None):
    """Maneja la solicitud de test desde el frontend"""
    log_section("SOLICITUD TEST OPENAI")
    logger.info("📥 Datos recibidos del frontend:")
    logger.info(f"  └─ Mensajes: {len(data.get('messages', []))} mensaje(s)")
    return test_openai_service(data, websocket_instance) 