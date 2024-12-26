import pytest
import logging
import time
import os
from flask import Flask
from services.service_locator import service_locator
import json

# Configurar logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(message)s'
)
logger = logging.getLogger(__name__)

# Configuración específica para el test
TEST_CONFIG = {
    'model': 'gpt-4o',
    'temperature': 0.5,
    'system_prompt': """
    Eres un asistente personalizado para el usuario.
    
    Reglas:
    1. Sé breve y directo
    2. actitud ácida
    """
}

def setup_test_environment():
    """Configura el entorno de prueba con los datos necesarios"""
    try:
        logger.info("\n🔧 Configurando entorno de prueba...")
        app = Flask(__name__)
        
        # 1. Inicializar WebSocket
        from services.websocket_service import WebSocketService
        websocket = WebSocketService(app)
        service_locator.register('websocket', websocket)
        logger.info("✅ WebSocket service registrado")
        
        # 2. Inicializar Storage
        from services.storage_service import StorageService
        storage = StorageService(websocket)
        service_locator.register('storage', storage)
        logger.info("✅ Storage service registrado")
        
        # 3. Configurar datos de prueba
        install_timestamp = str(int(time.time()))
        storage.set_value('installTimestamp', install_timestamp)
        storage.set_value('searchConfig', {})
        logger.info("✅ Datos de prueba configurados en storage")
        
        return websocket
        
    except Exception as e:
        logger.error(f"❌ Error en setup: {str(e)}")
        raise

def test_openai_service(data=None, websocket_instance=None):
    """Test de integración del servicio OpenAI"""
    try:
        logger.info("\n🔍 Iniciando test de OpenAI service...")
        
        # 1. Configurar entorno
        if not websocket_instance:
            websocket_instance = setup_test_environment()
        logger.info("✅ Entorno configurado")
        
        # 2. Verificar storage
        storage = service_locator.get('storage')
        if not storage:
            error_msg = "❌ No se pudo obtener Storage service"
            logger.error(error_msg)
            return {'status': 'error', 'message': error_msg}
        logger.info("✅ Storage service obtenido")
            
        # 3. Verificar datos de prueba
        if not data:
            data = {
                'text': '¿Qué es LOINC?',
                'history': []
            }
        logger.info(f"📦 Datos de prueba: {json.dumps(data, indent=2)}")
        
        # 4. Obtener OpenAI service
        openai_service = service_locator.get('openai')
        if not openai_service:
            error_msg = "❌ No se pudo obtener OpenAI service"
            logger.error(error_msg)
            return {'status': 'error', 'message': error_msg}
        logger.info("✅ OpenAI service obtenido")
            
        # 5. Verificar datos necesarios
        text_query = data.get('text')
        if not text_query:
            error_msg = "❌ No se proporcionó texto para la consulta"
            logger.error(error_msg)
            return {'status': 'error', 'message': error_msg}
        
        chat_history = data.get('history', [])
        logger.info(f"📝 Query: {text_query}")
        logger.info(f"📚 History: {len(chat_history)} mensajes")
        
        # 6. Inicializar si es necesario
        if not openai_service.initialized:
            logger.info("🔄 Inicializando OpenAI service...")
            if not openai_service.initialize():
                error_msg = "❌ Error inicializando OpenAI service"
                logger.error(error_msg)
                return {'status': 'error', 'message': error_msg}
            logger.info("✅ OpenAI service inicializado")
        
        # 7. Procesar consulta
        logger.info("🔄 Procesando consulta...")
        response = openai_service.process_query(
            user_prompt=text_query,
            chat_history=chat_history,
            model=TEST_CONFIG['model'],
            temperature=TEST_CONFIG['temperature'],
            system_prompt=TEST_CONFIG['system_prompt']
        )
        
        if response:
            logger.info("✅ Respuesta obtenida correctamente")
            return {
                'status': 'success',
                'query': text_query,
                'response': response
            }
        else:
            error_msg = "❌ No se obtuvo respuesta"
            logger.error(error_msg)
            return {
                'status': 'error',
                'message': error_msg
            }
        
    except Exception as e:
        error_msg = f"❌ Error en test: {str(e)}"
        logger.error(error_msg)
        return {
            'status': 'error',
            'message': str(e)
        }

def handle_test_search(data, websocket_instance):
    """Maneja la solicitud de test desde el frontend"""
    logger.info("\n🔄 Recibida solicitud de test desde frontend")
    return test_openai_service(data, websocket_instance) 